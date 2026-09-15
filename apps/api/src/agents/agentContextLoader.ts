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
 * Fail-soft em tudo que é leitura acessória (contato, fatos, interruptor,
 * regras aprovadas): o turno nunca cai por causa de um bloco. A única
 * ausência que devolve null é a do Agent: sem prompt gravado, quem chamou
 * segue no caminho de fallback de sempre (promptEngine).
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import {
  isFlagOn,
  lerFlagsDaOrganizacao,
  flagsDesligadas,
  type FlagName,
  type FlagsDaOrganizacao,
} from '../services/featureFlags.js';
import { getIzaFactsBlock } from '../services/izaFactsService.js';
// PR #375: as correções aprovadas pelo dono são registros (agent_rules),
// montados em bloco atrás do interruptor `regrasComoRegistros`.
import { blocoDeRegrasDaOrganizacao } from '../services/agentRulesService.js';
import { isZappIQOrg } from '../config/zappiqOrg.js';
import { resolveSchedulingAccess, type PlanId } from '@zappiq/shared';
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

/**
 * C1b (nota 1 da revisão de 14/09): os interruptores da organização lidos
 * UMA vez por turno. Quem começa o turno (WhatsApp, Instagram, site, Testar
 * minha IA, retomada do Maestro) lê aqui e passa o resultado ao carregador,
 * à política e aos montadores; ninguém mais vai ao Redis por interruptor no
 * meio do turno. Nunca lança: erro é tudo desligado.
 */
export async function lerFlagsDoTurno(organizationId: string): Promise<FlagsDaOrganizacao> {
  try {
    return await lerFlagsDaOrganizacao(organizationId);
  } catch {
    return flagsDesligadas();
  }
}

export type { FlagsDaOrganizacao };

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
  /**
   * O bloco "# Regras aprovadas pelo dono" já lido por quem chamou (a
   * Qualidade lê UMA vez por execução, e o Raio-X da Qualidade faz igual).
   * Presente, mesmo vazio, entra como veio e nada é lido aqui. Ausente, o
   * carregador lê as regras do agente do turno, atrás de
   * `regrasComoRegistros` (rodada 2 do PR #377).
   */
  regrasDoCliente?: string;
  /**
   * C1b (nota 1): os interruptores já lidos no começo do turno. Presentes,
   * o carregador não lê interruptor nenhum (perfilVivo e
   * regrasComoRegistros vêm daqui).
   */
  flags?: FlagsDaOrganizacao;
}

export interface ContextoDoTurno extends AgentContextOutput {
  agente: AgenteDoTurno;
  contato: ContatoDoTurno;
  ragStatus: RagSearchStatus;
  perfilVivoLigado: boolean;
}

/**
 * As regras aprovadas pelo dono para ESTE agente (PR #375), sem nunca lançar.
 *
 * Por agente e não por organização (PI-3 do #375): com o id do Agent que o
 * turno vai usar, o texto do prompt e as regras são sempre do mesmo agente.
 * Interruptor `regrasComoRegistros` desligado: o serviço devolve '' sem ir ao
 * banco, então o turno não paga consulta nenhuma a mais. Erro: segue sem o
 * bloco, como o caminho de antes faz.
 */
export async function carregarRegrasDoAgente(
  organizationId: string,
  agentId: string,
  /** C1b: `regrasComoRegistros` já lido na leitura única do turno. */
  ligado?: boolean,
): Promise<string> {
  try {
    return await blocoDeRegrasDaOrganizacao(organizationId, { agentId, ligado });
  } catch (err) {
    logger.warn('[AgentContext] bloco de regras indisponível neste turno (segue sem ele)', {
      organizationId,
      err: err instanceof Error ? err.message : String(err),
    });
    return '';
  }
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
    input.perfilVivoLigado ?? input.flags?.perfilVivo ?? (await flagLigada(organizationId, 'perfilVivo'));

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

  // Rodada 2 do PR #377: sem isto, a organização com `regrasComoRegistros` E
  // `contextoUnico` ligados perdia as regras aprovadas em todos os canais. O
  // bloco entra no lugar que o compositor reservou (depois do perfil vivo,
  // antes dos links), o mesmo do caminho de antes do #375.
  const regrasDoCliente =
    input.regrasDoCliente ??
    (await carregarRegrasDoAgente(organizationId, agente.id, input.flags?.regrasComoRegistros));

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
      regrasDoCliente,
      links: buildTenantLinksBlock(settings, settings.businessName),
      rag: input.ragContext,
    },
    agora,
    instrucaoDeCanal: input.instrucaoDeCanal,
    ragStatus,
  });

  return { ...saida, agente, contato, ragStatus, perfilVivoLigado };
}

// ── Agendamento do turno ─────────────────────────────────────────────

/**
 * O agendamento está REALMENTE de pé nesta organização?
 *
 * C1b (nota 4): mudou de casa, do orquestrador para cá, sem mudar uma
 * linha. O chat do site e a Qualidade precisam da MESMA linha de
 * agendamento do WhatsApp e não podem carregar o orquestrador para isso.
 *
 * Até 14/09/2026 o produto acreditava num único campo, `scheduling.enabled`,
 * e ele mentia dos dois lados (A165):
 *   • o CMJ tem `enabled: true` com ZERO tipos cadastrados, então todo turno
 *     levava as ferramentas de agendamento (e ia para Sonnet, A066) só para
 *     a IA responder que a empresa não agenda;
 *   • quem cadastra tipo nenhum interruptor liga, e a IA ficava sem
 *     ferramenta para consultar horário.
 *
 * Ligado agora é o cruzamento de três coisas verdadeiras: o dono não optou
 * por sair, a organização tem direito ao recurso (plano ou add-on) e existe
 * pelo menos um tipo ativo. Qualquer erro devolve DESLIGADO: prometer
 * agendamento que não existe é o defeito que estamos consertando.
 */
export async function resolveSchedulingRuntime(
  organizationId: string,
  orgSettings: any,
): Promise<{ ativo: boolean; tipos: string[]; motivo: string }> {
  const scheduling = orgSettings?.scheduling ?? null;
  if (scheduling?.optOut) return { ativo: false, tipos: [], motivo: 'optou_por_sair' };
  if (!scheduling?.enabled) return { ativo: false, tipos: [], motivo: 'nao_ligado' };

  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true, settings: true },
    });
    const addons = Array.isArray((org?.settings as any)?.addons)
      ? ((org!.settings as any).addons as string[])
      : [];
    const acesso = resolveSchedulingAccess((org?.plan as PlanId) || 'IZA_LITE', addons);
    if (!acesso.entitled) return { ativo: false, tipos: [], motivo: 'sem_direito' };

    const tipos = await (prisma as any).appointmentType.findMany({
      where: { organizationId, active: true },
      select: { name: true },
      take: 20,
    });
    const nomes: string[] = (tipos ?? [])
      .map((t: any) => String(t?.name ?? '').trim())
      .filter(Boolean);
    if (!nomes.length && (!tipos || tipos.length === 0)) {
      return { ativo: false, tipos: [], motivo: 'sem_tipo_ativo' };
    }
    return { ativo: true, tipos: nomes, motivo: 'ativo' };
  } catch (err) {
    logger.warn('[Agent] resolveSchedulingRuntime falhou: agendamento tratado como desligado', {
      organizationId,
      err: String(err),
    });
    return { ativo: false, tipos: [], motivo: 'erro' };
  }
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
