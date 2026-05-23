/**
 * surveyExamples.ts — exemplos de resposta (placeholders) por SEGMENTO (niche).
 *
 * Por que existe: os placeholders do survey global (surveyTypes.ts) foram
 * escritos com exemplos de odontologia ("Ex: Clínica Sorriso Perfeito"). Pra um
 * restaurante, pet shop etc. isso fica errado. Aqui mapeamos, por niche e por
 * id da pergunta, um exemplo RELEVANTE — resolvido em runtime pelo niche da org.
 *
 * Estratégia (Fase 1):
 *   - GENERIC: exemplos NEUTROS (não amarrados a nenhum segmento) para as
 *     perguntas mais "cara-de-dentista". Garante que nenhum cliente veja exemplo
 *     de outro segmento, mesmo antes do seu niche ter set próprio.
 *   - NICHE_EXAMPLES[niche]: exemplos específicos do segmento (começamos por
 *     'restaurante'; os demais nichos entram em ondas seguintes).
 *
 * Resolução: examplePlaceholder(niche, id, fallbackOriginal)
 *   = NICHE_EXAMPLES[niche]?.[id] ?? GENERIC[id] ?? fallbackOriginal
 *
 * Niches válidos (key de surveySegments): academia, dentista, psicologo,
 * advogado, nutricionista, salao, petshop, imobiliaria, restaurante, escola,
 * servicos_tecnicos, clinica_medica, contabilidade, oficina, agencia_digital,
 * ecommerce.
 */

type Examples = Record<string, string>;

// ── Neutros (qualquer segmento) — usados quando o niche ainda não tem set ────
const GENERIC: Examples = {
  ide_nome_fantasia: 'Ex: o nome que seus clientes usam pra te encontrar',
  ide_razao_social: 'Ex: Razão Social da sua empresa Ltda.',
  pos_proposta_valor: 'Ex: o que você entrega de melhor e por que os clientes escolhem você',
  pos_diferenciais: 'Ex:\n1. Diferencial nº 1\n2. Diferencial nº 2\n3. Diferencial nº 3',
  pos_dor_principal: 'Ex: o principal problema que seu cliente tem e que você resolve',
  pos_concorrentes: 'Ex:\n1. Concorrente A — foco em preço\n2. Concorrente B — referência no bairro',
  pos_diferencial_vs_concorrentes: 'Ex: o que só você faz e os concorrentes não',
  pos_jargoes_setor: 'Ex: termos técnicos do seu setor que a IA deve conhecer',
  pos_slogan: 'Ex: a frase que resume seu negócio',
  pos_historia_marca: 'Ex: como e por que o negócio começou',
  pos_o_que_nao_somos: 'Ex: o que seu negócio NÃO faz / NÃO atende',
  pos_como_ser_percebida: 'Ex: confiável, moderna, acolhedora',
  pub_perfil_ideal: 'Ex: idade, perfil, o que valoriza, onde está',
  pub_perfil_secundario: 'Ex: um segundo público relevante',
  pub_perfil_nao_desejado: 'Ex: o tipo de cliente que não é o seu',
  pub_ticket_medio: 'Ex: valor médio que um cliente gasta',
  pub_dores_comuns: 'Ex:\n1. Dor mais comum\n2. Segunda dor\n3. Terceira dor',
  pub_objecoes_comuns: 'Ex:\n1. "Está caro"\n2. "Vou pensar"\n3. "Preciso ver com alguém"',
  tom_nome_ia: 'Ex: um nome próprio para sua IA (ou deixe em branco)',
  tom_cumprimento: 'Ex: como a IA cumprimenta na primeira mensagem',
  com_lista_servicos: 'Ex: liste seus principais produtos/serviços e faixas de preço',
  com_categorias: 'Ex: como seus produtos/serviços se agrupam',
  com_servico_entrada: 'Ex: o produto/serviço de entrada (porta de entrada)',
  com_maior_margem: 'Ex: o serviço/produto de maior margem',
  com_maior_volume: 'Ex: o serviço/produto que mais vende',
  com_servico_premium: 'Ex: seu serviço/produto premium e o preço',
  com_combos_pacotes: 'Ex: combos ou pacotes que você oferece',
  com_garantia: 'Ex: qual garantia você oferece e por quanto tempo',
  qual_objecao_preco: 'Ex: como responder quando o cliente acha caro',
  pre_tabela_precos: 'Ex: sua tabela de preços principal',
  pre_parcelamento: 'Ex: formas de pagamento e parcelamento',
  faq_perguntas_frequentes: 'Ex:\nP: pergunta comum?\nR: resposta padrão',
  faq_contraindicacoes: 'Ex: restrições ou casos que você não atende',
  crm_tags: 'Ex: #lead-quente, #cliente-fiel, #orcamento, #retorno',
  crm_ltv: 'Ex: quanto um cliente gasta ao longo do relacionamento',
};

