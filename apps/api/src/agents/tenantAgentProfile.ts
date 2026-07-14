/* ══════════════════════════════════════════════════════════════════════
 * Tenant Agent Profile — quem é o agente que o CLIENTE criou.
 * --------------------------------------------------------------------
 * Fonte única da verdade do tenant. Toda funcionalidade que analisa,
 * testa ou corrige "o agente" tem que resolver este perfil primeiro, em
 * vez de assumir a Iza.
 *
 * Por quê (14/07/2026, CMJ):
 *   O eval, o classificador de intent e o promptEngine assumiam a Iza. A
 *   Vera (CMJ) era testada contra o gabarito da ZappIQ e reprovada por
 *   dizer que é do CMJ.
 *
 * REGRA INEGOCIÁVEL: nenhum campo aqui cai pra "Iza"/"ZappIQ" quando o dado
 * falta. Falta de dado vira default neutro ("Assistente", "sua empresa") ou
 * null. Quem consome decide o que fazer com a ausência — o eval, por exemplo,
 * simplesmente não roda o cenário de preço se o cliente não cadastrou preço.
 *
 * Onde os dados vivem hoje (mapeado em 14/07):
 *   - Agent.name / Agent.systemPrompt  → o que roda em produção
 *   - Organization.name                → nome do negócio
 *   - Organization.settings (JSON)     → agentName, businessName, niche, tone
 *   - settings.surveyAnswers.identidade_empresa.* → o que o cliente treinou
 *     (ide_site_url, com_lista_servicos, pre_tabela_precos, reg_*)
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { isZappIQOrg } from '../config/zappiqOrg.js';

export interface TenantAgentProfile {
  organizationId: string;
  /** true SÓ para a org canônica da ZappIQ (onde a Iza roda). */
  isZappIQ: boolean;

  /** Nome do agente do cliente ("Vera"). Nunca "Iza" por default. */
  agentName: string;
  /** Nome do negócio do cliente ("CMJ"). Nunca "ZappIQ" por default. */
  businessName: string;
  niche: string;
  tone: string;

  /** O que o cliente treinou. null = não preencheu. */
  siteUrl: string | null;
  servicos: string | null;
  precos: string | null;
  descontoMaximo: string | null;
  regrasComerciais: string | null;

  /** Flags pra avaliação condicional: não cobre do cliente o que ele não treinou. */
  temSiteUrl: boolean;
  temServicos: boolean;
  temPrecos: boolean;

  /**
   * true quando settings.agentName diverge de Agent.name — o cliente renomeou
   * a IA em /treinar mas o Agent não foi re-semeado, então produção ainda usa
   * o nome antigo. Bug conhecido de PUT /ai-training/identity.
   */
  identityDrift: boolean;

  /** systemPrompt que roda de fato (null se a org não tem Agent seedado). */
  systemPrompt: string | null;
  agentId: string | null;
}

const DEFAULT_AGENT_NAME = 'Assistente';
const DEFAULT_BUSINESS_NAME = 'sua empresa';

/** Texto do survey só conta se tiver conteúdo real (não espaço em branco). */
function texto(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/** Junta as respostas de regra comercial num bloco só (ou null se vazio). */
function joinRegras(ident: Record<string, any>): string | null {
  const chaves = Object.keys(ident).filter((k) => k.startsWith('reg_') || k.startsWith('pos_'));
  const linhas = chaves.map((k) => texto(ident[k])).filter(Boolean);
  return linhas.length > 0 ? linhas.join('\n') : null;
}

/**
 * Resolve o perfil do tenant. Fail-soft: qualquer erro devolve um perfil
 * neutro de CLIENTE (nunca ZappIQ) — o lado seguro.
 */
export async function resolveTenantAgentProfile(
  organizationId: string,
  opts: { agentId?: string; role?: string } = {},
): Promise<TenantAgentProfile> {
  const isZappIQ = isZappIQOrg(organizationId);

  let org: any = null;
  let agent: any = null;

  try {
    [org, agent] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, settings: true },
      }),
      opts.agentId
        ? prisma.agent.findFirst({
            where: { id: opts.agentId, organizationId },
            select: { id: true, name: true, systemPrompt: true },
          })
        : prisma.agent.findFirst({
            where: { organizationId, status: 'live', ...(opts.role ? { role: opts.role } : {}) },
            select: { id: true, name: true, systemPrompt: true },
          }),
    ]);
  } catch (err) {
    logger.warn('[tenantAgentProfile] lookup falhou — perfil neutro de cliente', {
      organizationId,
      err: String(err),
    });
  }

  const settings = (org?.settings as Record<string, any>) || {};
  const ident = (settings?.surveyAnswers?.identidade_empresa as Record<string, any>) || {};

  const nomeEmSettings = texto(settings.agentName);
  const nomeEmAgent = texto(agent?.name);

  // Agent.name ganha: é o registro do agente que roda em produção. settings
  // só entra quando a org não tem Agent seedado.
  const agentName = nomeEmAgent || nomeEmSettings || DEFAULT_AGENT_NAME;
  const identityDrift = Boolean(nomeEmAgent && nomeEmSettings && nomeEmAgent !== nomeEmSettings);

  if (identityDrift) {
    logger.info('[tenantAgentProfile] drift de identidade: settings != Agent', {
      organizationId,
      emSettings: nomeEmSettings,
      emProducao: nomeEmAgent,
    });
  }

  const businessName =
    texto(settings.businessName) ||
    texto(ident.ide_nome_fantasia) ||
    texto(org?.name) ||
    DEFAULT_BUSINESS_NAME;

  const siteUrl = texto(ident.ide_site_url);
  const servicos = texto(ident.com_lista_servicos);
  const precos = texto(ident.pre_tabela_precos);

  return {
    organizationId,
    isZappIQ,
    agentName,
    businessName,
    niche: texto(settings.niche) || 'generic',
    tone: texto(settings.tone) || 'friendly',
    siteUrl,
    servicos,
    precos,
    descontoMaximo: texto(ident.pre_desconto_maximo),
    regrasComerciais: joinRegras(ident),
    temSiteUrl: Boolean(siteUrl),
    temServicos: Boolean(servicos),
    temPrecos: Boolean(precos),
    identityDrift,
    systemPrompt: agent?.systemPrompt ?? null,
    agentId: agent?.id ?? null,
  };
}
