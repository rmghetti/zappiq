/**
 * Mira Prospects — rotas de feature (/api/mira). Todas gated por
 * requireMira() no server.ts (auth + tenant + plano ativo + add-on).
 *
 * Sessão 1 (fundação): Perfil de Prospecção (survey/ICP), fila de
 * Alvos e dossiê, Releases. Os motores (geração de Alvos) entram nas
 * sessões 2 e 3 em services/mira/*.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@zappiq/database';
import { validate } from '../middleware/validate.js';
import { getMiraEntitlement } from '../middleware/requireMira.js';
import { runMotorA, crmCandidates } from '../services/mira/motorA.js';
import { pousarNoCrm } from '../services/mira/pousarCrm.js';
import { runMotorB, placesDisponivel } from '../services/mira/motorB.js';
import { runDescobertaPublica } from '../services/mira/descobertaPublica.js';
import { buscaPublicaDisponivel, buscaPublicaProvider } from '../services/mira/buscaPublica.js';
import { bigQueryDisponivel } from '../services/mira/descobertaBigQuery.js';
import { enriquecerDecisoresPublico } from '../services/mira/decisoresPublico.js';
import { aprofundarAlvo, planoBloqueadoPor } from '../services/mira/agentes.js';
import { computeMiraAnalytics } from '../services/mira/analytics.js';
import { sugerirPerfil } from '../services/mira/perfilSugestao.js';
import {
  iniciarCampanha,
  concluirCampanha,
  descartarCampanha,
  listarCampanhas,
} from '../services/mira/campanhas.js';
import { sementeDaBusca } from '../services/mira/alvosDaBusca.js';
import { perfilSchema, computePerfilProntidao, modoDaDescoberta, type PerfilInput } from './mira.perfil.schema.js';

const router = Router();

// ── Motor A (base instalada) ───────────────────────────────────────

const motorASchema = z.object({
  cnpjs: z.array(z.string().trim().min(11).max(20)).min(1).max(50),
  // Nome da campanha de prospecção (opcional: sem ele, nome automático).
  nome: z.string().trim().max(120).optional(),
});

// POST /api/mira/motor-a/run — mapeia uma lista de CNPJs da carteira.
// Cada disparo vira uma campanha de prospecção nomeada (gestão no hub).
router.post('/motor-a/run', validate(motorASchema), async (req: Request, res: Response, next: NextFunction) => {
  const { cnpjs, nome } = req.body as z.infer<typeof motorASchema>;
  let campanha: { id: string; nome: string } | null = null;
  try {
    campanha = await iniciarCampanha(req.organizationId!, {
      nome,
      tipo: 'BASE_INSTALADA',
      parametros: { cnpjs: cnpjs.length },
    });
    const result = await runMotorA(req.organizationId!, cnpjs, campanha.id);
    await concluirCampanha(campanha.id, result as any);
    res.json({ success: true, data: { ...result, campanhaId: campanha.id, campanhaNome: campanha.nome } });
  } catch (err: any) {
    if (err?.status === 412) {
      // Gate: o disparo nem largou, então não vira histórico de campanha.
      if (campanha) await descartarCampanha(campanha.id);
      res.status(412).json({
        success: false,
        error: 'perfil_incompleto',
        message: 'Complete o Perfil de Prospecção (mínimo 60%) para os motores largarem.',
      });
      return;
    }
    if (campanha) await concluirCampanha(campanha.id, { motivo: 'erro_inesperado' }, 'FALHOU').catch(() => {});
    next(err);
  }
});

// GET /api/mira/motor-a/crm-candidates — CNPJs achados no CRM (customFields)
router.get('/motor-a/crm-candidates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await crmCandidates(req.organizationId!);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ── Motor B (descoberta net-new) ───────────────────────────────────

const motorBSchema = z.object({
  // O que procurar: os alvos que o cliente confirmou no wizard. Nascem do
  // Perfil (GET /campanhas/semente) e ele pode tirar ou somar. Nunca vazio:
  // é o que a busca vai usar de fato.
  alvos: z.array(z.string().trim().min(2).max(160)).min(1).max(10),
  // Onde procurar. Vazio = sem recorte de região.
  regioes: z.array(z.string().trim().min(2).max(120)).max(5).default([]),
  // B2B = descoberta pública (busca + Receita/BrasilAPI, grátis).
  // B2C = negócio local (Google Places). Default segue o modo do perfil.
  kind: z.enum(['B2B', 'B2C']).optional(),
  // Nome da campanha de prospecção (opcional: sem ele, nome automático).
  nome: z.string().trim().max(120).optional(),
});

// GET /api/mira/motor-b/status — quais fontes de descoberta estão ativas
router.get('/motor-b/status', async (_req: Request, res: Response) => {
  let cnpjIndexRows = 0;
  try {
    const r: any[] = await (prisma as any).$queryRawUnsafe('SELECT COUNT(*)::int AS n FROM "mira_cnpj_index"');
    cnpjIndexRows = r[0]?.n ?? 0;
  } catch {
    /* tabela pode não existir ainda em ambientes antigos; trata como vazia */
  }
  res.json({
    success: true,
    data: {
      // B2C local — Google Places (opcional, pago). Sem chave = desabilitado.
      places: placesDisponivel(),
      // B2B — duas fontes possíveis: índice local (grátis, sem chave, exige
      // ingestão prévia da base da Receita) OU busca pública (precisa de
      // provedor configurado). Basta uma das duas pra descoberta funcionar.
      buscaPublica: buscaPublicaDisponivel(),
      provider: buscaPublicaProvider(),
      cnpjIndexDisponivel: cnpjIndexRows > 0,
      cnpjIndexTotal: cnpjIndexRows,
      // BigQuery (Base dos Dados) — fonte B2B prioritária quando configurada.
      bigquery: bigQueryDisponivel(),
    },
  });
});

