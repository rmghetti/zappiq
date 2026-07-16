/**
 * CRM Automation Service (CRM sinérgico — Onda 1)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Objetivo: a IA preenche o CRM sozinha. A cada turno processado pelo
 * agentOrchestrator, sincronizamos o contato com o pipeline de vendas:
 *   - 1º toque  → marca firstTouchAt + registra CONTACT_CREATED no feed +
 *                 move NEW → CONTACTED.
 *   - intent    → ajusta leadStatus + funnelStage + leadScore (0-100) e grava
 *                 STAGE_CHANGE / LEAD_SCORE_CHANGE na timeline (Activity).
 *   - purchase_intent → garante um Deal aberto, move pro estágio "Proposta" do
 *                 pipeline da org e cria uma Task de follow-up (dedupada).
 *
 * Tudo fail-soft: chamado dentro de try/catch no orquestrador; nunca bloqueia a
 * resposta ao cliente. Roda DEPOIS do envio da resposta.
 *
 * Diferencial (ver pesquisa CRM): CRM preenchido com dado limpo capturado na
 * origem da conversa — resolve o problema nº1 do mercado (CRM sujo).
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';

type IzaIntent = 'handoff' | 'objection' | 'enterprise' | 'purchase_intent' | 'normal';

interface SyncInput {
  organizationId: string;
  contactId: string;
  conversationId?: string;
  intent: IzaIntent;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Sincroniza o contato com o pipeline a partir do intent classificado no turno.
 * Idempotente o suficiente pra rodar a cada mensagem sem poluir a timeline.
 */
export async function syncContactToCrm(input: SyncInput): Promise<void> {
  const { organizationId, contactId, conversationId, intent } = input;
  const now = new Date();

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: {
      id: true, leadStatus: true, leadScore: true, funnelStage: true, firstTouchAt: true,
      name: true, phone: true, sourceCampaignId: true,
    },
  });
  if (!contact) return;

  const isFirstTouch = !contact.firstTouchAt;
  let leadStatus = contact.leadStatus as string;
  let funnelStage = contact.funnelStage;
  let scoreDelta = 0;

  // Atividades a registrar na timeline (feed). Mensagens NÃO entram aqui
  // (já vivem na tabela messages); o feed guarda só eventos de CRM.
  const activities: Array<{ type: string; title: string; body?: string }> = [];

  if (isFirstTouch) {
    activities.push({ type: 'CONTACT_CREATED', title: 'Contato criado a partir da conversa' });
    if (leadStatus === 'NEW') {
      leadStatus = 'CONTACTED';
      funnelStage = 'contatado';
      scoreDelta += 5;
    }
  }

  switch (intent) {
    case 'purchase_intent':
      if (leadStatus !== 'CONVERTED') leadStatus = 'QUALIFIED';
      funnelStage = 'proposta';
      scoreDelta += 30;
      break;
    case 'objection':
      if (leadStatus === 'NEW') { leadStatus = 'CONTACTED'; }
      if (funnelStage === 'new') funnelStage = 'contatado';
      scoreDelta += 10;
      break;
    case 'handoff':
    case 'enterprise':
      scoreDelta += 15;
      break;
    default:
      // 'normal': leve sinal de engajamento (não polui o feed).
      scoreDelta += 1;
  }

  const newScore = Math.min(100, (contact.leadScore || 0) + scoreDelta);
  const stageChanged = funnelStage !== contact.funnelStage || leadStatus !== (contact.leadStatus as string);

  await prisma.contact.update({
    where: { id: contactId },
    data: {
      leadStatus: leadStatus as any,
      funnelStage,
      leadScore: newScore,
      lastTouchAt: now,
      ...(isFirstTouch ? { firstTouchAt: now } : {}),
    },
  });

  if (stageChanged) {
    activities.push({
      type: 'STAGE_CHANGE',
      title: `Estágio: ${contact.funnelStage} → ${funnelStage}`,
      body: `Status do lead: ${contact.leadStatus} → ${leadStatus} (sinal: ${intent})`,
    });
  }
  // Só registra mudança de score no feed quando é um sinal relevante (>= 10),
  // pra não poluir com os +1 de engajamento de cada mensagem normal.
  if (newScore !== contact.leadScore && scoreDelta >= 10) {
    activities.push({ type: 'LEAD_SCORE_CHANGE', title: `Lead score: ${contact.leadScore} → ${newScore}` });
  }

  for (const a of activities) {
    await prisma.activity.create({
      data: {
        type: a.type as any,
        actor: 'AI' as any,
        title: a.title,
        body: a.body ?? null,
        contactId,
        conversationId: conversationId ?? null,
        organizationId,
      },
    });
  }

  if (intent === 'purchase_intent') {
    await ensureDealAndFollowUp({
      organizationId,
      contactId,
      conversationId,
      contactLabel: contact.name || contact.phone || 'contato',
      // W2.8 — propaga a origem de campanha do contato pro deal, pra a página
      // de atribuição enxergar receita/ROI por campanha.
      sourceCampaignId: contact.sourceCampaignId ?? null,
    });
  }
}

