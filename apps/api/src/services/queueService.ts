import { Queue, Worker, Job } from 'bullmq';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import {
  queueDepth,
  queueOldestJobAge,
  recordQueueJobCompleted,
  recordQueueJobFailed,
} from '../config/metrics.js';

// ── Conexão Redis para BullMQ ────────────────────
// BullMQ requer uma conexão própria (não reutiliza ioredis do app)
const redisUrl = new URL(env.REDIS_URL);
const isTLS = env.REDIS_URL.startsWith('rediss://');
const connection = {
  host: redisUrl.hostname || 'localhost',
  port: Number(redisUrl.port) || 6379,
  password: redisUrl.password || undefined,
  username: redisUrl.username || undefined,
  ...(isTLS ? { tls: { rejectUnauthorized: false } } : {}),
  maxRetriesPerRequest: null,              // BullMQ requirement for workers
  enableReadyCheck: false,                 // avoid LOADING errors on reconnect
  keepAlive: 10_000,                       // ping every 10s — prevents Upstash idle disconnect
  retryStrategy(times: number) {
    if (times > 30) return null;           // give up after 30 retries
    return Math.min(times * 300, 15_000);  // 300ms, 600ms, ... max 15s
  },
  reconnectOnError(err: Error) {
    const retryable = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'READONLY'];
    return retryable.some((e) => err.message.includes(e));
  },
};

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

/** Fila de transcrição de áudio (Whisper API) */
export const audioTranscriptionQueue = new Queue('audio-transcription', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
});

/** Fila de análise de sentimento de conversas */
export const sentimentAnalysisQueue = new Queue('sentiment-analysis', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 2000 },
    removeOnComplete: { count: 2000 },
    removeOnFail: { count: 500 },
  },
});

// ── Workers ──────────────────────────────────────