// POST /api/mira/motor-b/descobrir — descoberta net-new (B2B público ou B2C Places).
// Cada disparo vira uma campanha de prospecção nomeada (gestão no hub).
router.post('/motor-b/descobrir', validate(motorBSchema), async (req: Request, res: Response, next: NextFunction) => {
  let campanha: { id: string; nome: string } | null = null;
  try {
    const { alvos, regioes, kind, nome } = req.body as z.infer<typeof motorBSchema>;
    const perfil = await (prisma as any).miraPerfil.findUnique({ where: { organizationId: req.organizationId! } });
    const modo = modoDaDescoberta(kind, perfil);
    campanha = await iniciarCampanha(req.organizationId!, {
      nome,
      tipo: 'DESCOBERTA',
      parametros: { alvos, regioes, kind: modo },
    });
    const busca = { alvos, regioes };
    const result =
      modo === 'B2C'
        ? await runMotorB(req.organizationId!, busca, campanha.id)
        : await runDescobertaPublica(req.organizationId!, busca, campanha.id);
    await concluirCampanha(campanha.id, result as any);
    res.json({ success: true, data: { modo, ...result, campanhaId: campanha.id, campanhaNome: campanha.nome } });
  } catch (err: any) {
    // Gate/fonte indisponível: o disparo nem largou, não vira histórico.
    // Já a fonte que QUEBROU (502) fica registrada como FALHOU com o motivo:
    // é o que faltava para "0 alvos" nunca mais se passar por sucesso.
    if (campanha && (err?.status === 412 || err?.status === 501)) await descartarCampanha(campanha.id);
    else if (campanha)
      await concluirCampanha(
        campanha.id,
        { motivo: err?.message ?? 'erro', ...(err?.detail ? { detalhe: String(err.detail).slice(0, 300) } : {}) },
        'FALHOU'
      ).catch(() => {});
    if (err?.status === 422) {
      res.status(422).json({
        success: false,
        error: 'alvos_sem_fonte',
        message:
          'Nenhum dos alvos escolhidos pode ser buscado agora. Use um código de CNAE (ex.: 4651-6) ou uma atividade escrita (ex.: distribuidoras de TI).',
      });
      return;
    }
    // Fonte quebrada não é "não achei ninguém": a campanha falha dizendo o quê.
    // Cada motivo conta a verdade do seu estágio — dizer "não chegou a
    // procurar" quando ela procurou, verificou e quebrou ao gravar seria só
    // outra mentira, mais educada.
    if (err?.status === 502) {
      const mensagens: Record<string, string> = {
        fonte_falhou:
          'A fonte de busca respondeu com erro, então esta campanha não chegou a procurar. Nenhum Alvo foi criado e nada foi descontado da sua cota. O time já foi avisado.',
        verificacao_falhou:
          'A campanha encontrou empresas, mas a checagem dos dados na Receita falhou, então nenhuma pôde ser confirmada. Nenhum Alvo foi criado e nada foi descontado da sua cota. O time já foi avisado.',
        gravacao_falhou:
          'A campanha encontrou e conferiu as empresas, mas falhou ao salvar os Alvos. Nada foi descontado da sua cota. O time já foi avisado.',
      };
      const motivo = String(err?.message ?? '');
      res.status(502).json({
        success: false,
        error: mensagens[motivo] ? motivo : 'fonte_falhou',
        message: mensagens[motivo] ?? mensagens.fonte_falhou,
        detalhe: err?.detail ?? null,
      });
      return;
    }
    if (err?.status === 501) {
      res.status(501).json({
        success: false,
        error: 'fonte_indisponivel',
        message:
          'Esta fonte de descoberta ainda não está habilitada nesta instalação (B2B precisa de um provedor de busca; B2C local precisa do Google Places). O time já foi avisado.',
      });
      return;
    }
    if (err?.status === 412) {
      res.status(412).json({
        success: false,
        error: 'perfil_incompleto',
        message: 'Complete o Perfil de Prospecção (mínimo 60%) para os motores largarem.',
      });
      return;
    }
    if (err?.status === 502) {
      res.status(502).json({ success: false, error: 'places_erro', message: 'A fonte de descoberta falhou agora. Tente novamente.' });
      return;
    }
    next(err);
  }
});

