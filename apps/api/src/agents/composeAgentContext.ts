/* ══════════════════════════════════════════════════════════════════════
 * composeAgentContext: UM só motor de contexto para todos os canais.
 * --------------------------------------------------------------------
 * Tarefa C1a (Passo 12 do plano "Treinar IA e Qualidade 100% funcional").
 *
 * O problema (achados A036, A057, A068, A072, A076, A077, A089): cinco
 * caminhos montavam o prompt do agente cada um do seu jeito. O WhatsApp
 * tinha base, saudação, links e data; o chat do site não consultava a base
 * e guardava o prompt por cinco minutos; o Testar minha IA dizia "primeiro
 * contato" em todo turno; a retomada do Maestro cortava a persona em 4.000
 * caracteres e punha a instrução do passo ACIMA das regras base; a Qualidade
 * testava um agente sem base, sem saudação e sem data. O cliente testava um
 * agente que não era o que atendia.
 *
 * Este arquivo é a parte PURA da cura: recebe tudo pronto (blocos já
 * carregados, contato já lido, relógio injetado) e devolve o texto final,
 * o orçamento por bloco e o hash. Sem banco, sem rede, sem Date.now por
 * dentro. Quem carrega os dados é agentContextLoader.ts.
 *
 * A ordem dos blocos é a de hoje em buildSystemPromptForContact, e o teste
 * de snapshot (composeAgentContext.snapshot.test.ts) prova byte a byte que
 * o texto não mudou. A única posição nova é a da instrução de canal ou de
 * passo do Maestro: DEPOIS do CORE, nunca antes (A076). O CORE se declara
 * imutável e prevalente; nada pode vir na frente dele.
 * ══════════════════════════════════════════════════════════════════════ */

import { createHash } from 'node:crypto';

import { CORE_AGENT_RULES_V1 } from './coreAgentRules.js';
import { buildGreetingBlock } from './tenantLiveProfile.js';
import type { RagSearchStatus } from '../services/ragService.js';

/** De onde vem o turno. Decide instrução de canal e política de modelo. */
export type OrigemDoTurno =
  | 'whatsapp'
  | 'instagram'
  | 'site'
  | 'playground'
  | 'maestro_retomada'
  | 'qualidade';

/** As settings da organização, como estão gravadas (JSON livre). */
export type OrgSettingsLidos = Record<string, any>;

/** Fuso em que o '# Agora' é escrito. O mesmo de hoje. */
export const FUSO_DO_AGORA = 'America/Sao_Paulo';

/** A frase que entra no bloco do RAG quando o serviço está fora (A028). */
export const TEXTO_BASE_INDISPONIVEL = 'base de conhecimento indisponível neste momento';

export interface AgentContextInput {
  origem: OrigemDoTurno;
  agente: { id: string; name: string; systemPrompt: string; role: string };
  organizacao: { id: string; nome: string; settings: OrgSettingsLidos; ehZappIQ: boolean };
  contato: {
    nome: string | null;
    leadStatus: string;
    primeiroContato: boolean;
    totalMensagens: number;
    /** Entra na linha 'Telefone:' quando existe (WhatsApp, Instagram). */
    telefone?: string | null;
    /**
     * A212: o contador é do CONTATO, o histórico enviado ao modelo é só da
     * CONVERSA. `false` = já houve conversa antes, mas nada dela está no
     * contexto deste turno; a linha avisa o modelo para não afirmar o que foi
     * combinado. Ausente ou `true` = a linha de sempre.
     */
    historicoNoContexto?: boolean;
  };
  blocos: {
    /** '# FATOS ATUAIS' da Iza. Vazio para toda org que não é a ZappIQ. */
    izaFacts: string;
    /** '# Como você atende nesta empresa' (tenantLiveProfile). Vazio = flag desligada. */
    perfilVivo: string;
    /** '### Links oficiais de ...' (tenantConversionUrls). */
    links: string;
    /** Trechos recuperados da base. Vazio quando a busca não trouxe nada. */
    rag: string;
    /**
     * '# Regras aprovadas pelo dono' (PR #375, agent_rules). Entra depois do
     * perfil vivo e antes dos links, a posição do caminho de antes. Vazio =
     * interruptor `regrasComoRegistros` desligado ou agente sem regra.
     */
    regrasDoCliente?: string;
  };
  /** Vem de fora; a Qualidade passa data fixa. */
  agora: Date;
  /** Ex.: chat do site, passo do Maestro. Entra DEPOIS do CORE (A076). */
  instrucaoDeCanal?: string;
  /** Estado da busca na base. 'servico_fora' troca o contexto pelo aviso (A028). */
  ragStatus?: RagSearchStatus;
}

export interface ParteDoContexto {
  nome: string;
  chars: number;
}

export interface AgentContextOutput {
  /** O texto final, na ordem de hoje. */
  systemPrompt: string;
  /** Orçamento por bloco (A063). Bloco ausente aparece com 0 caracteres. */
  partes: ParteDoContexto[];
  /** sha256 do systemPrompt, para o Raio-X e para o snapshot. */
  hash: string;
  /**
   * sha256 só dos blocos ESTÁVEIS do tenant (CORE, iza_facts, prompt do
   * agente, regras e links). Não muda com o canal, a mensagem, o histórico,
   * a base nem o relógio: é o que o Raio-X compara entre canais para dizer
   * que o WhatsApp e o site atendem pelo mesmo agente. O perfil vivo fica
   * de fora de propósito: ele carrega "Agora: aberto" (relógio) e a linha
   * de agendamento, que depende das ferramentas do canal.
   */
  hashEstavel: string;
}

