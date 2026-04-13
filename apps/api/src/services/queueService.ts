import { Queue, Worker, Job } from 'bullmq';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

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

/** Fila de processamento de respostas da IA (Claude) */
export const aiProcessQueue = new Queue('ai-process', {
  connection,
  defaultJobOptions: {
    attempts: 2,
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
  aiProcessWorker = new Worker(
    'ai-process',
    async (job: Job) => {
      const { conversationId, messageContent, contactId, organizationId } = job.data;
      try {
        logger.info(`[Queue:AIProcess] Processing AI response for conversation ${conversationId}`);

        const { prisma } = await import('@zappiq/database');

        // TODO: importar agentOrchestrator quando estiver pronto
        // const { processMessage } = await import('../agents/agentOrchestrator.js');
        // const aiResponse = await processMessage({ conversationId, messageContent, contactId, organizationId });

        // Placeholder — resposta simulada até integração completa
        const aiResponse = {
          content: '[AI response placeholder — agentOrchestrator pendente]',
          intent: 'general',
          sentiment: 'neutral',
        };

        // Salva resposta da IA como mensagem.
        // status defaults to SENT in schema; the message-send worker is the source
        // of truth for delivery state once the WhatsApp API call succeeds.
        const message = await prisma.message.create({
          data: {
            direction: 'OUTBOUND',
            type: 'TEXT',
            content: aiResponse.content,
            conversationId,
            isFromBot: true,
          },
        });

        // Enfileira envio via WhatsApp
        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          include: { contact: true },
        });

        if (conversation?.contact?.whatsappId) {
          await messageSendQueue.add('send', {
            messageId: message.id,
            conversationId,
            content: aiResponse.content,
            to: conversation.contact.whatsappId,
          });
        }

        // Emite evento via Socket.io (se disponível via variável global)
        // O Socket.io é acessado via app.get('io') nas rotas — aqui usamos evento do worker
        logger.info(`[Queue:AIProcess] AI response saved for conversation ${conversationId}, message ${message.id}`);

        return { success: true, messageId: message.id, intent: aiResponse.intent };
      } catch (error) {
        logger.error(`[Queue:AIProcess] Failed to process AI for conversation ${conversationId}:`, error);
        throw error;
      }
    },
    {
      connection,
      concurrency: 10,
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
  const workers = [
    { name: 'messageSend', worker: messageSendWorker },
    { name: 'campaignDispatch', worker: campaignDispatchWorker },
    { name: 'aiProcess', worker: aiProcessWorker },
    { name: 'audioTranscription', worker: audioTranscriptionWorker },
    { name: 'sentimentAnalysis', worker: sentimentAnalysisWorker },
  ];

  for (const { name, worker } of workers) {
    worker.on('completed', (job) => {
      logger.debug(`[Queue:${name}] Job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
      logger.error(`[Queue:${name}] Job ${job?.id} failed: ${err.message}`);
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

  logger.info('[Queues] All BullMQ workers initialized successfully');
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
