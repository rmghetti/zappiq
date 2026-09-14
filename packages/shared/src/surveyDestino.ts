/* ══════════════════════════════════════════════════════════════════════
 * surveyDestino: para onde vai CADA resposta do questionário.
 * --------------------------------------------------------------------
 * O questionário tem 202 perguntas globais mais as do segmento. Até aqui,
 * TODAS iam para o mesmo lugar: um documento único que virava 27 trechos
 * na busca vetorial, com a chave de código no lugar da pergunta
 * ('pre_tabela_precos:' em vez do que foi perguntado) e misturando preço,
 * CNPJ, tom de voz e escalonamento no mesmo trecho (A023, A075).
 *
 * Isso tinha três efeitos ruins de uma vez:
 *   1. Regra de comportamento (tom, escalada, política de desconto) só
 *      chegava ao modelo quando a pergunta do cliente PARECIA com ela.
 *      Regra que depende de sorte na busca não é regra.
 *   2. Dado interno (margem, LTV, motivo de perda) ficava disponível para
 *      a IA repetir para o cliente final.
 *   3. Vinte perguntas configuravam funções que a plataforma não executa,
 *      doze delas obrigatórias (A211). O dono preenchia e nada acontecia.
 *
 * A tabela abaixo é a decisão, pergunta por pergunta:
 *
 *   instrucao          vira regra no bloco vivo do prompt, em todo turno.
 *   fato_oficial       o valor que vale está nas configurações; a resposta
 *                      não é reescrita em outro lugar para não divergir.
 *   base               vira texto consultável na base de conhecimento.
 *   funcao_do_sistema  não é conhecimento: configura (ou configuraria) um
 *                      comportamento do produto. Nunca vai para o modelo.
 *   fora_da_ia         não entra em lugar nenhum.
 *
 * Regra de ouro: pergunta nova no catálogo SEM linha aqui quebra o teste.
 * É de propósito. Alguém precisa decidir para onde a resposta vai antes de
 * pedir o dado ao cliente.
 * ══════════════════════════════════════════════════════════════════════ */

import { GLOBAL_SURVEY_BLOCKS, type SurveyQuestion } from './surveyTypes.js';
import { SEGMENT_SURVEYS } from './surveySegmentQuestions.js';

export type Destino = 'instrucao' | 'fato_oficial' | 'base' | 'funcao_do_sistema' | 'fora_da_ia';

export interface RegistroDeDestino {
  destino: Destino;
  /** Por que este destino. Em português: sai na tela e na revisão. */
  motivo?: string;
  /**
   * Só para `funcao_do_sistema`: o produto AINDA não executa isto. A tela
   * mostra 'em breve' e a pergunta não pode ser obrigatória.
   */
  emBreve?: boolean;
  /**
   * Campo de configuração que manda de verdade. Existe em `fato_oficial`
   * (a resposta só espelha a configuração) e na função do sistema que já
   * tem lugar certo para ser configurada.
   */
  configuracaoReal?: string;
}

/** Uma pergunta do catálogo com a seção de onde ela veio. */
export interface PerguntaDoCatalogo {
  id: string;
  label: string;
  tipo: SurveyQuestion['type'];
  /** Id da seção (bloco) do questionário. Vira o `source` no vetor. */
  secaoId: string;
  secaoTitulo: string;
  obrigatoria: boolean;
}

function indexarCatalogo(): Map<string, PerguntaDoCatalogo> {
  const mapa = new Map<string, PerguntaDoCatalogo>();
  const adicionar = (blocos: { id: string; title: string; questions: SurveyQuestion[] }[]) => {
    for (const bloco of blocos) {
      for (const q of bloco.questions) {
        mapa.set(q.id, {
          id: q.id,
          label: q.label,
          tipo: q.type,
          secaoId: bloco.id,
          secaoTitulo: bloco.title,
          obrigatoria: Boolean(q.required),
        });
      }
    }
  };
  // Segmento primeiro: se algum dia um id colidir, o global é que vale,
  // porque é ele que tem linha na tabela de destino.
  for (const blocos of Object.values(SEGMENT_SURVEYS)) adicionar(blocos);
  adicionar(GLOBAL_SURVEY_BLOCKS);
  return mapa;
}

