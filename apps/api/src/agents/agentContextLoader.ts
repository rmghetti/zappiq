/* ══════════════════════════════════════════════════════════════════════
 * agentContextLoader: a camada de IO do motor único de contexto.
 * --------------------------------------------------------------------
 * Tarefa C1a (Passo 12). composeAgentContext é pura; este arquivo é quem
 * busca o que ela precisa: o Agent da organização, o contato, os fatos da
 * Iza, o perfil vivo, os links e a política de modelo. Todos os canais
 * (WhatsApp, Instagram, chat do site, Testar minha IA, retomada do Maestro
 * e Qualidade) passam por aqui quando o interruptor `contextoUnico` está
 * ligado; desligado, cada caminho segue como era.
 *
 * Não importa o agentOrchestrator de propósito: o chat do site e o
 * avaliador precisam do mesmo contexto e não podem carregar a fila, o
 * socket e o WhatsApp só para isso.
 *
 * Fail-soft em tudo que é leitura acessória (contato, fatos, interruptor):
 * o turno nunca cai por causa de um bloco. A única ausência que devolve
 * null é a do Agent: sem prompt gravado, quem chamou segue no caminho de
 * fallback de sempre (promptEngine).
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { isFlagOn, type FlagName } from '../services/featureFlags.js';
import { getIzaFactsBlock } from '../services/izaFactsService.js';
import { isZappIQOrg } from '../config/zappiqOrg.js';
import { decideLlmCostStage } from '../middleware/planLimits.js';
import type { RagSearchStatus } from '../services/ragService.js';
import { buildTenantLinksBlock } from './tenantConversionUrls.js';
import { buildLiveProfileBlock, type LiveProfileAgendamento } from './tenantLiveProfile.js';
import {
  composeAgentContext,
  type AgentContextOutput,
  type OrgSettingsLidos,
  type OrigemDoTurno,
} from './composeAgentContext.js';
import { resolveTurnPolicy, type TurnPolicy } from './resolveTurnPolicy.js';

/**
 * Lê um interruptor sem nunca lançar. isFlagOn já é fail-closed; o try aqui
 * cobre o dublê de teste que rejeita. Erro = desligado.
 */
export async function flagLigada(organizationId: string, flag: FlagName): Promise<boolean> {
  try {
    return await isFlagOn(organizationId, flag);
  } catch {
    return false;
  }
}

// ── Agent do turno (A077, A069) ───────────────────────────────────────

export interface AgenteDoTurno {
  id: string;
  name: string;
  systemPrompt: string;
  role: string;
}

/** Papel preferido pelo status do lead: convertido fala com suporte. */
export function roleParaLeadStatus(leadStatus: string | null | undefined): 'comercial' | 'suporte' {
  return leadStatus === 'CONVERTED' ? 'suporte' : 'comercial';
}

/**
 * UMA regra de escolha do Agent para os cinco caminhos (A077):
 * papel pelo status do lead, status live, o mais recente. Quando não existe
 * agente para o papel (nenhuma organização tem 'suporte' hoje), cai no
 * 'comercial' em vez do prompt genérico do promptEngine (A069): é o
 * comercial que carrega as correções da Qualidade e as seções do cliente.
 *
 * Devolve null só quando a organização não tem agente vivo com prompt.
 */
export async function resolveAgentForTurn(
  organizationId: string,
  leadStatus: string | null | undefined,
): Promise<AgenteDoTurno | null> {
  const preferido = roleParaLeadStatus(leadStatus);
  const buscar = (role: string) =>
    prisma.agent.findFirst({
      where: { organizationId, role, status: 'live' },
      select: { id: true, name: true, systemPrompt: true, role: true },
      orderBy: { createdAt: 'desc' },
    });

  let agente = await buscar(preferido);
  if (!agente?.systemPrompt && preferido !== 'comercial') {
    agente = await buscar('comercial');
  }
  if (!agente?.systemPrompt) return null;
  return {
    id: agente.id,
    name: agente.name,
    systemPrompt: agente.systemPrompt,
    role: agente.role,
  };
}

// ── Contato do turno ──────────────────────────────────────────────────

export interface ContatoDoTurno {
  nome: string | null;
  leadStatus: string;
  primeiroContato: boolean;
  totalMensagens: number;
  telefone?: string | null;
}

/**
 * O mesmo lookup de hoje: nome, status e contagem de mensagens do contato.
 * Contato inexistente (playground, Raio-X) ou banco fora = primeiro contato,
 * como sempre foi.
 */
export async function carregarContato(
  contactId: string,
  contactPhone?: string | null,
): Promise<ContatoDoTurno> {
  let nome: string | null = null;
  let leadStatus = 'NEW';
  let totalMensagens = 0;
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        leadStatus: true,
        name: true,
        _count: { select: { conversations: { where: {} } } },
      },
    });
    if (contact) {
      nome = (contact.name || '').trim() || null;
      leadStatus = contact.leadStatus || 'NEW';
      totalMensagens = await prisma.message.count({
        where: { conversation: { contactId } },
      });
    }
  } catch (err) {
    logger.warn('[AgentContext] lookup do contato falhou, assumindo primeiro contato', { err });
  }
  return {
    nome,
    leadStatus,
    // 1 = a mensagem inbound atual, já gravada pelo webhook.
    primeiroContato: totalMensagens <= 1,
    totalMensagens,
    telefone: contactPhone ?? null,
  };
}

// ── Montagem do contexto ──────────────────────────────────────────────

