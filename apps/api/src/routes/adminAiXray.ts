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
  buildAgentContextForContact,
  resolveSchedulingRuntime,
} from '../agents/agentOrchestrator.js';
import { buildLiveProfileBlock, buildGreetingBlock } from '../agents/tenantLiveProfile.js';
import { blocoDeRegrasDaOrganizacao } from '../services/agentRulesService.js';
import { isFlagOn } from '../services/featureFlags.js';
// C1a (Passo 12): o Raio-X mostra o hash e as partes do contexto de cada
// canal. Com o interruptor `contextoUnico` da organização ligado, o site e
// a Qualidade passam a ser montados pelo MESMO motor do WhatsApp, e o
// hash estável (só os blocos do tenant) tem de bater entre os canais.
import {
  flagLigada,
  montarContextoDoTurno,
  type ContatoDoTurno,
} from '../agents/agentContextLoader.js';
import { hashDoContexto, type ParteDoContexto } from '../agents/composeAgentContext.js';
import {
  buildWebChatSystemPrompt,
  loadOrgSystemPrompt,
  montarContextoDoChatDoSite,
  idDoAgenteComercial,
  SystemPromptNaoEncontrado,
} from '../services/webChatService.js';
import { buildEvalSystemPrompt } from '../services/agentEvalRunner.js';
import {
  contatoDoCenario,
  DATA_FIXA_DO_EVAL,
  PROMPT_AUSENTE,
} from '../services/agentEvalContext.js';
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

/** O que o Raio-X mostra de cada turno, além das fatias e das checagens. */
interface PromptMontado {
  prompt: string;
  /** sha256 do prompt inteiro. Existe nos dois motores. */
  hash: string;
  /** sha256 dos blocos estáveis do tenant. Só no motor único. */
  hashEstavel: string | null;
  /** Orçamento por bloco. No motor de antes, derivado das fatias. */
  partes: ParteDoContexto[];
  /** Que motor montou este prompt. */
  motor: 'unico' | 'antes';
}

/** Partes derivadas das fatias, para o motor de antes ter orçamento também. */
function partesDasFatias(prompt: string): ParteDoContexto[] {
  return sliceBySections(prompt).map((f) => ({ nome: f.titulo, chars: f.chars }));
}

function montadoPeloDeAntes(prompt: string): PromptMontado {
  return { prompt, hash: hashDoContexto(prompt), hashEstavel: null, partes: partesDasFatias(prompt), motor: 'antes' };
}

/** O contato da sessão de teste, o mesmo do Testar minha IA e do site (A072). */
function contatoDaSessao(historico: Mensagem[]): ContatoDoTurno {
  return {
    nome: null,
    leadStatus: 'NEW',
    primeiroContato: historico.length === 0,
    totalMensagens: historico.length + 1,
  };
}

