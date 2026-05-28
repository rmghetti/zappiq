/**
 * Mapeamento de niche (16 verticais do survey) -> FlowTemplateVertical
 * (enum atual com 5 valores) + metadata rica para cada template.
 *
 * Patch B (futuro) vai expandir o enum pra 16 verticais e gerar templates
 * pros 11 faltantes. Por enquanto: empty state inteligente.
 */

export type FlowTemplateVertical = 'DENTISTA' | 'SALAO_BELEZA' | 'ACADEMIA' | 'PETSHOP' | 'ECOMMERCE_MODA';
export type FlowTemplateCategory = 'BOAS_VINDAS_QUALIFICACAO' | 'AGENDAMENTO_RECUPERACAO' | 'NPS_POS_VENDA';

/**
 * niche key (organization.settings.niche) -> FlowTemplateVertical ou null.
 * null = vertical sem templates prontos (mostra Maestro Inteligente).
 */
export const NICHE_TO_TEMPLATE_VERTICAL: Record<string, FlowTemplateVertical | null> = {
  // Com templates prontos (5)
  dentista: 'DENTISTA',
  salao: 'SALAO_BELEZA',
  academia: 'ACADEMIA',
  petshop: 'PETSHOP',
  ecommerce: 'ECOMMERCE_MODA',
  // Sem templates ainda (11) — empty state inteligente
  psicologo: null,
  advogado: null,
  nutricionista: null,
  imobiliaria: null,
  restaurante: null,
  escola: null,
  servicos_tecnicos: null,
  clinica_medica: null,
  contabilidade: null,
  oficina: null,
  agencia_digital: null,
};

/**
 * Label human-readable de cada niche.
 */
export const NICHE_LABEL: Record<string, string> = {
  academia: 'Academia e Fitness',
  advogado: 'Advocacia',
  agencia_digital: 'Agencia Digital',
  clinica_medica: 'Clinica Medica',
  contabilidade: 'Contabilidade',
  dentista: 'Odontologia',
  ecommerce: 'Loja e E-commerce',
  escola: 'Educacao',
  imobiliaria: 'Imobiliaria',
  nutricionista: 'Nutricao',
  oficina: 'Oficina e Automotivo',
  petshop: 'Pet Shop e Veterinario',
  psicologo: 'Psicologia',
  restaurante: 'Restaurante e Food',
  salao: 'Salao e Beleza',
  servicos_tecnicos: 'Servicos Tecnicos',
};

export const NICHE_ICON: Record<string, string> = {
  academia: 'Dumbbell',
  advogado: 'Scale',
  agencia_digital: 'Globe',
  clinica_medica: 'Building2',
  contabilidade: 'BarChart3',
  dentista: 'Stethoscope',
  ecommerce: 'ShoppingBag',
  escola: 'BookOpen',
  imobiliaria: 'Home',
  nutricionista: 'Salad',
  oficina: 'Car',
  petshop: 'PawPrint',
  psicologo: 'Brain',
  restaurante: 'UtensilsCrossed',
  salao: 'Scissors',
  servicos_tecnicos: 'Wrench',
};

export const VERTICAL_LABEL: Record<FlowTemplateVertical, string> = {
  DENTISTA: 'Odontologia',
  SALAO_BELEZA: 'Salao e Beleza',
  ACADEMIA: 'Academia e Fitness',
  PETSHOP: 'Pet Shop e Veterinario',
  ECOMMERCE_MODA: 'E-commerce de Moda',
};

export const CATEGORY_LABEL: Record<FlowTemplateCategory, string> = {
  BOAS_VINDAS_QUALIFICACAO: 'Boas-vindas + Qualificacao',
  AGENDAMENTO_RECUPERACAO: 'Agendamento + Recuperacao',
  NPS_POS_VENDA: 'NPS pos-venda',
};

// ─────────────────────────────────────────────────────────────────────────
// TEMPLATE_RICH_INFO — indexado por `${vertical}_${category}`
// Conteudo: pitch curto, o que faz, indicado pra, metricas esperadas,
// complexidade, tempo de setup. Mostrado nos cards + modal preview.
// ─────────────────────────────────────────────────────────────────────────

