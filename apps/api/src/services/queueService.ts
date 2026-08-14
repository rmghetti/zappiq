import { Queue, Worker, Job } from 'bullmq';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import {
  queueDepth,
  queueOldestJobAge,
  recordQueueJobCompleted,
  recordQueueJobFailed,
} from '../config/metrics.js';
import { resolveAudienceWhere } from './impulsoAudience.js';
import { resolveCampaignMessage } from './impulsoChannels.js';
import { resolveCampaignSend, buildTemplateComponents, type TemplateVariable } from './impulsoTemplateSend.js';
import { queueConnection as connection, IDLE_DRAIN_DELAY_SECONDS } from '../config/queueRedis.js';

// ── Conexão Redis para BullMQ ────────────────────
// BullMQ requer uma conexão própria (não reutiliza ioredis do app)

// ── Filas (Queues) ───────────────────────────────

/** Fila de envio de mensagens via WhatsApp API — rate limit 80/seg */
export const messageSendQueue = new Queue('message-send', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 5000 },
    removeOnFail: { count: 2000 },
  },
});

/** Fila de despacho de campanhas — enfileira mensagens individuais em lotes */
export const campaignDispatchQueue = new Queue('campaign-dispatch', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 5000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 200 },
  },
});

/** Fila de processamento de respostas da IA (Claude).
 * V2-023 (Sprint 0 Blocker 2): caminho de produção da Iza. Webhook
 * apenas enfileira aqui — worker abaixo consome chamando o orchestrator.
 *
 * Política:
 *   - 3 tentativas com exponential backoff (3s, 6s, 12s)
 *   - removeOnFail mantém 2000 últimas falhas pra inspeção (~deadletter
 *     em memória; BullMQ não tem DLQ separada, falhas ficam em "failed" set)
 *   - removeOnComplete mantém 5000 últimas pra retro de cost-per-tenant
 */
export const aiProcessQueue = new Queue('ai-process', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { count: 5000 },
    removeOnFail: { count: 2000 },
  },
});

// ── Job handlers (exportados pra teste unitário) ──
// W1.1: o envio real via WhatsApp/Instagram acontece aqui, reusando
// channelDispatcher.sendReplyText — MESMO caminho que o agentOrchestrator
// usa pra IA (resolve canal + credenciais por org a partir da conversa).
// Antes, este handler era um STUB que marcava SENT sem enviar nada, então
// resposta humana do inbox e broadcast de campanha nunca saíam de fato.

/** Shape mínimo do payload aceito pelo message-send worker. */
export interface MessageSendJobData {
  /** Presente no caminho do inbox humano (messages.ts). */
  messageId?: string;
  /** Presente no inbox humano; resolvido do message no caminho de campanha. */
  conversationId?: string;
  /** Presente no caminho de campanha (campaigns.ts → campaignDispatch). */
  campaignId?: string;
  contactId?: string;
  organizationId?: string;
  content: string;
  to?: string;
  /**
   * Presente só no caminho de campanha quando a campanha usa um template da Meta
   * APROVADO com mapa de variáveis válido (ou sem variáveis): o envio sai como
   * template (vale fora da janela de 24h). As variáveis são resolvidas por
   * contato no envio. Se ausente, envia texto livre (comportamento padrão).
   */
  template?: { name: string; language: string; bodyText: string; variables: TemplateVariable[] };
}

/**
 * Processa um job de envio de mensagem outbound.
 *
 * Resolve org + conversa e delega o envio real ao channelDispatcher
 * (mesma função da IA). Em sucesso, grava o externalMessageId e marca a
 * mensagem SENT. Em falha, marca FAILED com o erro e relança pra BullMQ
 * fazer retry — nunca marca SENT às cegas.
 *
 * Retorna o externalMessageId quando disponível.
 */
