/**
 * Maestro v2 — execução de efeitos de fluxo, compartilhada entre o
 * agentOrchestrator (turno inbound) e o flowScheduler (retomada por timer).
 * Extraída do orchestrator sem mudança de comportamento. Fail-soft em tudo.
 */
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { sendReplyText, sendReplyInteractive, sendReplyMedia } from '../services/channelDispatcher.js';
import type { FlowEffect } from './flowEngine.js';

export interface ExecuteEffectsInput {
  organizationId: string;
  conversationId: string;
  contactId: string | null;
  effects: FlowEffect[];
  /** Handler de handoff (precisa de io/orgSettings) — opcional; sem ele, handoff vira log. */
  onHandoff?: () => Promise<void>;
  /**
   * Confiança gravada no Message de send_text. Default 1.0 (trilho fixo
   * determinístico). A retomada por timer em nó-IA passa 0.9 — texto gerado
   * por LLM, não determinístico.
   */
  aiConfidence?: number;
}

export async function executeFlowEffects(input: ExecuteEffectsInput): Promise<void> {
  const { organizationId, conversationId, contactId, effects, onHandoff, aiConfidence = 1.0 } = input;
  for (const eff of effects) {
    if (eff.kind === 'send_text') {
      await sendReplyText({ organizationId, conversationId, content: eff.text });
      await prisma.message.create({
        data: {
          direction: 'OUTBOUND',
          type: 'TEXT',
          content: eff.text,
          status: 'SENT',
          conversationId,
          isFromBot: true,
          aiConfidence, // 1.0 = trilho fixo; <1.0 = texto gerado por LLM (retomada nó-IA)
        },
      });
    } else if (eff.kind === 'send_interactive') {
      try {
        await sendReplyInteractive({ organizationId, conversationId, kind: eff.type, body: eff.body, options: eff.options });
        await prisma.message.create({
          data: {
            direction: 'OUTBOUND', type: 'INTERACTIVE',
            content: eff.body, status: 'SENT', conversationId, isFromBot: true, aiConfidence,
          },
        });
      } catch (e) {
        logger.warn('[Maestro] send_interactive falhou (fail-soft)', { organizationId, conversationId, err: String(e) });
      }
    } else if (eff.kind === 'send_media') {
      try {
        await sendReplyMedia({ organizationId, conversationId, mediaType: eff.mediaType, url: eff.url, caption: eff.caption });
        const typeMap = { image: 'IMAGE', audio: 'AUDIO', document: 'DOCUMENT' } as const;
        await prisma.message.create({
          data: {
            direction: 'OUTBOUND', type: typeMap[eff.mediaType],
            content: eff.caption ?? eff.url, status: 'SENT', conversationId, isFromBot: true, aiConfidence,
          },
        });
      } catch (e) {
        logger.warn('[Maestro] send_media falhou (fail-soft)', { organizationId, conversationId, err: String(e) });
      }
    } else if (eff.kind === 'handoff') {
      if (onHandoff) await onHandoff();
      else logger.info('[Maestro] handoff em retomada por timer — sem handler, ignorado', { organizationId, conversationId });
    } else if (eff.kind === 'set_tag') {
      // Trilho fixo (Bloco 3): adiciona a tag ao contato, com dedup. Fail-soft:
      // erro aqui nunca derruba o turno (Maestro é aditivo).
      try {
        if (contactId && eff.tag) {
          const c = await prisma.contact.findUnique({
            where: { id: contactId }, select: { tags: true },
          });
          const current = c?.tags ?? [];
          if (!current.includes(eff.tag)) {
            await prisma.contact.update({
              where: { id: contactId }, data: { tags: { push: eff.tag } },
            });
          }
        }
      } catch (e) {
        logger.warn('[Maestro] set_tag falhou (fail-soft)', { organizationId, contactId, err: String(e) });
      }
    } else if (eff.kind === 'update_lead') {
      // Trilho fixo (Bloco 3): grava campo do lead. Colunas escalares conhecidas
      // e seguras vão direto; qualquer outro campo cai em customFields (Json),
      // evitando crash de enum/coluna inexistente. Fail-soft.
      try {
        if (contactId && eff.field) {
          const SCALAR_FIELDS = new Set(['name', 'email', 'company', 'funnelStage', 'leadScore']);
          if (SCALAR_FIELDS.has(eff.field)) {
            const data: Record<string, any> = {};
            data[eff.field] = eff.field === 'leadScore' ? Number(eff.value) : eff.value;
            await prisma.contact.update({ where: { id: contactId }, data });
          } else {
            const c = await prisma.contact.findUnique({
              where: { id: contactId }, select: { customFields: true },
            });
            const cf = { ...((c?.customFields as Record<string, any>) ?? {}) };
            cf[eff.field] = eff.value;
            await prisma.contact.update({
              where: { id: contactId }, data: { customFields: cf as any },
            });
          }
        }
      } catch (e) {
        logger.warn('[Maestro] update_lead falhou (fail-soft)', { organizationId, contactId, err: String(e) });
      }
    } else if ((eff as any).kind === 'goto_flow') {
      // Tratado pelo flowRuntime (troca de fluxo) — nunca deve chegar aqui.
      logger.warn('[Maestro] goto_flow vazou pro executor de efeitos', { organizationId, conversationId });
    } else {
      logger.info('[Maestro] efeito não reconhecido', { organizationId, conversationId, effect: (eff as any).kind });
    }
  }
}