export interface TemplateRichInfo {
  shortPitch: string;
  whatItDoes: string[];
  indicatedFor: string;
  expectedMetrics: Array<{ label: string; value: string }>;
  complexity: 'BAIXA' | 'MEDIA' | 'ALTA';
  estimatedSetupMinutes: number;
  bestUseCase: string;
}

export const TEMPLATE_RICH_INFO: Record<string, TemplateRichInfo> = {
  'DENTISTA_BOAS_VINDAS_QUALIFICACAO': {
    shortPitch: 'Recebe lead novo, qualifica em menos de 2 min e direciona pra agendamento.',
    whatItDoes: [
      'Apresentacao calorosa em 3 mensagens',
      'Pergunta o motivo da visita (avaliacao, urgencia, estetica, ortodontia)',
      'Detecta convenio ou particular',
      'Faz lead-scoring automatico (0-100)',
      'Repassa pra recepcao com contexto pronto',
    ],
    indicatedFor: 'Clinicas que recebem leads via Instagram Ads ou indicacao e querem economizar tempo da recepcao com perguntas repetitivas.',
    expectedMetrics: [
      { label: 'Tempo medio 1a resposta', value: '< 30 segundos' },
      { label: 'Taxa de qualificacao', value: '~68%' },
      { label: 'Conversao em agendamento', value: '~32%' },
    ],
    complexity: 'BAIXA',
    estimatedSetupMinutes: 5,
    bestUseCase: 'Use quando seu volume de leads novos passa de 30/semana e a recepcao esta sobrecarregada com triagem manual.',
  },
  'DENTISTA_AGENDAMENTO_RECUPERACAO': {
    shortPitch: 'Resgata leads que sumiram apos 24h sem agendar.',
    whatItDoes: [
      'Dispara automaticamente 24h apos a 1a conversa sem agendamento',
      'Lembra do interesse demonstrado',
      'Oferece horarios disponiveis no Google Calendar',
      'Salva como NOT_INTERESTED se recusar (libera funil)',
    ],
    indicatedFor: 'Clinicas com taxa alta de leads que "somem" depois da primeira conversa — sintoma comum em odonto particular.',
    expectedMetrics: [
      { label: 'Taxa de resposta no resgate', value: '~24%' },
      { label: 'Conversao do resgate', value: '~11%' },
      { label: 'Receita incremental mes', value: '+R$ 4-12k' },
    ],
    complexity: 'BAIXA',
    estimatedSetupMinutes: 3,
    bestUseCase: 'Combine com o template de boas-vindas pra fechar o ciclo de captura -> qualificacao -> resgate.',
  },
  'DENTISTA_NPS_POS_VENDA': {
    shortPitch: 'Coleta NPS automatico e converte promotores em reviews Google.',
    whatItDoes: [
      'Dispara apos consulta finalizada (status no CRM)',
      'Pergunta nota 0-10 em linguagem natural',
      'Promotores (>=9) recebem link de review Google',
      'Detratores (<7) ganham contato humano automatico',
      'Salva NPS rolling 30/90/365 dias',
    ],
    indicatedFor: 'Clinicas que querem subir ranking no Google Maps sem precisar pedir review manualmente paciente por paciente.',
    expectedMetrics: [
      { label: 'Taxa de resposta NPS', value: '~58%' },
      { label: 'Conversao em review Google', value: '~22% dos promotores' },
      { label: 'Reviews novas/mes', value: '+12-25' },
    ],
    complexity: 'BAIXA',
    estimatedSetupMinutes: 4,
    bestUseCase: 'Essencial pra clinicas que estao construindo reputacao online em bairros novos ou expandindo.',
  },
  'SALAO_BELEZA_BOAS_VINDAS_QUALIFICACAO': {
    shortPitch: 'Recebe lead, apresenta servicos e qualifica profissional + horario preferido.',
    whatItDoes: [
      'Saudacao com tom proximo e amigavel',
      'Lista servicos (corte, coloracao, escova, manicure)',
      'Pergunta preferencia de profissional',
      'Apresenta agenda livre da semana',
      'Repassa pra recepcao confirmar',
    ],
    indicatedFor: 'Saloes que querem reduzir o tempo de "ping-pong" entre cliente e recepcao pra fechar um simples agendamento.',
    expectedMetrics: [
      { label: 'Tempo de resposta', value: '< 1 min' },
      { label: 'Conversao em agendamento', value: '~45%' },
      { label: 'Ticket medio (combo upsell)', value: '+18%' },
    ],
    complexity: 'BAIXA',
    estimatedSetupMinutes: 5,
    bestUseCase: 'Salao com mais de 3 profissionais — Iza ajuda a distribuir agenda sem favoritismo.',
  },
  'SALAO_BELEZA_AGENDAMENTO_RECUPERACAO': {
    shortPitch: 'Cliente que nao agendou em 48h ganha cupom 10% off na primeira visita.',
    whatItDoes: [
      'Cron de 48h apos 1a conversa sem agendamento',
      'Envia oferta personalizada (10% off)',
      'Gera cupom unico no CRM',
      'Confirma agendamento via humano',
    ],
    indicatedFor: 'Saloes em bairro competitivo que perdem leads pro concorrente por inercia.',
    expectedMetrics: [
      { label: 'Taxa de resgate', value: '~19%' },
      { label: 'Custo do cupom', value: 'baixo (1a vez vira recorrente)' },
      { label: 'LTV pos-resgate', value: '~R$ 280' },
    ],
    complexity: 'BAIXA',
    estimatedSetupMinutes: 3,
    bestUseCase: 'Combine com campanha de Insta Ads — leads frios viram clientes em 1 semana.',
  },
  'SALAO_BELEZA_NPS_POS_VENDA': {
    shortPitch: 'NPS + pedido de foto pra Instagram (com permissao da cliente).',
    whatItDoes: [
      'Dispara 2h apos servico finalizado',
      'Pergunta nota 0-10',
      'Promotores recebem pedido educado de foto pra repost no Insta',
      'Detratores recebem contato pessoal da gerente',
    ],
    indicatedFor: 'Saloes que dependem de Instagram pra marketing organico — cada cliente promotora vira contedo.',
    expectedMetrics: [
      { label: 'Taxa de resposta NPS', value: '~62%' },
      { label: 'Fotos compartilhadas/mes', value: '+20-40' },
      { label: 'Alcance organico Insta', value: '+30%' },
    ],
    complexity: 'BAIXA',
    estimatedSetupMinutes: 4,
    bestUseCase: 'Salao que faz transformacoes visuais (coloracao, alongamento, design) — cada foto vale ouro.',
  },
  'ACADEMIA_BOAS_VINDAS_QUALIFICACAO': {
    shortPitch: 'Lead novo ganha aula experimental gratis com qualificacao de objetivo.',
    whatItDoes: [
      'Oferece aula experimental 100% gratuita',
      'Qualifica objetivo (emagrecimento, hipertrofia, condicionamento)',
      'Pergunta dia e horario preferido',
      'Agenda direto no sistema',
      'Repassa pra recepcao com perfil completo',
    ],
    indicatedFor: 'Academias que dependem de conversao no trial pra fechar matricula — quase todas.',
    expectedMetrics: [
      { label: 'Conversao em aula experimental', value: '~52%' },
      { label: 'Show-up rate da experimental', value: '~71%' },
      { label: 'Conversao em matricula', value: '~38% dos que aparecem' },
    ],
    complexity: 'BAIXA',
    estimatedSetupMinutes: 6,
    bestUseCase: 'Academia com aula gratuita ja no plano comercial — Iza maximiza o uso desse beneficio.',
  },
  'ACADEMIA_AGENDAMENTO_RECUPERACAO': {
    shortPitch: 'Membro inativo 14 dias recebe convite pra sessao gratis com personal trainer.',
    whatItDoes: [
      'Cron diario detecta membros sem check-in ha 14d',
      'Mensagem motivacional personalizada',
      'Detecta motivo (preguica, dor, tempo)',
      'Oferece 1 sessao gratis com personal',
      'Agenda a sessao',
    ],
    indicatedFor: 'Academias que sofrem com churn no 2o-3o mes — reativacao precoce vale 10x mais que captacao nova.',
    expectedMetrics: [
      { label: 'Taxa de resposta', value: '~31%' },
      { label: 'Retencao apos sessao', value: '~58%' },
      { label: 'Churn reduzido', value: '-12 a -18%' },
    ],
    complexity: 'MEDIA',
    estimatedSetupMinutes: 8,
    bestUseCase: 'Academia que ja tem personais ociosos em horarios off-peak — converte custo fixo em retencao.',
  },
  'ACADEMIA_NPS_POS_VENDA': {
    shortPitch: 'NPS mensal recorrente pra detectar churn antes que acontece.',
    whatItDoes: [
      'Cron mensal pra todos os membros ativos',
      'Pergunta nota 0-10 + sugestao de melhoria',
      'Salva resposta historica (cohort)',
      'Alerta gestao se detrata cair (insight ralo pre-cancelamento)',
    ],
    indicatedFor: 'Academia que quer dado quantitativo de satisfacao pra decisao gerencial (nova aula, novo equipamento, etc.).',
    expectedMetrics: [
      { label: 'Taxa de resposta NPS', value: '~44%' },
      { label: 'Antecipacao de churn', value: '~3 semanas antes' },
      { label: 'Decisoes acionadas/mes', value: '~5-12' },
    ],
    complexity: 'BAIXA',
    estimatedSetupMinutes: 4,
    bestUseCase: 'Academia com mais de 200 membros ativos onde voce nao consegue mais conhecer todo mundo pelo nome.',
  },
  'PETSHOP_BOAS_VINDAS_QUALIFICACAO': {
    shortPitch: 'Cadastra pet (nome, raca, idade) automaticamente e oferece primeiro banho com desconto.',
    whatItDoes: [
      'Pergunta nome do pet',
      'Extrai raca + idade da conversa',
      'Cria contato + pet vinculado no CRM',
      'Oferece banho+tosa 15% off pra primeira visita',
    ],
    indicatedFor: 'Petshop que quer construir base completa com dados de cada pet pra personalizar campanhas futuras.',
    expectedMetrics: [
      { label: 'Conversao em 1a visita', value: '~41%' },
      { label: 'Cadastros completos com raca/idade', value: '~89%' },
      { label: 'Frequencia retorno', value: 'a cada 28 dias' },
    ],
    complexity: 'MEDIA',
    estimatedSetupMinutes: 7,
    bestUseCase: 'Petshop em fase de crescimento (3-12 meses) com base ainda pequena — cada cadastro completo vale anos.',
  },
  'PETSHOP_AGENDAMENTO_RECUPERACAO': {
    shortPitch: 'Banho mensal automatico: lembra a cada 30 dias e agenda direto.',
    whatItDoes: [
      'Cron 30d apos ultimo banho',
      'Lembrete personalizado com nome do pet',
      'Iza confirma e agenda',
      'Sincroniza com agenda do banhista preferido',
    ],
    indicatedFor: 'Petshop que tem clientes recorrentes mas perde reagendamento por simples esquecimento do tutor.',
    expectedMetrics: [
      { label: 'Taxa de reagendamento', value: '~67%' },
      { label: 'Frequencia ticket/cliente', value: '+1.4x ao ano' },
      { label: 'Receita recorrente/cliente', value: '+R$ 480/ano' },
    ],
    complexity: 'BAIXA',
    estimatedSetupMinutes: 5,
    bestUseCase: 'Petshop com 50+ clientes ativos — automacao paga sozinha em 2 semanas.',
  },
  'PETSHOP_NPS_POS_VENDA': {
    shortPitch: 'Foto do pet + NPS pos-banho. Promotor ganha cupom 5%.',
    whatItDoes: [
      'Apos banho, manda foto do pet limpo',
      'Pergunta nota 0-10',
      'Promotores ganham cupom 5% na proxima',
      'Detratores ganham contato',
    ],
    indicatedFor: 'Petshop que quer transformar cada banho em contedo gerado pelo cliente (foto fica linda).',
    expectedMetrics: [
      { label: 'Taxa de resposta', value: '~71%' },
      { label: 'Fotos compartilhadas pelo cliente', value: '~40% das promotoras' },
      { label: 'Cupom resgatado/mes', value: '~28' },
    ],
    complexity: 'BAIXA',
    estimatedSetupMinutes: 4,
    bestUseCase: 'Combine com banheiro fotogenico no salao — fotos viram conteudo organico no Insta.',
  },
  'ECOMMERCE_MODA_BOAS_VINDAS_QUALIFICACAO': {
    shortPitch: 'Lead novo ganha cupom 10% + recomendacao de pecas pelo estilo.',
    whatItDoes: [
      'Boas-vindas + cupom PRIMEIRA10',
      'Qualifica estilo (casual, festa, trabalho)',
      'Manda link de catalogo filtrado pelo estilo',
      'Marca interesse no CRM pra remarketing',
    ],
    indicatedFor: 'E-commerce de moda que tem trafego mas baixa conversao em primeira compra — falta personalizacao.',
    expectedMetrics: [
      { label: 'Conversao 1a compra', value: '~14%' },
      { label: 'Ticket medio 1a compra', value: 'R$ 210' },
      { label: 'CAC reduzido', value: '-22%' },
    ],
    complexity: 'BAIXA',
    estimatedSetupMinutes: 6,
    bestUseCase: 'E-com com Insta Ads rodando — Iza converte lead frio do anuncio em cliente.',
  },
  'ECOMMERCE_MODA_AGENDAMENTO_RECUPERACAO': {
    shortPitch: 'Carrinho abandonado 2h: oferta de frete gratis pra finalizar hoje.',
    whatItDoes: [
      'Detecta carrinho abandonado em 2h',
      'Manda lembrete do produto especifico',
      'Oferece frete gratis se finalizar hoje',
      'Link direto pro checkout com cupom aplicado',
    ],
    indicatedFor: 'E-com com taxa de abandono > 65% (media do setor) — recupera 10-20% disso.',
    expectedMetrics: [
      { label: 'Taxa de resgate', value: '~16%' },
      { label: 'Custo do frete (margem)', value: 'R$ 14-22' },
      { label: 'Receita incremental/mes', value: '+R$ 8-30k' },
    ],
    complexity: 'MEDIA',
    estimatedSetupMinutes: 7,
    bestUseCase: 'E-com com Shopify/VTEX integrado — Iza puxa dados do carrinho automaticamente.',
  },
  'ECOMMERCE_MODA_NPS_POS_VENDA': {
    shortPitch: 'Pos-entrega: NPS + pedido de foto vestindo pra reposta no Insta.',
    whatItDoes: [
      'Dispara apos rastreio mostrar ENTREGUE',
      'Pergunta se gostou (0-10)',
      'Promotores ganham pedido de foto + marcacao no Insta',
      'Foto vira contedo organico',
    ],
    indicatedFor: 'Marca de moda autoral que vive de prova social — cada foto compartilhada equivale a R$ 60-200 em midia paga.',
    expectedMetrics: [
      { label: 'Taxa de resposta', value: '~48%' },
      { label: 'Fotos compartilhadas/mes', value: '~25-50' },
      { label: 'Alcance organico Insta', value: '+45%' },
    ],
    complexity: 'BAIXA',
    estimatedSetupMinutes: 5,
    bestUseCase: 'Marca em fase de crescimento sem orcamento alto de Ads — fotos das clientes substituem ad creative.',
  },
};

/**
 * Helper: pega rich info de um template (com fallback seguro).
 */
export function getTemplateRichInfo(vertical: string, category: string): TemplateRichInfo | null {
  const key = `${vertical}_${category}`;
  return TEMPLATE_RICH_INFO[key] || null;
}
