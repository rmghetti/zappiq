/* ══════════════════════════════════════════════════════════════════════
 * webChatVisitante: o que o widget do chat do site lê do servidor.
 * --------------------------------------------------------------------
 * Tarefa C1b (Passos 3 e 4). Três leituras públicas, por organização, que
 * o script colado no site do cliente faz sem login:
 *
 *   1. as mensagens que a EQUIPE escreveu para a sessão do visitante
 *      (Passo 3, A158): se ele saiu antes da resposta humana, ela aparece
 *      quando ele voltar;
 *   2. o nome e a saudação do widget, do Treinar IA (Passo 4, A247);
 *   3. as origens em que o widget pode rodar, de settings (Passo 4, A241).
 *
 * Tudo aqui é leve e com cache curto: o script roda em toda página do site
 * do cliente. Nada devolve dado que o visitante não tenha acesso de outro
 * jeito: a sessão é o segredo que o próprio navegador dele guarda.
 *
 * `deps` injetado (padrão agentProvisioningService): testável sem banco.
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { flagLigada, resolveAgentForTurn } from '../agents/agentContextLoader.js';
import { origensDaOrganizacao } from '../config/origensPermitidas.js';

/** Quantas mensagens da equipe o widget recebe de uma vez. */
export const MAX_MENSAGENS_DA_EQUIPE = 50;

export interface MensagemDaEquipe {
  id: string;
  content: string;
  createdAt: string;
}

export interface VisitanteDb {
  contact: { findUnique: (args: any) => Promise<{ id: string } | null> };
  message: { findMany: (args: any) => Promise<Array<{ id: string; content: string | null; createdAt: Date }>> };
}

function dbPadrao(): VisitanteDb {
  return prisma as unknown as VisitanteDb;
}

/**
 * As mensagens que alguém da equipe escreveu para esta sessão, da mais
 * antiga para a mais recente. Só OUTBOUND humana (isFromBot false): as
 * respostas da IA o widget já recebeu no próprio POST.
 *
 * Fail-soft: banco fora devolve lista vazia (o widget tenta de novo depois).
 */