/** Catálogo inteiro (global, segmento e especialidade) por id de pergunta. */
export const PERGUNTA_POR_ID: ReadonlyMap<string, PerguntaDoCatalogo> = indexarCatalogo();

/**
 * As 20 perguntas que configuram a PLATAFORMA, e não o negócio (A211).
 * Nenhuma delas pode ser obrigatória e nenhuma vai para o modelo: a IA não
 * pode afirmar que faz o que o produto não faz.
 */
export const PERGUNTAS_DE_FUNCAO_DO_SISTEMA: readonly string[] = [
  'crm_campos_desejados',
  'crm_tags',
  'crm_preferencias_registraveis',
  'crm_historico_conversas',
  'crm_aniversario',
  'crm_nps',
  'reg_resumir_historico',
  'reg_pode_agendar_sozinha',
  'reg_pode_enviar_orcamento',
  'reg_limite_mensagens',
  'reg_horario_ia_vs_humano',
  'esc_prioridade_alta',
  'esc_para_quem_escalar',
  'esc_canais_escalonamento',
  'esc_resumo_caso',
  'esc_mensagem_transicao',
  'esc_sla_resposta',
  'esc_sem_humano_disponivel',
  'esc_followup_pos_escalonamento',
  'esc_retorno_ia',
];

/** Destino de cada pergunta GLOBAL. Uma linha por pergunta, sem exceção. */
export const DESTINO_POR_PERGUNTA: Record<string, RegistroDeDestino> = {

  // ── identidade_empresa ──────────────────────────────────────────
  ide_nome_fantasia: {
    destino: 'fato_oficial',
    configuracaoReal: 'businessName',
    motivo: 'O nome do negócio já entra no bloco vivo pelas configurações.',
  },
  ide_razao_social: { destino: 'base' },
  ide_cnpj: { destino: 'base' },
  ide_endereco_principal: { destino: 'base' },
  ide_tem_filiais: { destino: 'base' },
  ide_filiais_detalhes: { destino: 'base' },
  ide_cobertura_geografica: { destino: 'base' },
  ide_modalidade_atendimento: { destino: 'base' },
  ide_site_url: { destino: 'base' },
  ide_redes_sociais: { destino: 'base' },
  ide_canais_contato: { destino: 'base' },
  ide_telefone_principal: { destino: 'base' },
  ide_email_principal: { destino: 'base' },
  ide_horarios_funcionamento: {
    destino: 'fato_oficial',
    configuracaoReal: 'businessHoursConfig',
    motivo: 'O horário que a IA usa é o estruturado das configurações, com fuso.',
  },
  ide_fuso_horario: {
    destino: 'fato_oficial',
    configuracaoReal: 'businessHoursConfig.timezone',
    motivo: 'O fuso vive junto do horário estruturado.',
  },
  ide_idiomas_atendimento: { destino: 'base' },
  ide_tempo_mercado: { destino: 'base' },
  ide_numero_colaboradores: { destino: 'base' },
  ide_atende_fora_horario: { destino: 'base' },
  ide_sazonalidade: { destino: 'base' },

  // ── posicionamento_marca ──────────────────────────────────────────
  pos_proposta_valor: { destino: 'base' },
  pos_diferenciais: { destino: 'base' },
  pos_dor_principal: { destino: 'base' },
  pos_nivel_mercado: { destino: 'base' },
  pos_concorrentes: {
    destino: 'fora_da_ia',
    motivo: 'Nome de concorrente na boca da IA só serve para o cliente ir pesquisar lá.',
  },
  pos_diferencial_vs_concorrentes: { destino: 'base' },
  pos_como_ser_percebida: { destino: 'base' },
  pos_palavras_proibidas: { destino: 'instrucao' },
  pos_termos_tecnicos: { destino: 'base' },
  pos_jargoes_setor: { destino: 'base' },
  pos_slogan: { destino: 'base' },
  pos_historia_marca: { destino: 'base' },
  pos_premios_certificacoes: { destino: 'base' },
  pos_depoimentos_referencia: { destino: 'base' },
  pos_o_que_nao_somos: { destino: 'instrucao' },
  pos_valores_empresa: { destino: 'base' },
  pos_promessa_entrega: { destino: 'base' },

  // ── publico_alvo ──────────────────────────────────────────
  pub_perfil_ideal: { destino: 'base' },
  pub_perfil_secundario: { destino: 'base' },
  pub_perfil_nao_desejado: {
    destino: 'fora_da_ia',
    motivo: 'Dito ao cliente errado, é ofensa. A recusa educada vive em qual_desqualificacao.',
  },
  pub_faixa_etaria: { destino: 'base' },
  pub_genero_predominante: { destino: 'base' },
  pub_ticket_medio: { destino: 'base' },
  pub_dores_comuns: { destino: 'base' },
  pub_objecoes_comuns: { destino: 'base' },
  pub_fatores_emocionais: { destino: 'base' },
  pub_quem_decide: { destino: 'base' },
  pub_quem_pesquisa: { destino: 'base' },
  pub_ciclo_decisao: { destino: 'base' },
  pub_como_descobrem: { destino: 'base' },
  pub_nivel_conhecimento: { destino: 'base' },
  pub_expectativa_resposta: { destino: 'base' },
  pub_sensibilidade_preco: { destino: 'base' },
  pub_recorrencia: { destino: 'base' },

  // ── tom_estilo_ia ──────────────────────────────────────────
  tom_principal: {
    destino: 'fato_oficial',
    configuracaoReal: 'tone',
    motivo: 'O tom já é uma linha do bloco vivo. Repetir só gastaria token.',
  },
  tom_formalidade: { destino: 'instrucao' },
  tom_uso_emojis: { destino: 'instrucao' },
  tom_nome_ia: {
    destino: 'fato_oficial',
    configuracaoReal: 'agentName',
    motivo: 'O nome do agente já abre o bloco vivo.',
  },
  tom_genero_ia: { destino: 'instrucao' },
  tom_estilo_consultivo: { destino: 'instrucao' },
  tom_cumprimento: {
    destino: 'fato_oficial',
    configuracaoReal: 'greetingMessage',
    motivo: 'A saudação tem bloco próprio, só no primeiro contato.',
  },
  tom_encerramento: { destino: 'instrucao' },
  tom_cliente_irritado: { destino: 'instrucao' },
  tom_cliente_inseguro: { destino: 'instrucao' },
  tom_cliente_premium: { destino: 'instrucao' },
  tom_cliente_inadimplente: { destino: 'instrucao' },
  tom_quando_insistir: { destino: 'instrucao' },
  tom_quando_nao_insistir: { destino: 'instrucao' },
  tom_frequencia_followup: { destino: 'instrucao' },
  tom_max_tentativas: { destino: 'instrucao' },
  tom_tamanho_mensagens: { destino: 'instrucao' },
  tom_usar_listas: { destino: 'instrucao' },
  tom_como_dizer_nao: { destino: 'instrucao' },
  tom_audio_imagem: { destino: 'instrucao' },

  // ── estrutura_comercial ──────────────────────────────────────────
  com_lista_servicos: { destino: 'base' },
  com_categorias: { destino: 'base' },
  com_servico_entrada: { destino: 'base' },
  com_maior_margem: {
    destino: 'fora_da_ia',
    motivo: 'Margem de lucro é dado interno; dito ao cliente, vira argumento contra a própria empresa.',
  },
  com_maior_volume: { destino: 'base' },
  com_servico_premium: { destino: 'base' },
  com_recorrencia: { destino: 'base' },
  com_upsell: { destino: 'base' },
  com_cross_sell: { destino: 'base' },
  com_combos_pacotes: { destino: 'base' },
  com_sazonais: { destino: 'base' },
  com_descontinuados: { destino: 'base' },
  com_nao_oferecer_sem_contexto: { destino: 'base' },
  com_tempo_entrega: { destino: 'base' },
  com_garantia: { destino: 'base' },
  com_pre_requisitos: { destino: 'base' },

  // ── qualificacao_comercial ──────────────────────────────────────────
  qual_lead_quente: { destino: 'base' },
  qual_lead_morno: { destino: 'base' },
  qual_lead_frio: { destino: 'base' },
  qual_perguntas_obrigatorias: { destino: 'instrucao' },
  qual_sinais_intencao: { destino: 'base' },
  qual_sinais_urgencia: { destino: 'base' },
  qual_objecao_preco: { destino: 'base' },
  qual_objecao_confianca: { destino: 'base' },
  qual_objecao_timing: { destino: 'base' },
  qual_pergunta_orcamento: { destino: 'base' },
  qual_pergunta_prazo: { destino: 'base' },
  qual_pergunta_decisor: { destino: 'base' },
  qual_score_minimo: { destino: 'base' },
  qual_informacoes_minimas: { destino: 'base' },
  qual_desqualificacao: { destino: 'instrucao' },
  qual_reengajamento: { destino: 'base' },

  // ── precos_condicoes ──────────────────────────────────────────
  pre_tipo_preco: { destino: 'base' },
  pre_tabela_precos: { destino: 'base' },
  pre_fatores_preco: { destino: 'base' },
  pre_quando_informar_preco: { destino: 'instrucao' },
  pre_desconto_maximo: { destino: 'instrucao' },
  pre_quem_aprova_desconto: { destino: 'instrucao' },
  pre_formas_pagamento: { destino: 'base' },
  pre_parcelamento: { destino: 'base' },
  pre_desconto_pix: { destino: 'base' },
  pre_politica_cancelamento: { destino: 'base' },
  pre_reembolso: { destino: 'base' },
  pre_cobranca_recorrente: { destino: 'base' },
  pre_taxa_avaliacao: { destino: 'base' },
  pre_nota_fiscal: { destino: 'base' },
  pre_orcamento_validade: { destino: 'base' },
  pre_negociacao_ia: { destino: 'instrucao' },

  // ── operacao_agenda ──────────────────────────────────────────
  ope_trabalha_agendamento: { destino: 'base' },
  ope_duracao_servicos: { destino: 'base' },
  ope_buffer_atendimentos: { destino: 'base' },
  ope_antecedencia_minima: { destino: 'base' },
  ope_antecedencia_maxima: { destino: 'base' },
  ope_encaixe: { destino: 'base' },
  ope_atende_urgencia: { destino: 'base' },
  ope_regras_cancelamento: { destino: 'base' },
  ope_politica_noshow: { destino: 'base' },
  ope_confirmacao_agendamento: { destino: 'base' },
  ope_lembretes: { destino: 'base' },
  ope_documentos_previos: { destino: 'base' },
  ope_preparo_previo: { destino: 'base' },
  ope_multiplos_profissionais: { destino: 'base' },
  ope_lista_espera: { destino: 'base' },
  ope_integracao_agenda: { destino: 'base' },

  // ── faq_conhecimento ──────────────────────────────────────────
  faq_perguntas_frequentes: { destino: 'base' },
  faq_perguntas_que_vendem: { destino: 'base' },
  faq_duvidas_preco: { destino: 'base' },
  faq_duvidas_agenda: { destino: 'base' },
  faq_duvidas_seguranca: { destino: 'base' },
  faq_respostas_proibidas: { destino: 'instrucao' },
  faq_links_uteis: { destino: 'base' },
  faq_materiais_apoio: { destino: 'base' },
  faq_informacoes_legais: { destino: 'base' },
  faq_diferenciais_tecnicos: { destino: 'base' },
  faq_pos_venda: { destino: 'base' },
  faq_mitos_verdades: { destino: 'base' },
  faq_contraindicacoes: { destino: 'base' },
  faq_parcerias: { destino: 'base' },
  faq_base_conhecimento_extra: {
    destino: 'fora_da_ia',
    motivo: 'É um recado para quem implanta, não conhecimento sobre o negócio.',
  },

  // ── crm_dados ──────────────────────────────────────────
  crm_dados_minimos: { destino: 'base' },
  crm_campos_desejados: {
    destino: 'funcao_do_sistema',
    emBreve: true,
    motivo: 'Preencher campo de CRM sozinha é função da plataforma. Hoje nenhum código lê esta resposta.',
  },
  crm_tags: {
    destino: 'funcao_do_sistema',
    emBreve: true,
    motivo: 'Etiqueta automática só existe por nó do Maestro, não por esta resposta.',
  },
  crm_origens: {
    destino: 'fora_da_ia',
    motivo: 'Configuração de rastreio de origem, não é assunto de conversa.',
  },
  crm_motivos_perda: {
    destino: 'fora_da_ia',
    motivo: 'Diagnóstico interno de vendas. A IA repetindo isso entrega o jogo.',
  },
  crm_proximo_passo: { destino: 'base' },
  crm_ltv: {
    destino: 'fora_da_ia',
    motivo: 'Métrica interna de gestão. Não ajuda a atender quem chega no WhatsApp.',
  },
  crm_frequencia_compra: { destino: 'fora_da_ia', motivo: 'Métrica interna de gestão, sem uso na conversa.' },
  crm_preferencias_registraveis: {
    destino: 'funcao_do_sistema',
    emBreve: true,
    motivo: 'Memória de preferência do cliente ainda não existe no produto.',
  },
  crm_historico_conversas: {
    destino: 'funcao_do_sistema',
    emBreve: true,
    motivo: 'Consultar conversa anterior é decisão do motor, não desta resposta.',
  },
  crm_aniversario: {
    destino: 'funcao_do_sistema',
    emBreve: true,
    motivo: 'Mensagem em data especial não existe no produto.',
  },
  crm_nps: {
    destino: 'funcao_do_sistema',
    emBreve: true,
    motivo: 'Pesquisa de satisfação depois do atendimento não existe no produto.',
  },
  crm_segmentacao_campanhas: {
    destino: 'fora_da_ia',
    motivo: 'Planejamento de campanha, sem uso no atendimento.',
  },
  crm_integracao_existente: {
    destino: 'fora_da_ia',
    motivo: 'Informação de infraestrutura, tratada na implantação.',
  },
  crm_lgpd: { destino: 'base' },

  // ── regras_ia ──────────────────────────────────────────
  reg_pode_responder: { destino: 'instrucao' },
  reg_nao_pode_responder: { destino: 'instrucao' },
  reg_pode_prometer: { destino: 'instrucao' },
  reg_nao_pode_prometer: { destino: 'instrucao' },
  reg_quando_informar_preco: { destino: 'instrucao' },
  reg_quando_pedir_documento: { destino: 'instrucao' },
  reg_quando_vender: { destino: 'instrucao' },
  reg_persuasiva_vs_neutra: { destino: 'instrucao' },
  reg_quando_escalar: { destino: 'instrucao' },
  reg_resumir_historico: {
    destino: 'funcao_do_sistema',
    emBreve: true,
    motivo: 'Resumo automático no transbordo ainda não é gerado.',
  },
  reg_pode_agendar_sozinha: {
    destino: 'funcao_do_sistema',
    emBreve: true,
    motivo: 'A autonomia do agendamento vem do tipo ativo e do direito ao recurso, não desta resposta.',
  },
  reg_pode_enviar_orcamento: {
    destino: 'funcao_do_sistema',
    emBreve: true,
    motivo: 'Envio automático de orçamento não existe no produto.',
  },
  reg_limite_mensagens: {
    destino: 'funcao_do_sistema',
    emBreve: true,
    motivo: 'Limite de mensagens antes de escalar não é aplicado por nenhum código.',
  },
  reg_horario_ia_vs_humano: {
    destino: 'funcao_do_sistema',
    emBreve: true,
    motivo: 'O horário que vale é o de Configurações; esta resposta não é lida.',
  },
  reg_assuntos_fora_escopo: { destino: 'instrucao' },
  reg_idioma_estrangeiro: { destino: 'instrucao' },
  reg_spam_abuso: { destino: 'instrucao' },

  // ── escalonamento ──────────────────────────────────────────
  esc_situacoes_obrigatorias: { destino: 'instrucao' },
  esc_prioridade_alta: {
    destino: 'funcao_do_sistema',
    emBreve: true,
    motivo: 'Fila com prioridade não existe no inbox.',
  },
  esc_reclamacao: { destino: 'instrucao' },
  esc_risco: { destino: 'instrucao' },
  esc_cliente_vip: { destino: 'instrucao' },
  esc_negociacao_especial: { destino: 'instrucao' },
  esc_urgencia: { destino: 'instrucao' },
  esc_falha_operacional: { destino: 'instrucao' },
  esc_para_quem_escalar: {
    destino: 'funcao_do_sistema',
    emBreve: true,
    motivo: 'Roteamento do transbordo por pessoa ainda não existe.',
  },
  esc_canais_escalonamento: {
    destino: 'funcao_do_sistema',
    emBreve: true,
    motivo: 'Avisar por e-mail, Slack ou chamado ainda não existe.',
  },
  esc_resumo_caso: {
    destino: 'funcao_do_sistema',
    emBreve: true,
    motivo: 'O resumo do caso no transbordo ainda não é gerado.',
  },
  esc_mensagem_transicao: {
    destino: 'funcao_do_sistema',
    configuracaoReal: 'handoffMessage',
    motivo: 'A mensagem que sai de verdade é a de Configurações.',
  },
  esc_sla_resposta: {
    destino: 'funcao_do_sistema',
    emBreve: true,
    motivo: 'Não há contagem de prazo de resposta humana no produto.',
  },
  esc_sem_humano_disponivel: {
    destino: 'funcao_do_sistema',
    emBreve: true,
    motivo: 'O plano B fora do horário ainda não é executado por código.',
  },
  esc_followup_pos_escalonamento: {
    destino: 'funcao_do_sistema',
    emBreve: true,
    motivo: 'Acompanhar o transbordo depois de resolvido não existe.',
  },
  esc_metricas: { destino: 'instrucao' },
  esc_retorno_ia: {
    destino: 'funcao_do_sistema',
    emBreve: true,
    motivo: 'Quem retoma a conversa depois do humano não é decidido por esta resposta.',
  },};