// POST /api/mira/alvos/:id/aprofundar — agentes de qualificação profunda
router.post('/alvos/:id/aprofundar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await aprofundarAlvo(req.organizationId!, req.params.id);
    res.json({ success: true, data: result });
  } catch (err: any) {
    if (err?.status === 404) {
      res.status(404).json({ success: false, error: 'alvo_not_found' });
      return;
    }
    if (err?.status === 412) {
      res.status(412).json({
        success: false,
        error: 'catalogo_vazio',
        message: 'Cadastre o catálogo no Perfil de Prospecção para a análise de portfólio.',
      });
      return;
    }
    next(err);
  }
});

// POST /api/mira/alvos/:id/decisores-publico — mapeia decisores por pegada
// pública (índice de busca + páginas públicas). Nunca usa conta logada.
router.post('/alvos/:id/decisores-publico', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await enriquecerDecisoresPublico(req.organizationId!, req.params.id);
    res.json({ success: true, data: result });
  } catch (err: any) {
    if (err?.status === 404) {
      res.status(404).json({ success: false, error: 'alvo_not_found' });
      return;
    }
    if (err?.status === 501) {
      res.status(501).json({
        success: false,
        error: 'fonte_indisponivel',
        message:
          'O mapeamento de decisores por pegada pública precisa de um provedor de busca configurado (ex.: Brave Search, Google Programmable Search). O time já foi avisado.',
      });
      return;
    }
    // A busca tentou TODOS os provedores configurados e nenhum respondeu —
    // diferente de "não achei ninguém" (mercado vazio), que devolve
    // candidatos=0 com success:true. Ver buscaPublica.ts (14-15/07/2026).
    if (err?.status === 502) {
      res.status(502).json({
        success: false,
        error: 'fonte_falhou',
        message:
          'A busca pública respondeu com erro, então esta tentativa não chegou a procurar decisores. Nada foi descontado da sua cota. O time já foi avisado.',
        detalhe: err?.detail ?? null,
      });
      return;
    }
    next(err);
  }
});

