/* ══════════════════════════════════════════════════════════════════════
 * Sincroniza a identidade que o cliente edita com o agente que roda.
 * --------------------------------------------------------------------
 * Bug encontrado em 14/07/2026, junto com o vazamento da Iza:
 *
 *   PUT /api/ai-training/identity gravava SÓ em organization.settings.
 *   O buildSystemPromptForContact prefere o Agent do banco e só cai no
 *   promptEngine (que lê settings) quando a org não tem Agent seedado.
 *   Como toda org tem Agent, o que o cliente edita em "Treinar IA >
 *   Identidade" NUNCA chegava ao agente em produção: ele renomeava a IA
 *   de "Vera" para "Sofia" e a IA continuava se apresentando como Vera.
 *
 *   Era a mesma doença do vazamento da Iza: a plataforma não olhava para
 *   o agente que o cliente criou.
 *
 * Por que renomear cirurgicamente em vez de regerar o prompt:
 *   Regerar apagaria qualquer customização acumulada. O prompt da Iza tem
 *   26.886 chars de patches aplicados à mão, contra ~4.000 do seed. Um
 *   "regerar" cego destruiria esse trabalho. Aqui trocamos só o nome na
 *   linha de IDENTIDADE, preservando o resto.
 * ══════════════════════════════════════════════════════════════════════ */

import { logger } from '../utils/logger.js';

/**
 * Troca o nome do agente na linha de IDENTIDADE do prompt, preservando o resto.
 *
 * O promptEngine gera: "Você é {agentName}, atendente virtual {role} da {business}."
 * Trocamos só o {agentName}, mantendo o resto da frase como está.
 *
 * @returns o prompt novo, ou null se não achou a linha (aí não mexe em nada).
 */
export function renameAgentInPrompt(
  systemPrompt: string,
  nomeAntigo: string,
  nomeNovo: string,
): string | null {
  if (!systemPrompt || !nomeAntigo || !nomeNovo) return null;
  if (nomeAntigo.trim() === nomeNovo.trim()) return null;

  const antigo = nomeAntigo.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Casa "Você é Vera," / "Você é Vera " no começo do bloco de identidade.
  const regex = new RegExp(`(Você é\\s+)${antigo}(\\s*,)`, 'i');
  if (!regex.test(systemPrompt)) return null;

  return systemPrompt.replace(regex, `$1${nomeNovo.trim()}$2`);
}

interface IdentitySyncDb {
  agent: {
    findFirst: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
}

/**
 * Propaga o nome novo do agente para o Agent que roda em produção.
 * Fail-soft: erro aqui não pode derrubar o PUT /identity do cliente.
 *
 * @returns o que foi sincronizado, pra rota devolver ao front.
 */
export async function syncAgentIdentity(
  db: IdentitySyncDb,
  organizationId: string,
  nomeNovo: string | undefined | null,
): Promise<{ synced: boolean; agentId?: string; nomeAntigo?: string; promptAtualizado?: boolean }> {
  const novo = typeof nomeNovo === 'string' ? nomeNovo.trim() : '';
  if (!novo) return { synced: false };

  try {
    const agent = await db.agent.findFirst({
      where: { organizationId, status: 'live' },
      select: { id: true, name: true, systemPrompt: true },
    });
    if (!agent) return { synced: false };
    if (agent.name === novo) return { synced: false };

    const promptNovo = renameAgentInPrompt(agent.systemPrompt || '', agent.name, novo);

    await db.agent.update({
      where: { id: agent.id },
      data: {
        name: novo,
        ...(promptNovo ? { systemPrompt: promptNovo } : {}),
      },
    });

    logger.info('[agentIdentitySync] identidade do agente sincronizada com o que o cliente editou', {
      organizationId,
      agentId: agent.id,
      de: agent.name,
      para: novo,
      promptAtualizado: Boolean(promptNovo),
    });

    return {
      synced: true,
      agentId: agent.id,
      nomeAntigo: agent.name,
      promptAtualizado: Boolean(promptNovo),
    };
  } catch (err) {
    // Não derruba o save do cliente: o settings já foi gravado.
    logger.warn('[agentIdentitySync] falhou ao sincronizar identidade', {
      organizationId,
      err: String(err),
    });
    return { synced: false };
  }
}