export async function processMessageSendJob(
  data: MessageSendJobData,
): Promise<{ success: true; messageId: string; externalMessageId?: string }> {
  const { prisma } = await import('@zappiq/database');
  const { sendReplyText, sendReplyTemplate } = await import('./channelDispatcher.js');

  // ── 1. Resolve messageId, conversationId e organizationId ─────────
  // Inbox humano: chega com messageId + conversationId, mas sem organizationId.
  // Campanha: chega com organizationId + contactId + content, sem message/conversa.
  let messageId = data.messageId ?? null;
  let conversationId = data.conversationId ?? null;
  let organizationId = data.organizationId ?? null;

  if (messageId) {
    // Caminho inbox humano — carrega a mensagem pra pegar org/conversa reais.
    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        conversationId: true,
        conversation: { select: { organizationId: true } },
      },
    });
    if (!msg) {
      throw new Error(`[MessageSend] Message ${messageId} not found`);
    }
    conversationId = msg.conversationId;
    organizationId = msg.conversation.organizationId;
  } else {
    // Caminho campanha — sem message/conversa ainda. Precisa de org + contato.
    if (!organizationId || !data.contactId) {
      throw new Error(
        '[MessageSend] Campaign job sem organizationId/contactId — não é possível enviar',
      );
    }
    // Get-or-create conversa aberta do contato (mesmo padrão do webhook inbound).
    let conversation = await prisma.conversation.findFirst({
      where: {
        contactId: data.contactId,
        organizationId,
        status: { in: ['OPEN', 'WAITING', 'ASSIGNED'] },
      },
      select: { id: true },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          contactId: data.contactId,
          organizationId,
          status: 'OPEN',
          channel: 'whatsapp',
        },
        select: { id: true },
      });
    }
    conversationId = conversation.id;
    // Cria a mensagem OUTBOUND da campanha pra rastrear status (SENT/FAILED).
    // W2.4: grava campaignId como COLUNA (FK), não só metadata — habilita os
    // contadores reais delivered/read via webhook de status da Meta, que resolve
    // a campanha a partir da Message pelo whatsappMessageId.
    const created = await prisma.message.create({
      data: {
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: data.content,
        status: 'SENT', // provisório; ajustado após o envio real abaixo
        conversationId,
        isFromBot: false,
        ...(data.campaignId ? { campaignId: data.campaignId } : {}),
      },
      select: { id: true },
    });
    messageId = created.id;
  }

  if (!organizationId || !conversationId || !messageId) {
    throw new Error('[MessageSend] Não foi possível resolver org/conversa/mensagem');
  }

  // ── 2. Envio real via channelDispatcher (mesmo caminho da IA) ─────
  try {
    // Campanha com template aprovado sem variável → envia como TEMPLATE (vale
    // fora da janela de 24h). Qualquer erro no caminho de template cai de volta
    // pra texto livre: nunca fica pior que o comportamento anterior.
    let result;
    if (data.template) {
      try {
        // Resolve as variáveis {{N}} para este contato (nome, empresa) e monta
        // os components da Meta. Sem variáveis, components fica vazio.
        let components: any[] = [];
        if (data.template.variables?.length) {
          const contact = data.contactId
            ? await prisma.contact.findUnique({
                where: { id: data.contactId },
                select: { name: true, company: true },
              })
            : null;
          components = buildTemplateComponents(data.template.bodyText, data.template.variables, contact ?? {});
        }
        result = await sendReplyTemplate({
          organizationId,
          conversationId,
          templateName: data.template.name,
          languageCode: data.template.language,
          components,
        });
      } catch (tplErr) {
        logger.warn(
          `[MessageSend] envio como template "${data.template.name}" falhou, caindo pra texto`,
          { err: String(tplErr) },
        );
        result = await sendReplyText({ organizationId, conversationId, content: data.content });
      }
    } else {
      result = await sendReplyText({ organizationId, conversationId, content: data.content });
    }

    // ── 3. Sucesso: grava externalMessageId + marca SENT ────────────
    await prisma.message.update({
      where: { id: messageId },
      data: {
        status: 'SENT',
        ...(result.externalMessageId
          ? result.channel === 'instagram'
            ? { externalMessageId: result.externalMessageId }
            : { whatsappMessageId: result.externalMessageId }
          : {}),
      },
    });

    // ── 3c. W2.4: contador REAL de envio da campanha ────────────────
    // sentCount só cresce quando a mensagem SAIU de fato (aqui), não no
    // enfileiramento. delivered/read chegam depois via webhook de status.
    if (data.campaignId) {
      await bumpCampaignCounter(prisma, data.campaignId, 'sentCount');
    }

    logger.info(
      `[Queue:MessageSend] Message ${messageId} sent via ${result.channel} (extId=${result.externalMessageId ?? 'n/a'})`,
    );
    return { success: true, messageId, externalMessageId: result.externalMessageId };
  } catch (error) {
    // ── 3b. Falha: marca FAILED com o erro; relança pra BullMQ retry ──
    logger.error(`[Queue:MessageSend] Failed to send message ${messageId}:`, error);
    try {
      await prisma.message.update({
        where: { id: messageId },
        data: {
          status: 'FAILED',
          metadata: {
            sendError: error instanceof Error ? error.message : String(error),
          },
        },
      });
      // W2.4: contador REAL de falha da campanha (best-effort).
      if (data.campaignId) {
        await bumpCampaignCounter(prisma, data.campaignId, 'failedCount');
      }
    } catch (updateErr) {
      logger.error(`[Queue:MessageSend] Também falhou ao marcar FAILED ${messageId}:`, updateErr);
    }
    throw error;
  }
}