export interface MontarContextoInput {
  origem: OrigemDoTurno;
  organizationId: string;
  orgSettings: OrgSettingsLidos | null | undefined;
  /** Contato já resolvido (playground, Qualidade, site sem lead). */
  contato?: ContatoDoTurno;
  /** Ou o id para o lookup de sempre (WhatsApp, Instagram, retomada). */
  contactId?: string;
  contactPhone?: string | null;
  /** Agent já resolvido (Qualidade avalia um agente específico). */
  agente?: AgenteDoTurno;
  ragContext: string;
  ragStatus?: RagSearchStatus;
  agendamento?: LiveProfileAgendamento | null;
  /** A212. Só tem efeito com o perfil vivo ligado. */
  temHistoricoNoContexto?: boolean;
  instrucaoDeCanal?: string;
  /** Relógio injetado; a Qualidade passa data fixa. Padrão: agora. */
  agora?: Date;
  /** Já lido por quem chamou? Ausente = lê o interruptor perfilVivo aqui. */
  perfilVivoLigado?: boolean;
}

export interface ContextoDoTurno extends AgentContextOutput {
  agente: AgenteDoTurno;
  contato: ContatoDoTurno;
  ragStatus: RagSearchStatus;
  perfilVivoLigado: boolean;
}

/**
 * Carrega os blocos e chama a função pura. Devolve null quando a
 * organização não tem Agent vivo: quem chamou segue no fallback de sempre.
 */
export async function montarContextoDoTurno(input: MontarContextoInput): Promise<ContextoDoTurno | null> {
  const { organizationId } = input;
  const settings: OrgSettingsLidos = input.orgSettings ?? {};
  const ragStatus = input.ragStatus ?? 'ok';
  const agora = input.agora ?? new Date();

  const contato =
    input.contato ??
    (input.contactId
      ? await carregarContato(input.contactId, input.contactPhone)
      : {
          nome: null,
          leadStatus: 'NEW',
          primeiroContato: true,
          totalMensagens: 1,
          telefone: input.contactPhone ?? null,
        });

  const agente = input.agente ?? (await resolveAgentForTurn(organizationId, contato.leadStatus));
  if (!agente) return null;

  const perfilVivoLigado =
    input.perfilVivoLigado ?? (await flagLigada(organizationId, 'perfilVivo'));

  const ehZappIQ = isZappIQOrg(organizationId);
  let izaFacts = '';
  if (ehZappIQ) {
    try {
      izaFacts = await getIzaFactsBlock();
    } catch (err) {
      logger.warn('[AgentContext] iza_facts indisponível neste turno', { err: String(err) });
      izaFacts = '';
    }
  }

  const perfilVivo = perfilVivoLigado
    ? buildLiveProfileBlock(settings, null, { now: agora, agendamento: input.agendamento ?? null })
    : '';

  // A212 só existe com o perfil vivo ligado; desligado, a linha é a de antes.
  const historicoNoContexto = perfilVivoLigado ? input.temHistoricoNoContexto !== false : true;

  const saida = composeAgentContext({
    origem: input.origem,
    agente,
    organizacao: {
      id: organizationId,
      nome: String(settings.businessName ?? ''),
      settings,
      ehZappIQ,
    },
    contato: { ...contato, historicoNoContexto },
    blocos: {
      izaFacts,
      perfilVivo,
      links: buildTenantLinksBlock(settings, settings.businessName),
      rag: input.ragContext,
    },
    agora,
    instrucaoDeCanal: input.instrucaoDeCanal,
    ragStatus,
  });

  return { ...saida, agente, contato, ragStatus, perfilVivoLigado };
}

// ── Política do turno ─────────────────────────────────────────────────

export interface CarregarPoliticaInput {
  canal: OrigemDoTurno;
  ecoMode?: boolean;
  agendamentoAtivo: boolean;
}

/**
 * Lê da organização o que resolveTurnPolicy precisa e decide. Fail-soft:
 * banco fora devolve a cascata padrão sem ferramentas, que é o que
 * pickTierAndOverride devolve hoje no mesmo erro.
 */
export async function carregarPoliticaDoTurno(
  organizationId: string,
  input: CarregarPoliticaInput,
): Promise<TurnPolicy> {
  const ehZappIQ = isZappIQOrg(organizationId);
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        plan: true,
        settings: true,
        trialStartedAt: true,
        trialEndsAt: true,
        isTrialActive: true,
        trialConverted: true,
        stripeSubscriptionId: true,
      },
    });
    if (!org) {
      return resolveTurnPolicy({
        canal: input.canal,
        plano: null,
        ehZappIQ,
        estagioDoTrial: 'OTHER',
        ecoMode: false,
        llmRouting: null,
        agendamentoAtivo: input.agendamentoAtivo,
      });
    }
    const settings = (org.settings as Record<string, any>) ?? {};
    return resolveTurnPolicy({
      canal: input.canal,
      plano: org.plan,
      ehZappIQ,
      estagioDoTrial: decideLlmCostStage(org as any),
      ecoMode: input.ecoMode === true,
      llmRouting: settings.llm_routing ?? null,
      agendamentoAtivo: input.agendamentoAtivo,
    });
  } catch (err: any) {
    logger.warn(`[AgentContext] política do turno falhou: ${err?.message}. Cascata padrão`, {
      organizationId,
    });
    return {
      tier: undefined,
      override: undefined,
      tools: [],
      modelo: 'anthropic-sonnet',
      motivo: 'erro ao ler a organização: cascata padrão, sem ferramentas',
    };
  }
}