// ── Restaurante (Fase 1 — caso piloto Ghetti Italian Food) ───────────────────
const restaurante: Examples = {
  ide_nome_fantasia: 'Ex: Restaurante Dona Maria',
  ide_razao_social: 'Ex: Dona Maria Alimentos Ltda.',
  pos_proposta_valor: 'Ex: Comida caseira italiana, massa fresca feita na hora e ambiente familiar.',
  pos_diferenciais: 'Ex:\n1. Massa fresca produzida no dia\n2. Receitas de família há 30 anos\n3. Delivery em até 40 min na região',
  pos_dor_principal: 'Ex: Clientes que querem comer bem sem cozinhar e cansaram de fast-food sem qualidade.',
  pos_concorrentes: 'Ex:\n1. Cantina do Centro — foco em preço baixo\n2. Trattoria Bella — referência em massas\n3. Rede de pizzarias — muitas unidades',
  pos_diferencial_vs_concorrentes: 'Ex: Ao contrário das redes, aqui a massa é fresca e o molho é feito todo dia.',
  pos_jargoes_setor: 'Ex: "couvert", "rodízio", "à la carte", "mise en place", "delivery", "comanda"',
  pos_slogan: 'Ex: "O sabor da Itália pertinho de você."',
  pos_historia_marca: 'Ex: "Fundado em 1995 pela nona Maria, que trouxe as receitas da Calábria."',
  pos_o_que_nao_somos: 'Ex: Não fazemos comida congelada. Não atendemos eventos acima de 100 pessoas. Não temos opção self-service.',
  pos_como_ser_percebida: 'Ex: acolhedor, autêntico, caseiro, de confiança',
  pub_perfil_ideal: 'Ex: Famílias e casais 30-55 anos que valorizam comida boa e ambiente aconchegante.',
  pub_perfil_secundario: 'Ex: Empresas da região buscando almoço executivo no dia a dia.',
  pub_perfil_nao_desejado: 'Ex: Quem busca só o prato mais barato e reclama de couvert.',
  pub_ticket_medio: 'Ex: R$ 70 por pessoa no jantar, R$ 45 no almoço executivo',
  pub_dores_comuns: 'Ex:\n1. Não saber o tempo de entrega\n2. Dúvida se tem opção sem glúten\n3. Achar que vai demorar pra ser atendido',
  pub_objecoes_comuns: 'Ex:\n1. "A entrega demora?"\n2. "Tem opção vegetariana?"\n3. "O couvert é obrigatório?"',
  tom_nome_ia: 'Ex: "Bella", "Atendente do Dona Maria", deixe em branco se preferir sem nome',
  tom_cumprimento: 'Ex: "Olá! 😊 Bem-vindo(a) ao Restaurante Dona Maria! Quer ver o cardápio ou fazer um pedido?"',
  com_lista_servicos: 'Ex:\n- Rodízio de massas (R$ 79)\n- Pizza individual (R$ 35-55)\n- Almoço executivo (R$ 39,90)\n- Sobremesas artesanais (R$ 18-25)',
  com_categorias: 'Ex:\n- Entradas: bruschetta, antepasto\n- Massas: nhoque, ravioli, lasanha\n- Pizzas\n- Sobremesas e bebidas',
  com_servico_entrada: 'Ex: Almoço executivo do dia — preço acessível pra atrair cliente novo',
  com_maior_margem: 'Ex: Vinhos e sobremesas — margem acima de 65%',
  com_maior_volume: 'Ex: Almoço executivo — 50% dos pedidos no almoço',
  com_servico_premium: 'Ex: Jantar harmonizado com vinhos — R$ 250 por pessoa',
  com_combos_pacotes: 'Ex:\n- Combo Casal (2 massas + 1 sobremesa + 1 vinho) R$ 159\n- Almoço executivo (prato + bebida + sobremesa) R$ 49,90',
  com_garantia: 'Ex: Se o prato vier errado ou frio, refazemos na hora — sem custo.',
  qual_objecao_preco: 'Ex: Destacar a porção generosa, a massa fresca e o combo casal que sai mais em conta.',
  pre_tabela_precos: 'Ex:\n- Almoço executivo: R$ 39,90\n- Rodízio de massas: R$ 79\n- Pizza grande: R$ 55-75\n- Delivery: pedido mínimo R$ 30',
  pre_parcelamento: 'Ex: Crédito, débito, Pix e VR/VA. Acima de R$ 200, parcela em 2x sem juros.',
  faq_perguntas_frequentes: 'Ex:\nP: Fazem delivery?\nR: Sim, pelo iFood e pelo nosso WhatsApp, entrega em até 40 min.\nP: Tem opção sem glúten?\nR: Sim, massas sem glúten sob consulta.',
  faq_contraindicacoes: 'Ex: Alguns pratos contêm glúten, lactose e frutos do mar — sempre avisar. Temos opções veganas e sem glúten.',
  crm_tags: 'Ex: #delivery, #reserva, #aniversariante, #cliente-fiel, #evento, #vegetariano',
  crm_ltv: 'Ex: R$ 2.400 por ano (cliente que volta ~2x por mês)',
};

export const NICHE_EXAMPLES: Record<string, Examples> = {
  restaurante,
  // Próximas ondas: academia, dentista, psicologo, advogado, nutricionista,
  // salao, petshop, imobiliaria, escola, servicos_tecnicos, clinica_medica,
  // contabilidade, oficina, agencia_digital, ecommerce.
};

/**
 * Resolve o placeholder de exemplo para um campo do survey, dado o niche da org.
 * Ordem: exemplo do niche > exemplo neutro (GENERIC) > placeholder original.
 */
export function examplePlaceholder(
  niche: string | undefined | null,
  questionId: string,
  fallback?: string,
): string | undefined {
  const n = (niche || '').trim().toLowerCase();
  return NICHE_EXAMPLES[n]?.[questionId] ?? GENERIC[questionId] ?? fallback;
}
