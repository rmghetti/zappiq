/* ══════════════════════════════════════════════════════════════════════
 * promptVersionService — a única porta para reescrever Agent.systemPrompt.
 * --------------------------------------------------------------------
 * Achado A083: reverter uma correção restaurava o texto de antes SEM olhar
 * o que existia no agente naquele momento. Tudo que veio depois (outra
 * correção, a sincronização do nome, a edição manual do cliente) sumia. E
 * não havia histórico nenhum: `agents.system_prompt` era um campo que o
 * produto sobrescrevia em cinco lugares diferentes, sem rastro.
 *
 * Agora:
 *   • quem grava o prompt passa por aqui e declara a ORIGEM da mudança;
 *   • a origem, a decisão e o autor viajam como variáveis de sessão do
 *     Postgres (`set_config(..., is_local = true)`), lidas pelo gatilho
 *     `agents_versiona_prompt` que insere a linha em agent_prompt_versions;
 *   • quem quiser garantir que o prompt não mudou no meio do caminho passa
 *     `expectedHash`; divergiu, ninguém grava (PromptChangedError).
 *
 * Mesmo desenho de versão imutável do flowVersionService: a versão nasce
 * dentro da transação da escrita, então ou as duas coisas acontecem ou
 * nenhuma acontece. A diferença é que aqui quem numera é o gatilho, e não
 * a aplicação: escrita feita fora do app (psql, migração, script) também
 * vira versão, com origem `fora_do_app`.
 *
 * O `db` é injetado (padrão do agentProvisioningService). Pode ser o
 * `prisma` (abre a transação) ou um `tx` já aberto (entra na transação de
 * quem chamou, para o prompt e a decisão de auditoria irem juntos).
 * ══════════════════════════════════════════════════════════════════════ */

import { createHash } from 'node:crypto';
import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';

/** Origens válidas de uma escrita de prompt vinda do produto. */
export const PROMPT_SOURCES = [
  'seed',
  'fix_apply',
  'fix_revert',
  'identity_sync',
  'remediacao',
  'migracao',
  'manual',
] as const;

export type PromptSource = (typeof PROMPT_SOURCES)[number];

export function isPromptSource(valor: unknown): valor is PromptSource {
  return typeof valor === 'string' && (PROMPT_SOURCES as readonly string[]).includes(valor);
}

/**
 * md5 hexadecimal do texto, EXATAMENTE o que `md5(NEW.system_prompt)` do
 * Postgres grava na coluna `hash`. Função pura: dá para comparar o que o
 * banco calculou com o que a aplicação calculou, sem ir ao banco.
 */
export function hashPrompt(texto: string): string {
  return createHash('md5').update(texto ?? '', 'utf8').digest('hex');
}

/** O prompt mudou entre a leitura e a gravação: ninguém sobrescreve às cegas. */
export class PromptChangedError extends Error {
  constructor(
    public readonly agentId: string,
    public readonly hashEsperado: string,
    public readonly hashAtual: string,
  ) {
    super(`O prompt do agente ${agentId} mudou desde a leitura (esperado ${hashEsperado}, atual ${hashAtual}).`);
    this.name = 'PromptChangedError';
  }
}

/** Subconjunto de uma transação Prisma que este service usa. */
export interface PromptVersionTx {
  $executeRaw: (query: TemplateStringsArray, ...values: any[]) => Promise<number>;
  agent: {
    findUnique: (args: any) => Promise<{ systemPrompt: string | null } | null>;
    update: (args: any) => Promise<any>;
  };
  agentPromptVersion: {
    findFirst: (args: any) => Promise<{ version: number; hash: string } | null>;
  };
}

/** `prisma` (abre transação) ou um `tx` já aberto. */
export interface PromptVersionDb extends PromptVersionTx {
  $transaction?: (fn: (tx: PromptVersionTx) => Promise<any>) => Promise<any>;
}