export async function mensagensDaEquipe(
  organizationId: string,
  sessionId: string,
  db: VisitanteDb = dbPadrao(),
): Promise<MensagemDaEquipe[]> {
  try {
    const contato = await db.contact.findUnique({
      where: { whatsappId_organizationId: { whatsappId: `web:${sessionId}`, organizationId } },
      select: { id: true },
    });
    if (!contato) return [];
    const linhas = await db.message.findMany({
      where: {
        direction: 'OUTBOUND',
        isFromBot: false,
        conversation: { contactId: contato.id, organizationId, channel: 'web' },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_MENSAGENS_DA_EQUIPE,
      select: { id: true, content: true, createdAt: true },
    });
    return linhas
      .reverse()
      .filter((m) => typeof m.content === 'string' && m.content.trim())
      .map((m) => ({ id: m.id, content: String(m.content), createdAt: new Date(m.createdAt).toISOString() }));
  } catch (err) {
    logger.warn('[webChat] mensagens da equipe indisponíveis', {
      organizationId,
      err: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/* ── Passo 4 (A247, A241): identidade e origens do widget ─────────────── */

/** Cache curto: o script roda em toda página do site, e o dono vê a mudança em 1 minuto. */
export const CONFIG_DO_WIDGET_TTL_MS = 60_000;

/** Teto da saudação que vai para o widget (a tela do Treinar IA não limita). */
export const MAX_SAUDACAO_DO_WIDGET = 500;

/** Teto do nome no cabeçalho do widget. */
const MAX_NOME_DO_WIDGET = 60;

export interface ConfigDoWidget {
  /** Nome do agente, do Treinar IA. null = o widget usa o atributo da tag. */
  nome: string | null;
  /** settings.greetingMessage. null = o widget usa o atributo ou a reserva neutra. */
  saudacao: string | null;
}

const NADA: ConfigDoWidget = { nome: null, saudacao: null };

type Cacheado<T> = { valor: T; ate: number };
const cacheDaConfig = new Map<string, Cacheado<ConfigDoWidget>>();
const cacheDasOrigens = new Map<string, Cacheado<string[]>>();

/**
 * Teto de organizações em cada cache (auditoria do diff). A chave vem da URL
 * pública do widget: sem teto, pedidos com ids inventados fariam o Map
 * crescer sem fim. Passou do teto, sai a entrada mais antiga.
 */
export const TETO_DO_CACHE_DO_WIDGET = 500;

export function guardarComTeto<T>(mapa: Map<string, T>, chave: string, valor: T, teto = TETO_DO_CACHE_DO_WIDGET): void {
  mapa.delete(chave);
  mapa.set(chave, valor);
  while (mapa.size > teto) {
    const maisAntiga = mapa.keys().next().value;
    if (maisAntiga === undefined) break;
    mapa.delete(maisAntiga);
  }
}

/** Para os testes. */
export function limparCacheDoWidget(): void {
  cacheDaConfig.clear();
  cacheDasOrigens.clear();
  cacheDeTodasAsOrigens = null;
}

async function carregarSettingsPadrao(organizationId: string): Promise<Record<string, any>> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  return (org?.settings as Record<string, any>) ?? {};
}

function textoCortado(valor: unknown, max: number): string | null {
  if (typeof valor !== 'string') return null;
  const t = valor.trim();
  if (!t) return null;
  return t.length <= max ? t : t.slice(0, max).trimEnd();
}

export interface DependenciasDaConfig {
  perfilVivoLigado?: (organizationId: string) => Promise<boolean>;
  carregarAgente?: (organizationId: string) => Promise<{ name: string } | null>;
  carregarSettings?: (organizationId: string) => Promise<Record<string, any>>;
}

/**
 * Nome e saudação do widget, do Treinar IA (A247).
 *
 * Atrás do interruptor `perfilVivo` ("o perfil do agente passa a ser lido do
 * que o cliente preencheu"): desligado, o servidor devolve nulos e o widget
 * segue com os atributos da tag colada no site, exatamente como hoje. O
 * agente é o do seletor único (resolveAgentForTurn), o mesmo que responde.
 *
 * Nunca lança: banco fora devolve nulos, e o widget usa a reserva.
 */
export async function configDoWidget(
  organizationId: string,
  deps: DependenciasDaConfig = {},
): Promise<ConfigDoWidget> {
  const agora = Date.now();
  const cacheado = cacheDaConfig.get(organizationId);
  if (cacheado && cacheado.ate > agora) return cacheado.valor;

  const perfilVivoLigado = deps.perfilVivoLigado ?? ((org: string) => flagLigada(org, 'perfilVivo'));
  const carregarAgente = deps.carregarAgente ?? ((org: string) => resolveAgentForTurn(org, 'NEW'));
  const carregarSettings = deps.carregarSettings ?? carregarSettingsPadrao;

  let valor: ConfigDoWidget = NADA;
  try {
    if (await perfilVivoLigado(organizationId)) {
      const [agente, settings] = await Promise.all([
        carregarAgente(organizationId).catch(() => null),
        carregarSettings(organizationId),
      ]);
      valor = {
        nome: textoCortado(agente?.name, MAX_NOME_DO_WIDGET) ?? textoCortado(settings.agentName, MAX_NOME_DO_WIDGET),
        saudacao: textoCortado(settings.greetingMessage, MAX_SAUDACAO_DO_WIDGET),
      };
    }
  } catch (err) {
    logger.warn('[webChat] configuração do widget indisponível (o widget usa a reserva)', {
      organizationId,
      err: err instanceof Error ? err.message : String(err),
    });
    valor = NADA;
  }

  guardarComTeto(cacheDaConfig, organizationId, { valor, ate: agora + CONFIG_DO_WIDGET_TTL_MS });
  return valor;
}

/**
 * As origens que a organização cadastrou para o widget
 * (settings.webChatAllowedOrigins), já limpas, com cache curto (A241).
 * Vazia quando não há a chave ou o banco falha: aí vale só a lista fixa do
 * código, que é o comportamento de hoje.
 */
export async function origensDoWidget(
  organizationId: string,
  deps: Pick<DependenciasDaConfig, 'carregarSettings'> = {},
): Promise<string[]> {
  const agora = Date.now();
  const cacheado = cacheDasOrigens.get(organizationId);
  if (cacheado && cacheado.ate > agora) return cacheado.valor;

  const carregarSettings = deps.carregarSettings ?? carregarSettingsPadrao;
  let valor: string[] = [];
  try {
    valor = origensDaOrganizacao(await carregarSettings(organizationId));
  } catch (err) {
    logger.warn('[webChat] origens do widget indisponíveis (vale a lista fixa)', {
      organizationId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
  guardarComTeto(cacheDasOrigens, organizationId, { valor, ate: agora + CONFIG_DO_WIDGET_TTL_MS });
  return valor;
}

let cacheDeTodasAsOrigens: Cacheado<string[]> | null = null;

async function listarSettingsDosWidgetsPadrao(): Promise<Array<Record<string, any>>> {
  const orgs = await prisma.organization.findMany({
    where: { settings: { path: ['webChatEnabled'], equals: true } },
    select: { settings: true },
  });
  return orgs.map((o) => (o.settings as Record<string, any>) ?? {});
}

/**
 * Todas as origens cadastradas pelas organizações com o chat do site
 * ligado, com cache curto (A241). É o que o servidor de socket consulta no
 * upgrade, antes de saber de qual organização é o widget; a checagem por
 * organização é do portão do namespace. Vazia no erro (vale a lista fixa).
 */
export async function origensDeTodosOsWidgets(
  deps: { listarSettings?: () => Promise<Array<Record<string, any>>> } = {},
): Promise<string[]> {
  const agora = Date.now();
  if (cacheDeTodasAsOrigens && cacheDeTodasAsOrigens.ate > agora) return cacheDeTodasAsOrigens.valor;

  let valor: string[] = [];
  try {
    const todas = await (deps.listarSettings ?? listarSettingsDosWidgetsPadrao)();
    valor = Array.from(new Set(todas.flatMap((s) => origensDaOrganizacao(s))));
  } catch (err) {
    logger.warn('[webChat] origens dos widgets indisponíveis (vale a lista fixa)', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  cacheDeTodasAsOrigens = { valor, ate: agora + CONFIG_DO_WIDGET_TTL_MS };
  return valor;
}
