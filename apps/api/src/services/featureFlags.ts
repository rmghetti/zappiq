/* ══════════════════════════════════════════════════════════════════════
 * featureFlags: interruptor de comportamento novo, por organização.
 * --------------------------------------------------------------------
 * Por que existe: fundir na main publica a API e o web na hora. Sem um
 * interruptor, todo comportamento novo estreia ligado para os 100% dos
 * clientes no minuto do merge. Com ele, o novo nasce DESLIGADO e cada
 * organização é ligada de propósito, uma por vez, pela rota admin.
 *
 * Três regras que o teste protege:
 *   1. Toda flag tem prazo (`removeBy`). Prazo vencido quebra a suíte de
 *      propósito: interruptor sem data vira código morto permanente.
 *   2. Qualquer erro (banco fora, cache fora, linha ausente) devolve
 *      `false`. Falha nunca liga comportamento novo no cliente.
 *   3. Ligar ou desligar invalida o cache na hora, senão o operador
 *      mexeria na chave e passaria 30 segundos achando que não pegou.
 *
 * O `deps` é injetado (mesmo padrão do agentProvisioningService) para o
 * comportamento ser testável sem banco e sem Redis.
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { cache as cloudCache } from './cloud/index.js';
import { logger } from '../utils/logger.js';

/** Nomes válidos de interruptor. Trocar aqui quebra o compilador, de propósito. */
export type FlagName =
  | 'perfilVivo'
  | 'guardaComercial'
  | 'ragNoChatDoSite'
  | 'evalNoTier'
  | 'treinarSomenteAdmin'
  | 'regrasComoRegistros'
  | 'contextoUnico'
  | 'modeloPorPolitica'
  | 'guardaDeMarca';

export interface FlagDef {
  /** O que muda quando liga. Em português: isto aparece na tela do admin. */
  descricao: string;
  /** Data limite para tirar o interruptor do código (YYYY-MM-DD). */
  removeBy: string;
}

/**
 * Registro dos interruptores. Cada linha é uma dívida com prazo: passou da
 * data, o teste falha e alguém precisa remover o interruptor (mantendo o
 * comportamento novo) ou renegociar a data por escrito.
 */
export const FLAGS: Record<FlagName, FlagDef> = {
  perfilVivo: {
    descricao:
      'O perfil do agente passa a ser lido do que o cliente preencheu, e não do texto congelado no prompt.',
    removeBy: '2026-12-31',
  },
  guardaComercial: {
    descricao:
      'Guarda que barra promessa comercial inventada na resposta do agente antes de ela sair.',
    removeBy: '2026-12-31',
  },
  ragNoChatDoSite: {
    descricao:
      'O chat do site passa a consultar a base de conhecimento da organização antes de responder.',
    removeBy: '2027-03-31',
  },
  evalNoTier: {
    descricao:
      'A avaliação de qualidade passa a respeitar a faixa do plano (quantas execuções e com qual modelo). Ainda sem leitor no código: só passa a valer com a tarefa C2.',
    removeBy: '2027-03-31',
  },
  treinarSomenteAdmin: {
    descricao:
      'Só ADMIN e SUPERADMIN podem aplicar, reverter ou disparar correções no prompt do agente.',
    removeBy: '2026-12-31',
  },
  regrasComoRegistros: {
    descricao:
      'As correções aprovadas viram registros com uma regra por cenário, montadas num bloco do prompt, em vez de texto colado dentro dele.',
    removeBy: '2027-06-30',
  },
  contextoUnico: {
    descricao:
      'WhatsApp, Instagram, chat do site, Testar minha IA, retomada do Maestro e Qualidade montam o prompt pelo mesmo motor de contexto (composeAgentContext).',
    removeBy: '2026-12-31',
  },
  modeloPorPolitica: {
    descricao:
      'Modelo e ferramentas do turno decididos por resolveTurnPolicy, a mesma regra para todos os canais.',
    removeBy: '2026-12-31',
  },
  guardaDeMarca: {
    descricao:
      'A guarda de marca passa a SEGURAR a resposta do agente que cita a ZappIQ para o cliente de outro negócio (sai a resposta segura do canal, sem botões e sem ações além do transbordo). Desligada, a guarda só alerta: o texto sai como veio e o alerta vai para o log, o Testar minha IA, o Raio-X e a Qualidade. Ligar por organização depois de ler os alertas.',
    removeBy: '2027-03-31',
  },
};

export const FLAG_NAMES = Object.keys(FLAGS) as FlagName[];