export interface PromptContext {
  source: PromptSource;
  decisionId?: string | null;
  actor?: string | null;
}

/**
 * Declara, para o gatilho do Postgres, quem está escrevendo e por quê.
 *
 * `is_local = true`: o valor vale só até o fim da transação. Sem isso, a
 * conexão voltaria ao pool carregando a origem da última escrita e a
 * próxima gravação herdaria uma origem mentirosa.
 *
 * Valor vazio vira NULL no gatilho (`nullif(..., '')`).
 */
export async function setPromptContext(
  tx: PromptVersionTx,
  ctx: PromptContext,
): Promise<void> {
  await tx.$executeRaw`SELECT set_config('zappiq.prompt_source', ${ctx.source}, true)`;
  await tx.$executeRaw`SELECT set_config('zappiq.prompt_decision', ${ctx.decisionId ?? ''}, true)`;
  await tx.$executeRaw`SELECT set_config('zappiq.prompt_actor', ${ctx.actor ?? ''}, true)`;
}

export interface PublishPromptInput {
  agentId: string;
  systemPrompt: string;
  source: PromptSource;
  /** Decisão de correção que originou a mudança, quando houver. */
  decisionId?: string | null;
  /** E-mail de quem mandou (ou o nome do processo, para escrita de sistema). */
  actor?: string | null;
  /**
   * md5 do prompt que quem chamou ACHA que está no agente. Divergiu, não
   * grava: é a trava que impede o revert de apagar o que veio depois.
   */
  expectedHash?: string | null;
}

export interface PublishPromptResult {
  version: number;
  hash: string;
}

/**
 * Grava o prompt novo e devolve a versão que o gatilho criou.
 *
 * Quando o texto é idêntico ao que já está lá, o gatilho não cria versão
 * (é o `OLD.system_prompt IS DISTINCT FROM NEW.system_prompt` dele) e a
 * função devolve a versão corrente. Escrita sem mudança não polui o
 * histórico.
 */
export async function publishPrompt(
  input: PublishPromptInput,
  db: PromptVersionDb = prisma as unknown as PromptVersionDb,
): Promise<PublishPromptResult> {
  const { agentId, systemPrompt, source } = input;

  if (!agentId) throw new Error('publishPrompt: agentId é obrigatório');
  if (typeof systemPrompt !== 'string') {
    throw new Error('publishPrompt: systemPrompt é obrigatório');
  }
  if (!isPromptSource(source)) {
    throw new Error(
      `publishPrompt: origem inválida "${String(source)}". Válidas: ${PROMPT_SOURCES.join(', ')}`,
    );
  }

  const corpo = async (tx: PromptVersionTx): Promise<PublishPromptResult> => {
    await setPromptContext(tx, {
      source,
      decisionId: input.decisionId ?? null,
      actor: input.actor ?? null,
    });

    if (input.expectedHash) {
      const atual = await tx.agent.findUnique({
        where: { id: agentId },
        select: { systemPrompt: true },
      });
      const hashAtual = hashPrompt(atual?.systemPrompt ?? '');
      if (hashAtual !== input.expectedHash) {
        throw new PromptChangedError(agentId, input.expectedHash, hashAtual);
      }
    }

    await tx.agent.update({ where: { id: agentId }, data: { systemPrompt } });

    const ultima = await tx.agentPromptVersion.findFirst({
      where: { agentId },
      orderBy: { version: 'desc' },
      select: { version: true, hash: true },
    });

    return {
      version: ultima?.version ?? 0,
      hash: ultima?.hash ?? hashPrompt(systemPrompt),
    };
  };

  const out =
    typeof db.$transaction === 'function'
      ? await db.$transaction(corpo)
      : await corpo(db);

  logger.info('[promptVersionService] prompt publicado', {
    agentId,
    source,
    version: out.version,
    chars: systemPrompt.length,
    decisionId: input.decisionId ?? null,
  });

  return out;
}