/** Nomes fixos dos blocos, na ordem em que entram no prompt. */
export const NOMES_DAS_PARTES = [
  'core',
  'instrucao_de_canal',
  'iza_facts',
  'prompt_do_agente',
  'perfil_vivo',
  'regras_do_cliente',
  'links',
  'cliente_atual',
  'saudacao',
  'rag',
  'agora',
] as const;

export type NomeDaParte = (typeof NOMES_DAS_PARTES)[number];

export function hashDoContexto(texto: string): string {
  return createHash('sha256').update(texto, 'utf8').digest('hex');
}

/** O '# Agora' como a produção escreve hoje: data e hora de São Paulo. */
export function textoDoAgora(agora: Date): string {
  return agora.toLocaleString('pt-BR', { timeZone: FUSO_DO_AGORA });
}

/**
 * O bloco '# Cliente atual', linha a linha igual ao de hoje.
 *
 * As três variantes da última linha são as três que a produção escreve:
 * primeiro contato; histórico presente; histórico ausente (A212).
 */
export function buildClienteAtualBlock(contato: AgentContextInput['contato']): string {
  const linhaPrimeiroContato = contato.primeiroContato
    ? 'Primeiro contato? SIM'
    : contato.historicoNoContexto === false
      ? 'Primeiro contato? NÃO, mas o que foi conversado antes NÃO está aqui. Não pergunte o nome de novo e não afirme o que foi combinado antes: confirme com o cliente.'
      : 'Primeiro contato? NÃO (já tem histórico — não pergunte nome de novo, use o que está acima)';

  const nome = (contato.nome || '').trim();
  return [
    '# Cliente atual',
    nome
      ? `Nome registrado: ${nome}`
      : 'Nome registrado: (ainda não capturado — peça no primeiro turno conforme REGRA 9)',
    contato.telefone ? `Telefone: ${contato.telefone}` : '',
    `Status do lead: ${contato.leadStatus}`,
    `Mensagens trocadas até agora: ${contato.totalMensagens}`,
    linhaPrimeiroContato,
  ]
    .filter(Boolean)
    .join('\n');
}

/** O bloco '# Contexto recuperado (RAG)', com o aviso de serviço fora (A028). */
export function buildRagBlock(rag: string, ragStatus: RagSearchStatus = 'ok'): string {
  return ['# Contexto recuperado (RAG)', ragStatus === 'servico_fora' ? TEXTO_BASE_INDISPONIVEL : rag]
    .filter(Boolean)
    .join('\n');
}

/**
 * Monta o contexto do agente. Pura: mesma entrada, mesma saída, sempre.
 *
 * Ordem (a de hoje): CORE, instrução de canal, iza_facts, prompt do agente,
 * perfil vivo, regras do cliente, links, '# Cliente atual', saudação, RAG,
 * '# Agora'. O join com filter(Boolean) descarta os blocos vazios e os
 * separadores '' que a produção sempre pôs entre links e cliente, entre
 * saudação e RAG, e entre RAG e Agora.
 */
export function composeAgentContext(input: AgentContextInput): AgentContextOutput {
  const { agente, organizacao, contato, blocos } = input;

  const core = CORE_AGENT_RULES_V1;
  const instrucaoDeCanal = (input.instrucaoDeCanal || '').trim();
  const izaFacts = organizacao.ehZappIQ ? blocos.izaFacts || '' : '';
  const promptDoAgente = agente.systemPrompt || '';
  const perfilVivo = blocos.perfilVivo || '';
  const regrasDoCliente = blocos.regrasDoCliente || '';
  const links = blocos.links || '';
  const clienteAtual = buildClienteAtualBlock(contato);
  const saudacao = buildGreetingBlock(contato.primeiroContato, organizacao.settings?.greetingMessage);
  const rag = buildRagBlock(blocos.rag || '', input.ragStatus ?? 'ok');
  const agora = ['# Agora', textoDoAgora(input.agora)].join('\n');

  const systemPrompt = [
    core,
    instrucaoDeCanal,
    izaFacts,
    promptDoAgente,
    perfilVivo,
    regrasDoCliente,
    links,
    '',
    clienteAtual,
    saudacao,
    '',
    rag,
    '',
    agora,
  ]
    .filter(Boolean)
    .join('\n');

  const porNome: Record<NomeDaParte, string> = {
    core,
    instrucao_de_canal: instrucaoDeCanal,
    iza_facts: izaFacts,
    prompt_do_agente: promptDoAgente,
    perfil_vivo: perfilVivo,
    regras_do_cliente: regrasDoCliente,
    links,
    cliente_atual: clienteAtual,
    saudacao,
    rag,
    agora,
  };

  return {
    systemPrompt,
    partes: NOMES_DAS_PARTES.map((nome) => ({ nome, chars: porNome[nome].length })),
    hash: hashDoContexto(systemPrompt),
    hashEstavel: hashDoContexto(
      [core, izaFacts, promptDoAgente, regrasDoCliente, links].filter(Boolean).join('\n'),
    ),
  };
}