/**
 * Garante um Deal aberto para o contato, move-o pro estágio "Proposta" do
 * pipeline da org e cria uma Task de follow-up (dedupada por deal+PENDING).
 */
async function ensureDealAndFollowUp(args: {
  organizationId: string;
  contactId: string;
  conversationId?: string;
  contactLabel: string;
  sourceCampaignId?: string | null;
}): Promise<void> {
  const { organizationId, contactId, conversationId, contactLabel, sourceCampaignId } = args;

  // Estágio-alvo: "Proposta" da org; fallback = último estágio não-ganho/perdido.
  const stage =
    (await prisma.pipelineStage.findFirst({ where: { organizationId, name: 'Proposta' } })) ||
    (await prisma.pipelineStage.findFirst({
      where: { organizationId, isWon: false, isLost: false },
      orderBy: { order: 'desc' },
    }));

  let deal = await prisma.deal.findFirst({
    where: { contactId, organizationId, wonAt: null, lostAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!deal) {
    deal = await prisma.deal.create({
      data: {
        title: `Oportunidade — ${contactLabel}`,
        stage: 'proposal',
        stageId: stage?.id ?? null,
        contactId,
        organizationId,
        // W2.8 — herda a atribuição de campanha do contato (se houver).
        ...(sourceCampaignId ? { sourceCampaignId } : {}),
      },
    });
    await prisma.activity.create({
      data: {
        type: 'DEAL_CREATED' as any,
        actor: 'AI' as any,
        title: 'Oportunidade criada (intenção de compra detectada)',
        contactId,
        dealId: deal.id,
        conversationId: conversationId ?? null,
        organizationId,
      },
    });
  } else if (stage && deal.stageId !== stage.id) {
    await prisma.deal.update({ where: { id: deal.id }, data: { stage: 'proposal', stageId: stage.id } });
    await prisma.activity.create({
      data: {
        type: 'STAGE_CHANGE' as any,
        actor: 'AI' as any,
        title: `Negócio movido para ${stage.name}`,
        contactId,
        dealId: deal.id,
        conversationId: conversationId ?? null,
        organizationId,
      },
    });
  }

  // Follow-up: só cria se não houver task PENDING pro deal (dedupe).
  const pending = await prisma.task.findFirst({ where: { dealId: deal.id, status: 'PENDING' } });
  if (!pending) {
    await prisma.task.create({
      data: {
        title: 'Follow-up: fechar a venda',
        description: 'Cliente demonstrou intenção de compra. Enviar proposta/link e acompanhar até o fechamento.',
        status: 'PENDING' as any,
        dueDate: new Date(Date.now() + DAY_MS),
        contactId,
        dealId: deal.id,
        // A conversa que motivou o follow-up: o TaskPanel já tinha o link "ver
        // a conversa" pronto na intenção, o dado só nunca foi persistido aqui
        // (as Activity vizinhas já usam este mesmo conversationId).
        conversationId: conversationId ?? null,
        organizationId,
      },
    });
    await prisma.activity.create({
      data: {
        type: 'TASK_CREATED' as any,
        actor: 'AI' as any,
        title: 'Tarefa de follow-up criada (fechar a venda)',
        contactId,
        dealId: deal.id,
        conversationId: conversationId ?? null,
        organizationId,
      },
    });
  }

  logger.info('[CRM] syncContactToCrm: purchase_intent processado', { organizationId, contactId, dealId: deal.id });
}