/**
 * Destino de uma pergunta qualquer.
 *
 * Pergunta de segmento e de especialidade não tem linha na tabela: ela é,
 * por definição, descrição do negócio, então cai em `base`. Chave que não
 * é pergunta nenhuma devolve `undefined`, e quem chama decide o que fazer
 * (o construtor do documento, por exemplo, ainda escreve a resposta com um
 * rótulo legível em vez de descartar dado do cliente).
 */
export function destinoDaPergunta(id: string): RegistroDeDestino | undefined {
  const registro = DESTINO_POR_PERGUNTA[id];
  if (registro) return registro;
  if (PERGUNTA_POR_ID.has(id)) {
    return { destino: 'base', motivo: 'Pergunta do segmento: descreve o negócio.' };
  }
  return undefined;
}

/** Ids com um destino. Ordem do catálogo. */
export function perguntasComDestino(destino: Destino): string[] {
  return Object.entries(DESTINO_POR_PERGUNTA)
    .filter(([, registro]) => registro.destino === destino)
    .map(([id]) => id);
}

/**
 * O que entra PRIMEIRO no bloco de regras do prompt.
 *
 * O bloco tem teto de tamanho (ele viaja em todo turno pago), então a
 * ordem não é enfeite: é quem sobrevive ao corte. Primeiro preço e
 * desconto, que é a pergunta comercial que mais chega; depois as
 * proibições, que são o que impede promessa inventada; depois qualificação
 * e escalonamento. O tom fica por último de propósito: o tom já tem uma
 * linha própria no bloco vivo, vinda das configurações.
 */
export const PRIORIDADE_DAS_REGRAS: readonly string[] = [
  'pre_quando_informar_preco',
  'pre_desconto_maximo',
  'pre_quem_aprova_desconto',
  'pre_negociacao_ia',
  'pos_palavras_proibidas',
  'pos_o_que_nao_somos',
  'faq_respostas_proibidas',
  'reg_nao_pode_prometer',
  'reg_nao_pode_responder',
  'reg_pode_prometer',
  'reg_pode_responder',
  'qual_perguntas_obrigatorias',
  'qual_desqualificacao',
  'esc_situacoes_obrigatorias',
  'esc_urgencia',
  'esc_risco',
  'esc_reclamacao',
];

/**
 * Ordem completa das regras: a prioridade acima e, depois dela, o resto na
 * ordem do questionário. Total e sem repetição, garantido por teste.
 */
export const ORDEM_DAS_REGRAS: readonly string[] = (() => {
  const instrucoes = perguntasComDestino('instrucao');
  const prioridade = PRIORIDADE_DAS_REGRAS.filter((id) => instrucoes.includes(id));
  const resto = instrucoes.filter((id) => !prioridade.includes(id));
  return [...prioridade, ...resto];
})();