// POST /api/mira/alvos/:id/crm — pousa o Alvo no CRM (Contact + Deal)
// body: { forcar?: boolean } — "enviar assim mesmo" um Alvo que não passou
// no gate. Ele entra marcado como não qualificado (ver pousarCrm.ts).
router.post('/alvos/:id/crm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const forcar = req.body?.forcar === true;
    const data = await pousarNoCrm(req.organizationId!, req.params.id, { forcar });
    res.json({ success: true, data });
  } catch (err: any) {
    if (err?.status === 404) {
      res.status(404).json({ success: false, error: 'alvo_not_found' });
      return;
    }
    if (err?.message === 'alvo_arquivado') {
      res.status(409).json({
        success: false,
        error: 'alvo_arquivado',
        message: 'Este Alvo foi arquivado. Restaure-o antes de enviar ao CRM.',
      });
      return;
    }
    if (err?.status === 409) {
      res.status(409).json({
        success: false,
        error: 'alvo_nao_pronto',
        message: 'Este Alvo ainda não passou na verificação. Use "Enviar assim mesmo" se quiser trabalhá-lo do jeito que está.',
      });
      return;
    }
    next(err);
  }
});

// POST /api/mira/alvos/:id/arquivar — descarta um Alvo da fila
router.post('/alvos/:id/arquivar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await prisma.miraAlvo.updateMany({
      where: { id: req.params.id, organizationId: req.organizationId! },
      data: { status: 'ARCHIVED' },
    });
    if (r.count === 0) {
      res.status(404).json({ success: false, error: 'alvo_not_found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── Telemetria (aba Mira Prospects no /analytics) ──────────────────

// GET /api/mira/analytics?period=30 — funil, cota, qualidade das fontes, conversão
router.get('/analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = Math.min(Math.max(Number((req.query as any).period) || 30, 1), 365);
    const data = await computeMiraAnalytics(req.organizationId!, period);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ── Campanhas de prospecção ────────────────────────────────────────

// GET /api/mira/campanhas/semente?kind=B2B — o que o wizard mostra já
// preenchido: os alvos e as regiões que a org declarou no Perfil. O cliente
// tira ou soma antes de disparar; o que ficar na tela é o que roda.
router.get('/campanhas/semente', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const kind = (req.query as any).kind === 'B2C' ? 'B2C' : 'B2B';
    const data = await sementeDaBusca(req.organizationId!, kind);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /api/mira/campanhas — gestão no hub: cada disparo dos motores com
// nome, parâmetros, resultado e quantos Alvos criou/qualificou.
router.get('/campanhas', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const take = Math.min(Number((req.query as any).take) || 30, 100);
    const data = await listarCampanhas(req.organizationId!, take);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ── Perfil de Prospecção (Motor 0) ─────────────────────────────────

// GET /api/mira/perfil — o ICP da org (ou null antes do survey)
router.get('/perfil', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const perfil = await (prisma as any).miraPerfil.findUnique({
      where: { organizationId: req.organizationId! },
    });
    res.json({ success: true, data: perfil });
  } catch (err) {
    next(err);
  }
});

// PUT /api/mira/perfil — upsert do ICP (survey salva por etapas)
router.put('/perfil', validate(perfilSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body as PerfilInput;
    const prontidao = computePerfilProntidao(data);
    const perfil = await prisma.miraPerfil.upsert({
      where: { organizationId: req.organizationId! },
      create: { organizationId: req.organizationId!, ...data, prontidao },
      update: { ...data, prontidao },
    });
    res.json({ success: true, data: perfil });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/mira/perfil/sugestao — rascunho do perfil a partir do que a org
 * já declarou no cadastro e no Treinar IA.
 *
 * NÃO persiste: devolve sugestão para a tela preencher os campos, que o
 * cliente revisa, edita e só então salva pelo PUT. Escopado em
 * req.organizationId como todo o resto do módulo.
 */
router.post('/perfil/sugestao', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await sugerirPerfil(req.organizationId!);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ── Alvos ──────────────────────────────────────────────────────────

// GET /api/mira/alvos?status=&motor=&q=&take= — fila priorizada
router.get('/alvos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, motor, q, campanhaId } = req.query as {
      status?: string;
      motor?: string;
      q?: string;
      campanhaId?: string;
    };
    const take = Math.min(Number((req.query as any).take) || 100, 200);
    const where: any = { organizationId: req.organizationId! };
    if (status) where.status = status;
    if (motor) where.motor = motor;
    if (campanhaId && campanhaId.trim()) where.campanhaId = campanhaId.trim();
    if (q && q.trim()) {
      where.OR = [
        { nome: { contains: q.trim(), mode: 'insensitive' } },
        { nomeFantasia: { contains: q.trim(), mode: 'insensitive' } },
        { cnpj: { contains: q.replace(/\D/g, '') || q.trim() } },
      ];
    }
    const alvos = await (prisma as any).miraAlvo.findMany({
      where,
      orderBy: [{ miraScore: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
      take,
      select: {
        id: true,
        nome: true,
        nomeFantasia: true,
        kind: true,
        motor: true,
        status: true,
        cnpj: true,
        cnae: true,
        porte: true,
        municipio: true,
        uf: true,
        miraScore: true,
        confianca: true,
        resumo: true,
        janelaEntrada: true,
        contactId: true,
        dealId: true,
        updatedAt: true,
        _count: { select: { decisores: true, demandas: true, releases: true } },
      },
    });
    const ent = await getMiraEntitlement(req.organizationId!);
    res.json({ success: true, data: { alvos, quota: ent.quota, monthKey: ent.monthKey } });
  } catch (err) {
    next(err);
  }
});

// GET /api/mira/alvos/:id — dossiê completo
router.get('/alvos/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alvo = await (prisma as any).miraAlvo.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      include: {
        decisores: { orderBy: { createdAt: 'asc' } },
        demandas: { orderBy: { rank: 'asc' } },
        oportunidades: { orderBy: { rank: 'asc' } },
        incumbentes: true,
        // Ordena pela data do FATO (quando a fonte a mostra), com `createdAt`
        // de desempate: uma matéria de ontem que achamos hoje vale mais no
        // topo que uma de 2024 que achamos ontem.
        // Traz a demanda ligada para o dossiê poder dizer "esta matéria gerou
        // esta demanda" em vez de deixar o vendedor cruzar na cabeça.
        releases: {
          orderBy: [{ dataPublicacao: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
          take: 10,
          include: { demanda: { select: { id: true, descricao: true, rank: true } } },
        },
      },
    });
    if (!alvo) {
      res.status(404).json({ success: false, error: 'alvo_not_found' });
      return;
    }
    // Por que este Alvo não tem plano de ação, na voz da MESMA função que
    // decide isso no motor. Computar de novo no front duplicaria a regra, e
    // duas cópias da mesma regra é a família de bug que mais custou neste
    // módulo (o cron e o botão divergiram exatamente assim).
    res.json({ success: true, data: { ...alvo, planoBloqueadoPor: planoBloqueadoPor(alvo as any) } });
  } catch (err) {
    next(err);
  }
});

// ── Releases dos Alvos ─────────────────────────────────────────────

// GET /api/mira/releases?unread=1 — novidades semanais das contas
router.get('/releases', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const unreadOnly = (req.query as any).unread === '1';
    const where: any = { organizationId: req.organizationId! };
    if (unreadOnly) where.lida = false;
    const releases = await (prisma as any).miraRelease.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { alvo: { select: { id: true, nome: true, miraScore: true } } },
    });
    res.json({ success: true, data: releases });
  } catch (err) {
    next(err);
  }
});

// POST /api/mira/releases/:id/lida — marca como lida
router.post('/releases/:id/lida', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await prisma.miraRelease.updateMany({
      where: { id: req.params.id, organizationId: req.organizationId! },
      data: { lida: true },
    });
    res.json({ success: true, data: { updated: r.count } });
  } catch (err) {
    next(err);
  }
});

export default router;
