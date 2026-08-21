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
  /**
   * Resposta Meta out/2026 (PR-I): consolidador de balões. Caller que JÁ tem
   * a org carregada decide aqui (true/false) e evita a consulta; undefined =
   * o executor resolve sozinho via resolverConsolidarBaloes (e SÓ consulta o
   * banco quando o lote tem send_text consecutivos pra consolidar).
   */
  consolidarBaloes?: boolean;
}

/*
 * ─────────────────────────────────────────────────────────────────
 * Resposta Meta out/2026 (PR-I): consolidador de balões do Maestro.
 *
 * Fluxos com vários nós de mensagem em sequência disparavam um envio de
 * WhatsApp por send_text (1 balão = 1 mensagem cobrada/entregue). Com o
 * consolidador, send_text CONSECUTIVOS do mesmo lote viram UM envio só,
 * separados por linha em branco. Efeito não-texto no meio (botões, mídia,
 * tag) quebra a sequência: só o que é adjacente se junta.
 *
 * Gate por org via settings.flags.consolidarBaloes:
 *   - flag booleana explícita vence sempre;
 *   - sem flag: LIGADO pra org criada a partir do corte (2026-10-01, junto
 *     com o modelo de cobrança novo da Meta) e DESLIGADO pras anteriores,
 *     cujos fluxos foram desenhados contando com um balão por nó.
 * ─────────────────────────────────────────────────────────────────
 */

/** Corte de coorte: org criada a partir daqui nasce com consolidação LIGADA. */
export const CORTE_CONSOLIDACAO_BALOES = new Date('2026-10-01T00:00:00Z');

/** Separador entre textos consolidados (linha em branco no WhatsApp). */
export const SEPARADOR_CONSOLIDACAO = '\n\n';

/** true quando o lote tem pelo menos um par de send_text adjacentes. */
export function temSendTextConsecutivos(effects: FlowEffect[]): boolean {
  for (let i = 1; i < effects.length; i++) {
    if (effects[i].kind === 'send_text' && effects[i - 1].kind === 'send_text') return true;
  }
  return false;
}

/**
 * Junta send_text CONSECUTIVOS num único efeito (separador de linha em
 * branco). Pura: não muda a ordem nem os demais efeitos, e não muta o array
 * de entrada.
 */
export function consolidarSendTextConsecutivos(effects: FlowEffect[]): FlowEffect[] {
  const out: FlowEffect[] = [];
  for (const eff of effects) {
    const prev = out[out.length - 1];
    if (eff.kind === 'send_text' && prev?.kind === 'send_text') {
      out[out.length - 1] = { ...prev, text: `${prev.text}${SEPARADOR_CONSOLIDACAO}${eff.text}` };
    } else {
      out.push(eff);
    }
  }
  return out;
}

/**
 * Resolve a flag da org quando o caller não decidiu: flag explícita em
 * settings.flags.consolidarBaloes vence; sem flag, default pela coorte de
 * criação (createdAt >= corte). Fail-soft: qualquer erro desliga a
 * consolidação (comportamento antigo, um balão por send_text).
 */
export async function resolverConsolidarBaloes(organizationId: string): Promise<boolean> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true, createdAt: true },
    });
    if (!org) return false;
    const flag = (org.settings as any)?.flags?.consolidarBaloes;
    if (typeof flag === 'boolean') return flag;
    const createdAt = org.createdAt ? new Date(org.createdAt as any) : null;
    return (
      createdAt !== null &&
      !Number.isNaN(createdAt.getTime()) &&
      createdAt.getTime() >= CORTE_CONSOLIDACAO_BALOES.getTime()
    );
  } catch (e) {
    logger.warn('[Maestro] resolverConsolidarBaloes falhou (fail-soft: sem consolidação)', {
      organizationId,
      err: String(e),
    });
    return false;
  }
}

export async function executeFlowEffects(input: ExecuteEffectsInput): Promise<void> {
  const { organizationId, conversationId, contactId, onHandoff, aiConfidence = 1.0 } = input;

  // Consolidador de balões (PR-I): só entra em ação quando há send_text
  // consecutivos no lote E a flag da org (ou do caller) está ligada. Fora
  // disso, o lote atravessa intocado (zero consulta extra no caminho comum).
  let effects = input.effects;
  if (temSendTextConsecutivos(effects)) {
    const ligado =
      typeof input.consolidarBaloes === 'boolean'
        ? input.consolidarBaloes
        : await resolverConsolidarBaloes(organizationId);
    if (ligado) {
      effects = consolidarSendTextConsecutivos(effects);
    }
  }

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