let messageSendWorker: Worker;
let campaignDispatchWorker: Worker;
let aiProcessWorker: Worker;
let audioTranscriptionWorker: Worker;
let sentimentAnalysisWorker: Worker;

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
      const { messageId, conversationId, content, to } = job.data;
      try {
        logger.info(`[Queue:MessageSend] Sending message ${messageId} to ${to}`);

        // Importação dinâmica para evitar dependência circular
        const { prisma } = await import('@zappiq/database');

        // TODO: Etapa 7 — chamar WhatsApp Cloud API para envio real
        // const response = await whatsappService.sendText(to, content);
        // const whatsappMessageId = response.messages[0].id;

        // Atualiza status da mensagem no banco
        await prisma.message.update({
          where: { id: messageId },
          data: {
            status: 'SENT',
            // whatsappMessageId: response.messages[0].id,
          },
        });

        logger.info(`[Queue:MessageSend] Message ${messageId} sent successfully`);
        return { success: true, messageId };
      } catch (error) {
        logger.error(`[Queue:MessageSend] Failed to send message ${messageId}:`, error);
        throw error;
      }
    },
    {
      connection,
      concurrency: 5,
      limiter: {
        max: 80,
        duration: 1000, // 80 jobs por segundo
      },
    },
  );

  // ── Campaign Dispatch Worker ─────────────────
  campaignDispatchWorker = new Worker(
    'campaign-dispatch',
    async (job: Job) => {
      const { campaignId, organizationId } = job.data;
      try {
        logger.info(`[Queue:CampaignDispatch] Dispatching campaign ${campaignId}`);

        const { prisma } = await import('@zappiq/database');

        // Busca campanha com template
        const campaign = await prisma.campaign.findUnique({
          where: { id: campaignId },
          include: { template: true },
        });

        if (!campaign) {
          throw new Error(`Campaign ${campaignId} not found`);
        }

        // Busca contatos da organização (filtro de audiência pode ser aplicado aqui).
        // Marketing campaigns require explicit LGPD consent (consentMarketing).
        const contacts = await prisma.contact.findMany({
          where: {
            organizationId,
            consentMarketing: true,
          },
          select: { id: true, whatsappId: true, name: true },
        });

        logger.info(`[Queue:CampaignDispatch] Found ${contacts.length} contacts for campaign ${campaignId}`);

        // Enfileira mensagens individuais em lotes de 50
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
              content: campaign.template?.bodyText || '',
              organizationId,
            },
          }));

          await messageSendQueue.addBulk(jobs);
          enqueued += batch.length;

          // Atualiza progresso
          await job.updateProgress(Math.round((enqueued / contacts.length) * 100));
        }

        // Atualiza estatísticas da campanha
        await prisma.campaign.update({
          where: { id: campaignId },
          data: {
            sentCount: contacts.length,
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });

        logger.info(`[Queue:CampaignDispatch] Campaign ${campaignId} dispatched: ${enqueued} messages enqueued`);
        return { success: true, totalEnqueued: enqueued };
      } catch (error) {
        logger.error(`[Queue:CampaignDispatch] Failed to dispatch campaign ${campaignId}:`, error);

        // Marca campanha como falha
        try {
          const { prisma } = await import('@zappiq/database');
          await prisma.campaign.update({
            where: { id: campaignId },
            data: { status: 'CANCELLED' },
          });
        } catch (_) { /* melhor esforço */ }

        throw error;
      }
    },
    {
      connection,
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
        // io não é serializável via Redis — worker não recebe Socket.io.
        // agentOrchestrator usa io só pra notification UI (dashboard interno
        // do operador). Em background processing, o caminho do WhatsApp
        // (resposta ao cliente) é o crítico — Socket.io é cosmético aqui.
        // Onda 3 follow-up: emit via Redis pub/sub se UI precisar live.
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
          io: undefined,
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
      concurrency: aiConcurrency,
    },
  );

  // ── Audio Transcription Worker ───────────────
  // Placeholder — integração com Whisper API será implementada futuramente
  audioTranscriptionWorker = new Worker(
    'audio-transcription',
    async (job: Job) => {
      const { messageId, audioUrl, organizationId } = job.data;
      try {
        logger.info(`[Queue:AudioTranscription] Transcribing audio for message ${messageId} (URL: ${audioUrl})`);

        // TODO: Etapa futura — integrar com OpenAI Whisper API
        // const transcription = await openai.audio.transcriptions.create({
        //   file: audioStream,
        //   model: 'whisper-1',
        //   language: 'pt',
        // });

        logger.info(`[Queue:AudioTranscription] Placeholder — transcription not yet implemented for message ${messageId}`);
        return { success: true, messageId, transcription: null };
      } catch (error) {
        logger.error(`[Queue:AudioTranscription] Failed to transcribe message ${messageId}:`, error);
        throw error;
      }
    },
    {
      connection,
      concurrency: 3,
    },
  );

  // ── Sentiment Analysis Worker ────────────────
  // Placeholder — classificação de sentimento via Claude Haiku
  sentimentAnalysisWorker = new Worker(
    'sentiment-analysis',
    async (job: Job) => {
      const { conversationId, messageContent, organizationId } = job.data;
      try {
        logger.info(`[Queue:SentimentAnalysis] Analyzing sentiment for conversation ${conversationId}`);

        // TODO: Etapa futura — classificar sentimento via Claude Haiku
        // const sentiment = await anthropic.messages.create({
        //   model: 'claude-haiku',
        //   messages: [{ role: 'user', content: `Classify sentiment: ${messageContent}` }],
        // });

        logger.info(`[Queue:SentimentAnalysis] Placeholder — sentiment analysis not yet implemented for conversation ${conversationId}`);
        return { success: true, conversationId, sentiment: 'neutral' };
      } catch (error) {
        logger.error(`[Queue:SentimentAnalysis] Failed sentiment analysis for conversation ${conversationId}:`, error);
        throw error;
      }
    },
    {
      connection,
      concurrency: 5,
    },
  );

  // ── Eventos globais dos workers ──────────────
  // V2-023 (Sprint 0 Blocker 2): registro OTel em cada job completed/failed
  // pra dashboard de fail rate e job duration p95 em Grafana.
  const workers = [
    { name: 'messageSend', queueName: 'message-send', worker: messageSendWorker },
    { name: 'campaignDispatch', queueName: 'campaign-dispatch', worker: campaignDispatchWorker },
    { name: 'aiProcess', queueName: 'ai-process', worker: aiProcessWorker },
    { name: 'audioTranscription', queueName: 'audio-transcription', worker: audioTranscriptionWorker },
    { name: 'sentimentAnalysis', queueName: 'sentiment-analysis', worker: sentimentAnalysisWorker },
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
    { name: 'audio-transcription', queue: audioTranscriptionQueue },
    { name: 'sentiment-analysis', queue: sentimentAnalysisQueue },
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
    audioTranscriptionWorker,
    sentimentAnalysisWorker,
  ].filter(Boolean);

  await Promise.allSettled(workers.map((w) => w.close()));

  const queues = [
    messageSendQueue,
    campaignDispatchQueue,
    aiProcessQueue,
    audioTranscriptionQueue,
    sentimentAnalysisQueue,
  ];

  await Promise.allSettled(queues.map((q) => q.close()));
  logger.info('[Queues] All workers and queues closed');
}