/**
 * Incrementa (atomicamente) um contador da campanha. Best-effort: nunca
 * derruba o envio se a campanha sumiu (deleteMany durante o disparo).
 * W2.4 — usado pelo dispatch (sentCount/failedCount) e webhook (delivered/read).
 */
export async function bumpCampaignCounter(
  prisma: any,
  campaignId: string,
  field: 'sentCount' | 'deliveredCount' | 'readCount' | 'repliedCount' | 'failedCount',
  by = 1,
): Promise<void> {
  try {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { [field]: { increment: by } },
    });
  } catch (err) {
    logger.warn(`[Campaign] Falha ao incrementar ${field} da campanha ${campaignId}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Despacha uma campanha: resolve audiência (contatos com consentMarketing),
 * enfileira uma mensagem por contato na message-send queue e transiciona o
 * status. W2.4 — os contadores REAIS (sentCount/failedCount) são incrementados
 * pelo processMessageSendJob quando cada envio de fato sai; delivered/read
 * chegam depois via webhook de status da Meta. Por isso aqui NÃO setamos mais
 * sentCount=contatos no enfileiramento (era o contador falso).
 *
 * Exportado pra teste unitário.
 */
export async function dispatchCampaignJob(
  data: { campaignId: string; organizationId: string },
  onProgress?: (pct: number) => unknown,
): Promise<{ success: true; totalEnqueued: number }> {
  const { campaignId, organizationId } = data;
  const { prisma } = await import('@zappiq/database');
  try {
    logger.info(`[Queue:CampaignDispatch] Dispatching campaign ${campaignId}`);

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { template: true },
    });
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    // Audiência: contatos da org com consentimento LGPD de marketing,
    // recortados pelo audienceSegment da campanha (Impulso) quando houver.
    // resolveAudienceWhere sempre reforça organizationId + consentMarketing,
    // o segmento não consegue desligar esse piso de segurança.
    const { where: audienceWhere, take: audienceTake } = resolveAudienceWhere(
      organizationId,
      campaign.audienceSegment,
      new Date(),
    );
    const contacts = await prisma.contact.findMany({
      where: audienceWhere,
      select: { id: true, whatsappId: true, name: true },
      ...(audienceTake !== undefined ? { take: audienceTake } : {}),
    });
    logger.info(`[Queue:CampaignDispatch] Found ${contacts.length} contacts for campaign ${campaignId}`);

    // W2.4: zera contadores e marca SENDING no início do disparo — os
    // contadores reais crescem à medida que os envios saem.
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'SENDING',
        sentCount: 0,
        deliveredCount: 0,
        readCount: 0,
        repliedCount: 0,
        failedCount: 0,
        completedAt: null,
      },
    });

    // Decide UMA vez como a campanha vai (texto ou template aprovado sem
    // variável). Como o caminho de template exige corpo fixo, o plano é o mesmo
    // pra todos os contatos. Fora desse caso, cai em texto (sem regressão).
    const sendPlan = resolveCampaignSend(campaign as any, 'whatsapp');
    const templateData =
      sendPlan.kind === 'template'
        ? {
            name: sendPlan.templateName,
            language: sendPlan.languageCode,
            bodyText: sendPlan.bodyText,
            variables: sendPlan.variables,
          }
        : undefined;
    if (templateData) {
      logger.info(
        `[Queue:CampaignDispatch] Campaign ${campaignId} usa template aprovado "${templateData.name}" (${templateData.variables.length} variáveis; envio fora da janela de 24h habilitado)`,
      );
    }

    const batchSize = 50;
    let enqueued = 0;
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      const jobs = batch.map((contact) => ({
        name: 'send',
        data: {
          campaignId,
          contactId: contact.id,
          to: contact.whatsappId,
          // Texto que vai de fato: a copy salva/editada pelo cliente (por canal)
          // vence; sem ela, cai no bodyText do template legado.
          content: sendPlan.content,
          organizationId,
          ...(templateData ? { template: templateData } : {}),
        },
      }));
      await messageSendQueue.addBulk(jobs);
      enqueued += batch.length;
      if (contacts.length > 0) {
        await onProgress?.(Math.round((enqueued / contacts.length) * 100));
      }
    }

    // Enfileiramento concluído → COMPLETED. sentCount/failedCount refletem os
    // envios REAIS (incrementados no message-send worker), não este número.
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    logger.info(`[Queue:CampaignDispatch] Campaign ${campaignId} dispatched: ${enqueued} messages enqueued`);
    return { success: true, totalEnqueued: enqueued };
  } catch (error) {
    logger.error(`[Queue:CampaignDispatch] Failed to dispatch campaign ${campaignId}:`, error);
    try {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'CANCELLED' },
      });
    } catch (_) { /* melhor esforço */ }
    throw error;
  }
}

// ── Workers ──────────────────────────────────────

let messageSendWorker: Worker;
let campaignDispatchWorker: Worker;
let aiProcessWorker: Worker;

/**
 * Inicializa todos os workers das filas.
 * Deve ser chamada após o Socket.io estar pronto.
 */
export async function initQueues(): Promise<void> {
  logger.info('[Queues] Initializing BullMQ workers...');

  // ── Message Send Worker ──────────────────────
  // Rate limit: 80 mensagens por segundo (limite Meta WhatsApp Business API)
  messageSendWorker = new Worker(
    'message-send',
    async (job: Job) => {
      const data = job.data as MessageSendJobData;
      const ref = data.messageId ?? data.campaignId ?? 'unknown';
      logger.info(`[Queue:MessageSend] Sending message ref=${ref} to ${data.to ?? '?'}`);
      // Envio real + persistência de status/externalMessageId centralizados
      // em processMessageSendJob (reusa channelDispatcher, testável isolado).
      // Erros relançam aqui pra BullMQ aplicar retry (3 tentativas c/ backoff).
      return processMessageSendJob(data);
    },
    {
      connection,
      drainDelay: IDLE_DRAIN_DELAY_SECONDS,
      concurrency: 5,
      limiter: {
        max: 80,
        duration: 1000, // 80 jobs por segundo
      },
    },
  );

  // ── Campaign Dispatch Worker ─────────────────
  // W2.4: lógica extraída pra dispatchCampaignJob (testável isolado).
  campaignDispatchWorker = new Worker(
    'campaign-dispatch',
    async (job: Job) => dispatchCampaignJob(job.data, (p) => job.updateProgress(p)),
    {
      connection,
      drainDelay: IDLE_DRAIN_DELAY_SECONDS,
      concurrency: 2,
    },
  );

  // ── AI Process Worker ────────────────────────
  // V2-023 (Sprint 0 Blocker 2): caminho de produção da Iza.
  // Webhook enfileira → este worker consome → chama agentOrchestrator
  // (que internamente usa LLMRouter com cascade Sonnet→Haiku→GPT-4o-mini).
  //
  // Concorrência via env (BULLMQ_LLM_CONCURRENCY, default 10) — permite
  // tunar pra capacidade do Fly sem deploy.
  //
  // Retry: 3 attempts com exponential backoff (3s, 6s, 12s) — config no
  // defaultJobOptions da queue.
  //
  // Idempotência: jobId = `wamid:${whatsappMessageId}` (setado no webhook).
  // Se Meta reenviar o mesmo webhook (timeout), BullMQ ignora dup.
  const aiConcurrency = parseInt(process.env.BULLMQ_LLM_CONCURRENCY || '10', 10);
  aiProcessWorker = new Worker(
    'ai-process',
    async (job: Job) => {
      const data = job.data as {
        organizationId: string;
        conversationId: string;
        contactId: string;
        contactPhone: string;
        contactName: string;
        messageContent: string;
        messageType: string;
        whatsappMessageId?: string;
        // FASE 4 (#251) — channel-aware. Default 'whatsapp' pra retro compat.
        channel?: 'whatsapp' | 'instagram' | 'web';
        // FASE 4 — externalMessageId polimórfico (IG mid, web msg id, etc).
        // whatsappMessageId continua válido pra retro compat dos jobs existentes.
        externalMessageId?: string;
        instagramScopedId?: string;
        orgSettings: any;
        // V4 #156 — mediaId pra Whisper STT (audio inbound)
        mediaId?: string | null;
      };

      const messageRef = data.whatsappMessageId || data.externalMessageId || 'unknown';
      logger.info(`[Queue:AIProcess] Processing channel=${data.channel || 'whatsapp'} mid=${messageRef} attempt=${job.attemptsMade + 1}`);
      const t0 = Date.now();

      try {
        const { processIncomingMessage } = await import('../agents/agentOrchestrator.js');
        // W2.1: io não é serializável via Redis, mas o worker roda no MESMO
        // processo do Socket.io server. Recupera a instância pelo singleton de
        // módulo (setado em server.ts) pra que new_message/notification cheguem
        // ao inbox em tempo real. Antes passávamos io: undefined e a UI só
        // atualizava com F5. getIo() é undefined-safe (emits gated por if(io)).
        const { getIo } = await import('../utils/socketRegistry.js');
        await processIncomingMessage({
          organizationId: data.organizationId,
          conversationId: data.conversationId,
          contactId: data.contactId,
          contactPhone: data.contactPhone,
          contactName: data.contactName,
          messageContent: data.messageContent,
          messageType: data.messageType,
          // FASE 4: ambos compatíveis. WhatsApp passa whatsappMessageId,
          // Instagram passa externalMessageId — orchestrator usa o que tiver.
          whatsappMessageId: data.whatsappMessageId || data.externalMessageId || '',
          channel: data.channel || 'whatsapp',
          orgSettings: data.orgSettings,
          mediaId: data.mediaId ?? null, // V4 #156
          io: getIo(),
        });

        const elapsed = Date.now() - t0;
        logger.info(`[Queue:AIProcess] Completed channel=${data.channel || 'whatsapp'} mid=${messageRef} in ${elapsed}ms`);
        return { success: true, conversationId: data.conversationId, latencyMs: elapsed, channel: data.channel || 'whatsapp' };
      } catch (error) {
        const elapsed = Date.now() - t0;
        logger.error(`[Queue:AIProcess] Failed channel=${data.channel || 'whatsapp'} mid=${messageRef} attempt=${job.attemptsMade + 1} after ${elapsed}ms:`, error);
        throw error; // BullMQ retry kicks in (3 tentativas com backoff exponencial)
      }
    },
    {
      connection,
      drainDelay: IDLE_DRAIN_DELAY_SECONDS,
      concurrency: aiConcurrency,
    },
  );

  // ── Eventos globais dos workers ──────────────
  // V2-023 (Sprint 0 Blocker 2): registro OTel em cada job completed/failed
  // pra dashboard de fail rate e job duration p95 em Grafana.
  const workers = [
    { name: 'messageSend', queueName: 'message-send', worker: messageSendWorker },
    { name: 'campaignDispatch', queueName: 'campaign-dispatch', worker: campaignDispatchWorker },
    { name: 'aiProcess', queueName: 'ai-process', worker: aiProcessWorker },
  ];

  for (const { name, queueName, worker } of workers) {
    worker.on('completed', (job) => {
      const durationMs = (job.finishedOn ?? Date.now()) - (job.timestamp ?? Date.now());
      recordQueueJobCompleted({
        queue: queueName,
        durationSeconds: durationMs / 1000,
        attempts: job.attemptsMade,
      });
      logger.debug(`[Queue:${name}] Job ${job.id} completed in ${durationMs}ms (attempts=${job.attemptsMade})`);
    });

    worker.on('failed', (job, err) => {
      const errorType = classifyJobError(err);
      recordQueueJobFailed({
        queue: queueName,
        attempts: job?.attemptsMade ?? 0,
        errorType,
      });
      logger.error(`[Queue:${name}] Job ${job?.id} failed (attempts=${job?.attemptsMade}, type=${errorType}): ${err.message}`);
    });

    worker.on('error', (err) => {
      // Upstash drops idle connections — ECONNRESET is transient, not fatal
      const isTransient = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT'].some(
        (e) => err.message.includes(e),
      );
      if (isTransient) {
        logger.warn(`[Queue:${name}] Transient Redis error (will reconnect): ${err.message}`);
      } else {
        logger.error(`[Queue:${name}] Worker error: ${err.message}`);
      }
    });
  }

  // ── Observable gauges (depth + oldest job age) ──
  // Polling-based: OTel chama este callback a cada export interval (~60s).
  // Custo é baixo: 5 chamadas getJobCounts() agregadas.
  setupQueueObservableMetrics();

  logger.info('[Queues] All BullMQ workers initialized successfully');
}

// V2-023: classifica erro do worker pra labels de fail_rate por tipo.
function classifyJobError(err: Error): string {
  const msg = err.message.toLowerCase();
  if (msg.includes('rate limit') || msg.includes('429')) return 'rate_limit';
  if (msg.includes('timeout') || err.name === 'AbortError') return 'timeout';
  if (msg.includes('econnreset') || msg.includes('econnrefused')) return 'network';
  if (msg.includes('5')) return 'server_error';
  return 'unknown';
}

// V2-023: registra observable gauges. Chamado uma vez no init.
// O OTel SDK chama o callback a cada exportInterval pra coletar os valores.
function setupQueueObservableMetrics(): void {
  const queues = [
    { name: 'message-send', queue: messageSendQueue },
    { name: 'campaign-dispatch', queue: campaignDispatchQueue },
    { name: 'ai-process', queue: aiProcessQueue },
  ];

  queueDepth.addCallback(async (result) => {
    for (const { name, queue } of queues) {
      try {
        const counts = await queue.getJobCounts('waiting', 'active');
        const total = (counts.waiting ?? 0) + (counts.active ?? 0);
        result.observe(total, { queue: name });
      } catch (err) {
        // Redis transitório — não trava o exporter; valor seguinte pegará
        logger.debug(`[Queue:metrics] depth probe falhou pra ${name}`, { err });
      }
    }
  });

  queueOldestJobAge.addCallback(async (result) => {
    for (const { name, queue } of queues) {
      try {
        const waiting = await queue.getWaiting(0, 0);
        const oldest = waiting[0];
        const ageSec = oldest && oldest.timestamp
          ? Math.max(0, (Date.now() - oldest.timestamp) / 1000)
          : 0;
        result.observe(ageSec, { queue: name });
      } catch (err) {
        logger.debug(`[Queue:metrics] age probe falhou pra ${name}`, { err });
      }
    }
  });
}

/**
 * Encerra todos os workers graciosamente.
 * Deve ser chamada no shutdown do servidor.
 */
export async function closeQueues(): Promise<void> {
  logger.info('[Queues] Closing all workers...');
  const workers = [
    messageSendWorker,
    campaignDispatchWorker,
    aiProcessWorker,
  ].filter(Boolean);

  await Promise.allSettled(workers.map((w) => w.close()));

  const queues = [
    messageSendQueue,
    campaignDispatchQueue,
    aiProcessQueue,
  ];

  await Promise.allSettled(queues.map((q) => q.close()));
  logger.info('[Queues] All workers and queues closed');
}
