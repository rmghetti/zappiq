/* ══════════════════════════════════════════════════════════════════════════
 * adminAiXray: Raio-X do que a IA recebe, sem chamar o modelo.
 * --------------------------------------------------------------------------
 * Tarefa A3 do plano "Treinar IA e Qualidade da IA" (achado A072, e prova das
 * tarefas seguintes).
 *
 * O problema: o prompt do agente é montado por quatro caminhos diferentes e
 * cada um perde uma coisa pelo caminho. O WhatsApp tem base, saudação, links
 * e data. O Instagram roda com as configurações do cliente vazias (A057). O
 * chat do site não consulta a base nem injeta saudação (A068). O teste de
 * Qualidade também não (A036). Ninguém conseguia ver isso, porque o prompt só
 * existia dentro de uma chamada paga de modelo.
 *
 * Esta rota monta o prompt pelo MESMO caminho da produção de cada canal, mas
 * para aí: fatia o prompt em blocos legíveis e compara com o que a
 * organização configurou. Nenhum token de modelo é gasto.
 *
 * Só SUPERADMIN. É uma ferramenta de diagnóstico que lê o prompt inteiro de
 * qualquer organização, então não pode ficar ao alcance de um usuário comum.
 *
 * Quando os defeitos acima forem corrigidos, esta rota passa a mostrar a
 * correção sozinha: ela não tem cópia de nada, chama os montadores de verdade.
 *
 *   POST /api/admin/ai-xray  → { organizationId, canal, turnos: [...] }
 * ══════════════════════════════════════════════════════════════════════════ */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
  buildSystemPromptForContact,
  resolveSchedulingRuntime,
} from '../agents/agentOrchestrator.js';
import { buildLiveProfileBlock, buildGreetingBlock } from '../agents/tenantLiveProfile.js';
import { blocoDeRegrasDaOrganizacao } from '../services/agentRulesService.js';
import { isFlagOn } from '../services/featureFlags.js';
import {
  buildWebChatSystemPrompt,
  loadOrgSystemPrompt,
  SystemPromptNaoEncontrado,
} from '../services/webChatService.js';
import { buildEvalSystemPrompt } from '../services/agentEvalRunner.js';
import { getIzaFactsBlock } from '../services/izaFactsService.js';
import { isZappIQOrg } from '../config/zappiqOrg.js';
import * as ragService from '../services/ragService.js';
import { sliceBySections, runChecks, type FonteRecuperada } from '../agents/promptXray.js';

const router = Router();

// ── Contrato de entrada ───────────────────────────────────

const CANAIS = ['whatsapp', 'instagram', 'site', 'playground', 'qualidade'] as const;
type Canal = (typeof CANAIS)[number];

/** Canais que consultam a base de conhecimento HOJE, em produção. */
const CANAIS_COM_RAG: Canal[] = ['whatsapp', 'instagram', 'playground'];

const MAX_MENSAGENS = 25;

const corpoSchema = z.object({
  organizationId: z.string().trim().min(1).max(64),
  canal: z.enum(CANAIS),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .min(1)
    .max(MAX_MENSAGENS),
});

type Mensagem = z.infer<typeof corpoSchema>['messages'][number];

// ── Helpers ───────────────────────────────────────────────

/**
 * Agente do teste de Qualidade: o comercial vivo mais RECENTE da organização.
 *
 * A ordem não é capricho, é o que agentQuality faz. O chat do site pega o mais
 * ANTIGO, e por isso não passa por aqui: ele usa o carregador do próprio
 * webChatService. Se a organização tiver mais de um agente comercial vivo, os
 * dois canais respondem com prompts diferentes. O Raio-X reproduz cada caminho
 * como ele é, não como deveria ser.
 */