/** Cache curto: liga/desliga tem efeito quase imediato sem martelar o banco. */
export const FLAG_CACHE_TTL_SECONDS = 30;

export function flagCacheKey(organizationId: string, flag: string): string {
  return `zappiq:flag:${organizationId}:${flag}`;
}

/**
 * C1b (nota 1 da revisão de 14/09): a chave da leitura ÚNICA, com todos os
 * interruptores da organização de uma vez. O turno do agente lê esta, e não
 * uma chave por interruptor.
 */
export function flagsCacheKey(organizationId: string): string {
  return `zappiq:flags:${organizationId}`;
}

/** Todos os interruptores da organização, lidos de uma vez. */
export type FlagsDaOrganizacao = Readonly<Record<FlagName, boolean>>;

/** Tudo desligado: o valor de qualquer dúvida. */
export function flagsDesligadas(): FlagsDaOrganizacao {
  return Object.fromEntries(FLAG_NAMES.map((f) => [f, false])) as Record<FlagName, boolean>;
}

export function isFlagName(valor: unknown): valor is FlagName {
  return typeof valor === 'string' && Object.prototype.hasOwnProperty.call(FLAGS, valor);
}

/** Erro de uso: pediram um interruptor que não existe no registro. */
export class FlagDesconhecidaError extends Error {
  constructor(public readonly flag: string) {
    super(`Interruptor desconhecido: ${flag}`);
    this.name = 'FlagDesconhecidaError';
  }
}

/** Subconjunto do PrismaClient que este service usa. */
export interface FeatureFlagsDb {
  orgFeatureFlag: {
    findUnique: (args: any) => Promise<{ enabled: boolean } | null>;
    findMany: (args: any) => Promise<any[]>;
    upsert: (args: any) => Promise<any>;
  };
}

/** Subconjunto do cache que este service usa. */
export interface FeatureFlagsCache {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttlSeconds?: number) => Promise<boolean>;
  del: (key: string) => Promise<boolean>;
}

export interface FeatureFlagsDeps {
  db: FeatureFlagsDb;
  cache: FeatureFlagsCache;
}

function depsPadrao(): FeatureFlagsDeps {
  return {
    db: prisma as unknown as FeatureFlagsDb,
    cache: cloudCache as unknown as FeatureFlagsCache,
  };
}