async function montarPrompt(input: {
  canal: Canal;
  organizationId: string;
  settings: Record<string, any>;
  ragContext: string;
  mensagem: string;
  historico: Mensagem[];
  /** Interruptores lidos uma vez por pedido. */
  flags: { contextoUnico: boolean; perfilVivo: boolean; ragNoChatDoSite: boolean };
  /** Um instante só para o pedido inteiro: o hash estável precisa bater entre canais. */
  agora: Date;
}): Promise<PromptMontado> {
  const { canal, organizationId, settings, ragContext, mensagem, historico, flags, agora } = input;
  const ragStatus: ragService.RagSearchStatus = ragContext ? 'ok' : 'sem_resultado';

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
    const r = await buildAgentContextForContact({
      origem: canal,
      organizationId,
      contactId: `xray:${organizationId}`,
      orgSettings: settings,
      ragContext,
      agendamento,
      temHistoricoNoContexto: historico.length > 0,
      // O Testar minha IA passa o contato da sessão (A072); os outros dois
      // fazem o lookup de sempre, que aqui não acha ninguém.
      contato: canal === 'playground' ? contatoDaSessao(historico) : undefined,
      agora,
    });
    return r.viaContextoUnico
      ? { prompt: r.systemPrompt, hash: r.hash, hashEstavel: r.hashEstavel ?? null, partes: r.partes, motor: 'unico' }
      : montadoPeloDeAntes(r.systemPrompt);
  }

  if (canal === 'site') {
    if (flags.contextoUnico) {
      // O MESMO montador que o visitante aciona com o interruptor ligado. A
      // busca já foi feita pelo Raio-X (e só quando ragNoChatDoSite permite).
      try {
        const ctx = await montarContextoDoChatDoSite({
          organizationId,
          orgSettings: settings,
          contato: contatoDaSessao(historico),
          mensagem,
          temHistoricoNoContexto: historico.length > 0,
          perfilVivoLigado: flags.perfilVivo,
          consultarBase: flags.ragNoChatDoSite,
          busca: { context: ragContext, status: ragStatus },
          agora,
        });
        return { prompt: ctx.systemPrompt, hash: ctx.hash, hashEstavel: ctx.hashEstavel, partes: ctx.partes, motor: 'unico' };
      } catch (e) {
        if (e instanceof SystemPromptNaoEncontrado) throw new SemPromptDoSite();
        throw e;
      }
    }

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
    if (flags.perfilVivo) {
      perfilVivoBlock = buildLiveProfileBlock(settings, null, { now: agora });
      saudacaoBlock = buildGreetingBlock(historico.length === 0, settings.greetingMessage);
    }

    // C3: as regras aprovadas pelo dono. Mesmo caminho do visitante, então
    // quem liga o interruptor e vem conferir aqui vê o bloco que o chat do
    // site está recebendo, e não o prompt de antes.
    //
    // Rodada 3 do PR #375: por AGENTE, com o mesmo seletor do chat do site
    // (idDoAgenteComercial). Montar só por organização mostraria, com dois
    // agentes vivos, as regras do outro. O interruptor é conferido antes,
    // como no chat, para o canal desligado nem procurar o agente.
    //
    // Rodada 2 do PR #377: só no caminho de antes. Com `contextoUnico`, o
    // ramo de cima monta pelo carregador, que põe as regras do MESMO agente
    // do prompt em `regrasDoCliente`, como o chat do site faz.
    let regrasBlock = '';
    if (await isFlagOn(organizationId, 'regrasComoRegistros')) {
      regrasBlock = await blocoDeRegrasDaOrganizacao(organizationId, {
        agentId: await idDoAgenteComercial(organizationId),
      });
    }

    return montadoPeloDeAntes(
      buildWebChatSystemPrompt({
        orgPrompt,
        factsBlock: ehIza ? await getIzaFactsBlock() : '',
        isIzaCanonical: ehIza,
        perfilVivoBlock,
        regrasBlock,
        saudacaoBlock,
      }),
    );
  }

  // canal === 'qualidade'
  const agente = await carregarAgenteDaQualidade(organizationId);
  // Rodada 3 do PR #375: o avaliador passou a receber o bloco de regras do
  // agente testado. O Raio-X mostra o mesmo prompt que o teste envia.
  //
  // Rodada 2 do PR #377: lido UMA vez e usado pelos dois motores, como faz
  // quem chama o avaliador (o montador do teste recebe o bloco pronto e não
  // lê de novo). No motor único ele entra em `regrasDoCliente`.
  const regrasBlock = await blocoDeRegrasDaOrganizacao(organizationId, {
    agentId: agente?.id ?? null,
  });
  if (flags.contextoUnico) {
    // O MESMO contexto que services/agentEvalContext monta para cada cenário:
    // contato mock de sempre, data FIXA e a base pela mensagem do cenário.
    const ctx = await montarContextoDoTurno({
      origem: 'qualidade',
      organizationId,
      orgSettings: settings,
      agente: {
        id: agente?.id ?? 'sem-agente',
        name: agente?.name ?? '',
        systemPrompt: agente?.systemPrompt || PROMPT_AUSENTE,
        role: 'comercial',
      },
      contato: contatoDoCenario({ id: 'xray', history: historico }),
      ragContext,
      ragStatus,
      temHistoricoNoContexto: historico.length > 0,
      agora: DATA_FIXA_DO_EVAL,
      perfilVivoLigado: flags.perfilVivo,
    });
    if (ctx) {
      return { prompt: ctx.systemPrompt, hash: ctx.hash, hashEstavel: ctx.hashEstavel, partes: ctx.partes, motor: 'unico' };
    }
  }
  return montadoPeloDeAntes(
    buildEvalSystemPrompt(
      { systemPrompt: agente?.systemPrompt ?? null },
      { id: 'xray', userMessage: mensagem, history: historico },
      regrasBlock,
    ),
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

      // Os interruptores, lidos uma vez por pedido. O `isFlagOn` direto fica
      // para o teste antigo do perfil vivo; os demais passam pelo mesmo
      // flagLigada da produção (fail-closed).
      const [contextoUnico, perfilVivo, ragNoChatDoSite] = await Promise.all([
        flagLigada(organizationId, 'contextoUnico'),
        isFlagOn(organizationId, 'perfilVivo').catch(() => false),
        flagLigada(organizationId, 'ragNoChatDoSite'),
      ]);
      const flags = { contextoUnico, perfilVivo, ragNoChatDoSite };
      // Com o motor único, o site consulta a base só com o portão
      // ragNoChatDoSite (A197), e a Qualidade consulta sempre (A036).
      const usaRag =
        CANAIS_COM_RAG.includes(canal) ||
        (canal === 'site' && contextoUnico && ragNoChatDoSite) ||
        (canal === 'qualidade' && contextoUnico);
      const agora = new Date();
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

        const montado = await montarPrompt({
          canal,
          organizationId,
          settings,
          ragContext: context,
          mensagem: m.content,
          historico: [...historico],
          flags,
          agora,
        });
        const prompt = montado.prompt;

        const fontes: FonteRecuperada[] = sources.map((s) => ({
          source: s.source,
          similarity: s.similarity,
        }));

        turnos.push({
          mensagem: m.content,
          prompt_chars: prompt.length,
          // C1a: hash do prompt inteiro, hash estável do tenant (só no motor
          // único), orçamento por bloco e qual motor montou.
          hash: montado.hash,
          hash_estavel: montado.hashEstavel,
          partes: montado.partes,
          motor: montado.motor,
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