async function carregarAgenteDaQualidade(organizationId: string) {
  return prisma.agent.findFirst({
    where: { organizationId, role: 'comercial', status: 'live' },
    select: { id: true, name: true, systemPrompt: true },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * A organização não tem agente comercial vivo com prompt. Não é falha do
 * Raio-X: é o estado em que o chat do site responderia com erro ao visitante.
 * Vira 422, para a tela não mostrar um prompt vazio como se fosse o prompt.
 */
class SemPromptDoSite extends Error {}

async function montarPrompt(input: {
  canal: Canal;
  organizationId: string;
  settings: Record<string, any>;
  ragContext: string;
  mensagem: string;
  historico: Mensagem[];
}): Promise<string> {
  const { canal, organizationId, settings, ragContext, mensagem, historico } = input;

  // WhatsApp, Instagram e playground: caminho de produção, com as settings da
  // organização.
  //
  // O Instagram rodava aqui com settings VAZIAS, de propósito, porque era o
  // que a produção fazia (webhookInstagram enfileirava `orgSettings: {}`, o
  // achado A057). O defeito foi corrigido em 14/09/2026: o webhook passa as
  // settings reais, como o do WhatsApp sempre fez. O Raio-X acompanha.
  if (canal === 'whatsapp' || canal === 'playground' || canal === 'instagram') {
    // Agendamento e histórico entram pelo mesmo caminho da produção. Os dois
    // mudam o texto que a IA recebe: sem eles, o Raio-X mostrava um prompt
    // que o WhatsApp não monta (sem a linha de agendamento, e afirmando que
    // "já tem histórico" num turno em que o histórico não está no contexto).
    const agendamento = await resolveSchedulingRuntime(organizationId, settings);
    return buildSystemPromptForContact({
      organizationId,
      contactId: `xray:${organizationId}`,
      orgSettings: settings,
      ragContext,
      agendamento,
      temHistoricoNoContexto: historico.length > 0,
    });
  }

  if (canal === 'site') {
    // Sem cópia da regra: quem escolhe o agente é o mesmo carregador que o
    // visitante do site aciona, com o mesmo cache de 5 minutos.
    let orgPrompt: string;
    try {
      orgPrompt = await loadOrgSystemPrompt(organizationId);
    } catch (e) {
      // Só a ausência de agente vira 422. Qualquer outra falha (banco fora do
      // ar, por exemplo) sobe e vira 500: um erro de infraestrutura não pode
      // sair na tela como "esta organização não tem agente comercial ativo".
      if (e instanceof SystemPromptNaoEncontrado) throw new SemPromptDoSite();
      throw e;
    }
    const ehIza = isZappIQOrg(organizationId);

    // Perfil vivo e saudação (A8, A068): o MESMO caminho de
    // webChatService.processWebChatTurn. Sem isto, ligar o interruptor e vir
    // conferir aqui mostrava o prompt de antes, e quem olhasse concluiria
    // que a correção não funcionou no site.
    let perfilVivoBlock = '';
    let saudacaoBlock = '';
    if (await isFlagOn(organizationId, 'perfilVivo')) {
      perfilVivoBlock = buildLiveProfileBlock(settings, null, { now: new Date() });
      saudacaoBlock = buildGreetingBlock(historico.length === 0, settings.greetingMessage);
    }

    // C3: as regras aprovadas pelo dono. Mesmo caminho do visitante, então
    // quem liga o interruptor e vem conferir aqui vê o bloco que o chat do
    // site está recebendo, e não o prompt de antes.
    const regrasBlock = await blocoDeRegrasDaOrganizacao(organizationId);

    return buildWebChatSystemPrompt({
      orgPrompt,
      factsBlock: ehIza ? await getIzaFactsBlock() : '',
      isIzaCanonical: ehIza,
      perfilVivoBlock,
      regrasBlock,
      saudacaoBlock,
    });
  }

  // canal === 'qualidade'
  const agente = await carregarAgenteDaQualidade(organizationId);
  return buildEvalSystemPrompt(
    { systemPrompt: agente?.systemPrompt ?? null },
    { id: 'xray', userMessage: mensagem, history: historico },
  );
}

// ── POST /api/admin/ai-xray ───────────────────────────────

router.post(
  '/',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  async (req: Request, res: Response) => {
    // Validação dentro do handler (e não em middleware) de propósito: assim o
    // 400 é do Raio-X, com mensagem em português, e o teste consegue provar.
    const parsed = corpoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: `Corpo inválido. Informe organizationId, canal (${CANAIS.join(', ')}) e de 1 a ${MAX_MENSAGENS} mensagens.`,
        detalhes: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      });
      return;
    }

    const { organizationId, canal, messages } = parsed.data;

    try {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, settings: true },
      });
      if (!org) {
        res.status(404).json({ error: 'Organização não encontrada' });
        return;
      }
      const settings = (org.settings as Record<string, any>) || {};

      const qaAtivos = (
        await prisma.qAPair.findMany({
          where: { organizationId, isActive: true },
          select: { id: true, question: true },
        })
      ).map((q) => ({ id: q.id, question: q.question }));

      const usaRag = CANAIS_COM_RAG.includes(canal);
      const turnos: Array<Record<string, unknown>> = [];
      const historico: Mensagem[] = [];

      for (const m of messages) {
        // Fala do agente só alimenta o histórico: o Raio-X é sobre o que a IA
        // recebe QUANDO o cliente final escreve.
        if (m.role !== 'user') {
          historico.push(m);
          continue;
        }

        const { context, sources } = usaRag
          ? await ragService.searchWithSources(organizationId, m.content, 5)
          : { context: '', sources: [] as ragService.RagSource[] };

        const prompt = await montarPrompt({
          canal,
          organizationId,
          settings,
          ragContext: context,
          mensagem: m.content,
          historico: [...historico],
        });

        const fontes: FonteRecuperada[] = sources.map((s) => ({
          source: s.source,
          similarity: s.similarity,
        }));

        turnos.push({
          mensagem: m.content,
          prompt_chars: prompt.length,
          fatias: sliceBySections(prompt),
          fontes,
          // As checagens comparam sempre com as configurações REAIS da
          // organização, inclusive no Instagram. É assim que o Raio-X mostra
          // em vermelho o que o cliente configurou e o canal jogou fora.
          checagens: runChecks({
            prompt,
            settings,
            sources: fontes,
            ultimaMensagem: m.content,
            qaAtivos,
          }),
        });

        historico.push(m);
      }

      res.json({ organizationId, canal, turnos });
    } catch (err) {
      if (err instanceof SemPromptDoSite) {
        res.status(422).json({
          error: 'sem_prompt',
          message:
            'Esta organização não tem agente comercial ativo; o chat do site responderia com erro.',
        });
        return;
      }
      logger.error('[AiXray] falhou ao montar o Raio-X', {
        organizationId,
        canal,
        err: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: 'Não foi possível montar o Raio-X deste prompt' });
    }
  },
);

export default router;