/** Converte 'YYYY-MM-DD' em Date UTC (a coluna é `date`). Null quando vazio. */
export function parseRemoveBy(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const d = new Date(`${valor}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * O interruptor está ligado para esta organização?
 *
 * Padrão `false` em qualquer cenário de dúvida: linha ausente, banco fora,
 * cache fora, flag desconhecida. Comportamento novo só entra quando alguém
 * ligou de propósito.
 */
export async function isFlagOn(
  organizationId: string,
  flag: FlagName,
  deps: FeatureFlagsDeps = depsPadrao(),
): Promise<boolean> {
  if (!organizationId || !isFlagName(flag)) return false;

  const key = flagCacheKey(organizationId, flag);
  try {
    const cached = await deps.cache.get(key);
    if (cached === '1') return true;
    if (cached === '0') return false;

    const linha = await deps.db.orgFeatureFlag.findUnique({
      where: { organizationId_flag: { organizationId, flag } },
      select: { enabled: true },
    });
    const ligada = Boolean(linha?.enabled);
    await deps.cache.set(key, ligada ? '1' : '0', FLAG_CACHE_TTL_SECONDS);
    return ligada;
  } catch (err) {
    logger.warn('[featureFlags] leitura falhou, assumindo desligado', {
      organizationId,
      flag,
      err: String(err),
    });
    return false;
  }
}

/** Lê a lista de ligados guardada no cache. null = ausente ou estranha. */
function lerLigadosDoCache(bruto: string | null): Set<string> | null {
  if (bruto === null || bruto === undefined) return null;
  try {
    const lista = JSON.parse(bruto);
    if (!Array.isArray(lista)) return null;
    return new Set(lista.filter((f: unknown) => typeof f === 'string'));
  } catch {
    return null;
  }
}

/**
 * Todos os interruptores da organização numa leitura só (C1b, nota 1).
 *
 * O turno do agente lia até quatro interruptores, cada um um GET no Redis;
 * com o Redis fora, eram quatro GETs falhos por turno. Aqui é UM GET (a
 * lista dos ligados, na chave flagsCacheKey), e só no cache vazio uma
 * consulta ao banco, que traz todas as linhas da organização. Mesmo prazo
 * de cache (30 s) e mesma invalidação de isFlagOn (setFlag apaga as duas
 * chaves). Mesma regra de dúvida: qualquer erro devolve tudo desligado.
 */
export async function lerFlagsDaOrganizacao(
  organizationId: string,
  deps: FeatureFlagsDeps = depsPadrao(),
): Promise<FlagsDaOrganizacao> {
  const desligadas = flagsDesligadas();
  if (!organizationId) return desligadas;

  const key = flagsCacheKey(organizationId);
  try {
    const doCache = lerLigadosDoCache(await deps.cache.get(key));
    if (doCache) {
      return Object.fromEntries(FLAG_NAMES.map((f) => [f, doCache.has(f)])) as Record<FlagName, boolean>;
    }

    const linhas = await deps.db.orgFeatureFlag.findMany({
      where: { organizationId },
      select: { flag: true, enabled: true },
    });
    const ligados = new Set(
      (linhas ?? []).filter((l: any) => l && l.enabled === true && isFlagName(l.flag)).map((l: any) => l.flag as string),
    );
    await deps.cache.set(key, JSON.stringify([...ligados]), FLAG_CACHE_TTL_SECONDS);
    return Object.fromEntries(FLAG_NAMES.map((f) => [f, ligados.has(f)])) as Record<FlagName, boolean>;
  } catch (err) {
    logger.warn('[featureFlags] leitura única falhou, assumindo tudo desligado', {
      organizationId,
      err: String(err),
    });
    return desligadas;
  }
}

/**
 * Liga ou desliga o interruptor e invalida o cache na hora.
 *
 * `removeBy` sem valor herda o prazo do registro: a linha no banco sempre
 * carrega a data limite que o operador viu na tela.
 */
export async function setFlag(
  organizationId: string,
  flag: FlagName,
  enabled: boolean,
  actor: string | null,
  removeBy?: string | null,
  deps: FeatureFlagsDeps = depsPadrao(),
): Promise<{ organizationId: string; flag: FlagName; enabled: boolean }> {
  if (!isFlagName(flag)) throw new FlagDesconhecidaError(String(flag));

  const prazo = parseRemoveBy(removeBy ?? FLAGS[flag].removeBy);
  const agora = new Date();
  const comum = {
    enabled,
    removeBy: prazo,
    updatedBy: actor ?? null,
    updatedAt: agora,
  };

  await deps.db.orgFeatureFlag.upsert({
    where: { organizationId_flag: { organizationId, flag } },
    create: { organizationId, flag, ...comum },
    update: comum,
  });

  await deps.cache.del(flagCacheKey(organizationId, flag));
  // C1b: a leitura única do turno também tem de ver a mudança na hora.
  await deps.cache.del(flagsCacheKey(organizationId));

  logger.info('[featureFlags] interruptor alterado', {
    organizationId,
    flag,
    enabled,
    actor: actor ?? 'sem autor',
  });

  return { organizationId, flag, enabled };
}

export interface FlagEstado {
  flag: FlagName;
  descricao: string;
  /** Prazo do registro (YYYY-MM-DD). */
  removeBy: string;
  /** Prazo gravado na linha da organização, quando houver. */
  removeByDaOrganizacao: string | null;
  enabled: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}

/**
 * Registro inteiro com o estado da organização. Flag sem linha aparece
 * desligada: é assim que o admin enxerga o que existe e o que está ligado.
 */
export async function listFlags(
  organizationId: string,
  deps: FeatureFlagsDeps = depsPadrao(),
): Promise<FlagEstado[]> {
  let linhas: any[] = [];
  try {
    linhas = await deps.db.orgFeatureFlag.findMany({ where: { organizationId } });
  } catch (err) {
    logger.warn('[featureFlags] listagem falhou, devolvendo tudo desligado', {
      organizationId,
      err: String(err),
    });
    linhas = [];
  }

  return FLAG_NAMES.map((flag) => {
    const linha = linhas.find((l) => l.flag === flag);
    return {
      flag,
      descricao: FLAGS[flag].descricao,
      removeBy: FLAGS[flag].removeBy,
      removeByDaOrganizacao: linha?.removeBy
        ? new Date(linha.removeBy).toISOString().slice(0, 10)
        : null,
      enabled: Boolean(linha?.enabled),
      updatedBy: linha?.updatedBy ?? null,
      updatedAt: linha?.updatedAt ? new Date(linha.updatedAt).toISOString() : null,
    };
  });
}
