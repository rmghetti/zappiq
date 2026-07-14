/* ══════════════════════════════════════════════════════════════════════
 * promptRemediationService — tira o link da ZappIQ dos prompts já gravados.
 * --------------------------------------------------------------------
 * O trabalho de texto vive em agents/promptUrlRemediation.ts (puro). Aqui é a
 * orquestração com o banco, separada porque é onde um erro custa caro: reescreve
 * o Agent.systemPrompt de cliente em PRODUÇÃO.
 *
 * O `db` é injetado (mesmo padrão do agentProvisioningService) pra esta lógica
 * ser testável sem banco: pular a org da Iza, tirar snapshot antes de escrever e
 * recusar gravação suja são exatamente as regras que não podem quebrar em prod.
 * ══════════════════════════════════════════════════════════════════════ */

import { removerBlocoUrlsZappIQ } from '../agents/promptUrlRemediation.js';
import { findForeignBrandLeaks } from '../agents/tenantIsolationGuard.js';

/** Org canônica da ZappIQ (onde a Iza roda). Lá o nosso link é legítimo. */
export const IZA_ORG_ID = 'cmo1ywwfe00ko1jskexiexsm4';

/** Subconjunto do PrismaClient que este service usa. */
export interface RemediacaoDb {
  agent: {
    findMany: (args: any) => Promise<any[]>;
    update: (args: any) => Promise<any>;
    findUnique: (args: any) => Promise<any>;
  };
}

export interface PromptSnapshot {
  agentId: string;
  agentName: string;
  organizationId: string;
  orgName: string;
  promptAntes: string;
  /** Texto que sai do prompt. Auditoria: dá pra ver o que foi removido. */
  removido: string;
  promptDepois: string;
}

export interface Auditoria {
  totalAgents: number;
  /** Prompts de CLIENTE com link nosso dentro. */
  afetados: PromptSnapshot[];
  /** Agents da org da ZappIQ com o bloco. Pulados de propósito. */
  izaComBloco: string[];
}

/**
 * Read-only: acha os prompts de cliente contaminados. Não escreve nada.
 */
export async function auditarPrompts(db: RemediacaoDb): Promise<Auditoria> {
  const agents = await db.agent.findMany({
    select: {
      id: true,
      name: true,
      systemPrompt: true,
      organizationId: true,
      organization: { select: { name: true } },
    },
  });

  const afetados: PromptSnapshot[] = [];
  const izaComBloco: string[] = [];

  for (const a of agents) {
    if (!a.systemPrompt) continue;

    const r = removerBlocoUrlsZappIQ(a.systemPrompt);
    if (!r) continue;

    // A Iza fica como está: os links da ZappIQ são a identidade legítima dela.
    if (a.organizationId === IZA_ORG_ID) {
      izaComBloco.push(a.name);
      continue;
    }

    afetados.push({
      agentId: a.id,
      agentName: a.name,
      organizationId: a.organizationId,
      orgName: a.organization?.name ?? '(sem nome)',
      promptAntes: a.systemPrompt,
      removido: r.removido,
      promptDepois: r.prompt,
    });
  }

  return { totalAgents: agents.length, afetados, izaComBloco };
}

export interface ResultadoAplicacao {
  corrigidos: number;
  /** Não gravados porque a limpeza não bastou (ainda sobrava marca nossa). */
  recusados: { orgName: string; termos: string[] }[];
}

/**
 * Grava a correção. Só chame depois de auditar e de ter o snapshot em disco.
 *
 * Trava por item: se o prompt limpo AINDA tiver marca nossa, não grava. Prefere
 * deixar o prompt velho (que já estava lá) a gravar algo que passou perto.
 */
export async function aplicarRemediacao(
  db: RemediacaoDb,
  itens: PromptSnapshot[],
): Promise<ResultadoAplicacao> {
  let corrigidos = 0;
  const recusados: { orgName: string; termos: string[] }[] = [];

  for (const it of itens) {
    const leaks = findForeignBrandLeaks(it.promptDepois, { strict: true });
    if (leaks.length > 0) {
      recusados.push({ orgName: it.orgName, termos: leaks.map((l) => l.term) });
      continue;
    }

    await db.agent.update({ where: { id: it.agentId }, data: { systemPrompt: it.promptDepois } });
    corrigidos++;
  }

  return { corrigidos, recusados };
}

/** Relê do banco e confirma que não sobrou marca nossa. */
export async function verificarNoBanco(
  db: RemediacaoDb,
  itens: PromptSnapshot[],
): Promise<{ orgName: string; termos: string[] }[]> {
  const sujos: { orgName: string; termos: string[] }[] = [];

  for (const it of itens) {
    const fresh = await db.agent.findUnique({
      where: { id: it.agentId },
      select: { systemPrompt: true },
    });
    const leaks = findForeignBrandLeaks(fresh?.systemPrompt ?? '', { strict: true });
    if (leaks.length > 0) sujos.push({ orgName: it.orgName, termos: leaks.map((l) => l.term) });
  }

  return sujos;
}

/** Restaura os prompts exatamente como estavam no snapshot. */
export async function reverterRemediacao(
  db: RemediacaoDb,
  itens: PromptSnapshot[],
): Promise<number> {
  let n = 0;
  for (const it of itens) {
    await db.agent.update({ where: { id: it.agentId }, data: { systemPrompt: it.promptAntes } });
    n++;
  }
  return n;
}
