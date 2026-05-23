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

// ── Odontologia (dentista) ───────────────────────────────────────────────────
const dentista: Examples = {
  ide_nome_fantasia: 'Ex: Clínica Sorriso Perfeito',
  ide_razao_social: 'Ex: Sorriso Perfeito Odontologia Ltda.',
  pos_proposta_valor: 'Ex: Odontologia humanizada, sem dor e com tecnologia de ponta — do clareamento ao implante.',
  pos_diferenciais: 'Ex:\n1. Atendimento sem fila — horário respeitado\n2. Sedação para pacientes com medo\n3. Parcelamento em até 24x\n4. Scanner intraoral (sem moldagem)',
  pos_dor_principal: 'Ex: Pessoas que têm medo de dentista e adiam tratamentos por anos.',
  pos_concorrentes: 'Ex:\n1. Clínica popular — foco em preço\n2. Dr. Silva — referência em implante\n3. Rede de franquias odontológicas',
  pos_jargoes_setor: 'Ex: "canal", "prótese", "aparelho fixo", "clareamento", "faceta", "implante", "profilaxia"',
  pos_slogan: 'Ex: "Seu sorriso, nossa missão."',
  pos_o_que_nao_somos: 'Ex: Não atendemos emergência 24h. Não fazemos ortodontia infantil. Não aceitamos convênios.',
  pub_perfil_ideal: 'Ex: Adultos 30-55 anos, classe B, que valorizam estética e atendimento sem dor.',
  pub_perfil_nao_desejado: 'Ex: Quem busca só o orçamento mais barato e não valoriza qualidade clínica.',
  pub_ticket_medio: 'Ex: R$ 350 por consulta; R$ 4.500 por tratamento de implante.',
  pub_dores_comuns: 'Ex:\n1. Medo de sentir dor\n2. Preço alto / como parcelar\n3. Não saber qual tratamento precisa\n4. Vergonha do sorriso',
  pub_objecoes_comuns: 'Ex:\n1. "Está caro"\n2. "Vou pensar"\n3. "Dói?"\n4. "Aceita meu convênio?"',
  tom_cumprimento: 'Ex: "Olá! 😊 Seja bem-vindo(a) à Clínica Sorriso Perfeito! Em que posso ajudar com seu sorriso?"',
  com_lista_servicos: 'Ex:\n- Avaliação (gratuita)\n- Limpeza (R$ 180)\n- Clareamento (R$ 800-1.500)\n- Implante (a partir de R$ 3.500)\n- Aparelho ortodôntico',
  com_categorias: 'Ex:\n- Estética: clareamento, facetas, lentes\n- Reabilitação: implante, prótese\n- Ortodontia: aparelho\n- Preventiva: limpeza',
  com_servico_premium: 'Ex: Protocolo de implante completo — R$ 25.000',
  com_combos_pacotes: 'Ex: Pacote Sorriso (avaliação + limpeza + clareamento) R$ 1.200',
  com_garantia: 'Ex: Implante com garantia vitalícia do pino; faceta com 5 anos.',
  qual_objecao_preco: 'Ex: Mostrar parcelamento em 24x, comparar com o custo de não tratar e oferecer avaliação gratuita.',
  pre_tabela_precos: 'Ex:\n- Consulta inicial: gratuita\n- Limpeza: R$ 180\n- Clareamento: R$ 800-1.500\n- Implante: a partir de R$ 3.500',
  pre_parcelamento: 'Ex: Até 24x no cartão; entrada + boleto; desconto à vista no Pix.',
  faq_perguntas_frequentes: 'Ex:\nP: Aceita convênio?\nR: Trabalhamos com particular e alguns convênios — confirme o seu.\nP: Dói?\nR: Usamos anestesia e sedação; o conforto é prioridade.\nP: Parcela?\nR: Sim, até 24x.',
  faq_contraindicacoes: 'Ex: Gestantes não fazem clareamento; diabéticos precisam de avaliação antes de cirurgia.',
  crm_tags: 'Ex: #lead-quente, #implante, #ortodontia, #clareamento, #retorno, #convenio',
  crm_ltv: 'Ex: R$ 6.000 ao longo de 3 anos (tratamentos + manutenção).',
};

// ── Salão de beleza / barbearia (salao) ──────────────────────────────────────
const salao: Examples = {
  ide_nome_fantasia: 'Ex: Studio Bella Hair',
  ide_razao_social: 'Ex: Bella Hair Beleza e Estética Ltda.',
  pos_proposta_valor: 'Ex: Beleza e autoestima em um ambiente acolhedor, com profissionais especializados em coloração e tratamentos.',
  pos_diferenciais: 'Ex:\n1. Especialistas em loiros e mechas\n2. Produtos profissionais (sem amônia)\n3. Café e wi-fi enquanto espera\n4. Horário marcado, sem espera',
  pos_dor_principal: 'Ex: Clientes cansadas de coloração malfeita e de salão que atrasa o horário.',
  pos_concorrentes: 'Ex:\n1. Salão do bairro — preço baixo\n2. Rede de franquias\n3. Profissional autônoma em casa',
  pos_jargoes_setor: 'Ex: "mechas", "ombré", "progressiva", "matização", "corte repicado", "hidratação", "escova"',
  pos_slogan: 'Ex: "Realçando a sua beleza natural."',
  pos_o_que_nao_somos: 'Ex: Não atendemos sem agendamento. Não fazemos serviços de estética facial. Não vendemos produtos no varejo.',
  pub_perfil_ideal: 'Ex: Mulheres 25-50 anos que cuidam da aparência e valorizam um profissional de confiança.',
  pub_perfil_nao_desejado: 'Ex: Quem só procura o preço mais baixo e remarca em cima da hora.',
  pub_ticket_medio: 'Ex: R$ 180 por visita; R$ 450 quando inclui coloração.',
  pub_dores_comuns: 'Ex:\n1. Medo de errar a cor\n2. Demora no atendimento\n3. Cabelo danificado por química\n4. Não conseguir horário',
  pub_objecoes_comuns: 'Ex:\n1. "Quanto custa a mecha?"\n2. "Tem horário hoje?"\n3. "Vai estragar meu cabelo?"\n4. "Demora quanto?"',
  tom_cumprimento: 'Ex: "Oi, linda! 💇‍♀️ Bem-vinda ao Studio Bella Hair! Quer agendar um horário ou saber sobre nossos serviços?"',
  com_lista_servicos: 'Ex:\n- Corte feminino (R$ 90)\n- Escova (R$ 70)\n- Coloração (R$ 250)\n- Mechas/luzes (R$ 350-600)\n- Progressiva (R$ 280)',
  com_categorias: 'Ex:\n- Cortes\n- Coloração e mechas\n- Tratamentos (hidratação, botox capilar)\n- Finalização (escova, penteado)',
  com_servico_premium: 'Ex: Transformação completa (corte + coloração + tratamento) — R$ 900',
  com_combos_pacotes: 'Ex: Pacote Noiva (teste + dia do casamento) R$ 1.200; Combo Corte + Escova R$ 140',
  com_garantia: 'Ex: Retoque de cor grátis em até 7 dias se não ficar como combinado.',
  qual_objecao_preco: 'Ex: Mostrar a durabilidade do serviço, a qualidade dos produtos e oferecer um combo.',
  pre_tabela_precos: 'Ex:\n- Corte: R$ 90\n- Escova: R$ 70\n- Coloração: R$ 250\n- Mechas: R$ 350-600',
  pre_parcelamento: 'Ex: Pix, débito e crédito; acima de R$ 300 parcela em 2x.',
  faq_perguntas_frequentes: 'Ex:\nP: Precisa agendar?\nR: Sim, trabalhamos com horário marcado.\nP: Quanto custa mechas?\nR: De R$ 350 a R$ 600 conforme o comprimento.\nP: Atende domingo?\nR: Não, de terça a sábado.',
  faq_contraindicacoes: 'Ex: Química em cabelo muito danificado exige avaliação; gestantes só com liberação.',
  crm_tags: 'Ex: #coloracao, #mechas, #cliente-fiel, #noiva, #aniversariante',
  crm_ltv: 'Ex: R$ 3.600/ano (cliente que volta a cada 4-6 semanas).',
};

// ── Academia / fitness (academia) ────────────────────────────────────────────
const academia: Examples = {
  ide_nome_fantasia: 'Ex: PowerFit Academia',
  ide_razao_social: 'Ex: PowerFit Atividades Físicas Ltda.',
  pos_proposta_valor: 'Ex: Treino com acompanhamento de verdade, equipamentos de ponta e ambiente motivador pra você bater suas metas.',
  pos_diferenciais: 'Ex:\n1. Avaliação física e treino individualizado\n2. Aulas coletivas inclusas\n3. App de acompanhamento\n4. Aberto das 5h às 23h',
  pos_dor_principal: 'Ex: Quem quer emagrecer/ganhar massa mas não sabe treinar sozinho e desiste por falta de acompanhamento.',
  pos_concorrentes: 'Ex:\n1. Rede low-cost (só musculação)\n2. Academia de bairro\n3. Personal autônomo',
  pos_jargoes_setor: 'Ex: "hipertrofia", "HIIT", "avaliação física", "ficha de treino", "funcional", "cross", "plano anual"',
  pos_slogan: 'Ex: "Sua melhor versão começa aqui."',
  pos_o_que_nao_somos: 'Ex: Não somos low-cost sem suporte. Não vendemos suplemento. Não temos piscina.',
  pub_perfil_ideal: 'Ex: Adultos 20-45 anos que querem resultado com acompanhamento e aulas variadas.',
  pub_perfil_nao_desejado: 'Ex: Quem só busca a mensalidade mais barata e não usa o acompanhamento.',
  pub_ticket_medio: 'Ex: R$ 130/mês no plano mensal; R$ 99/mês no anual.',
  pub_dores_comuns: 'Ex:\n1. Não saber treinar sozinho\n2. Falta de motivação\n3. Medo de não ter resultado\n4. Horário que cabe na rotina',
  pub_objecoes_comuns: 'Ex:\n1. "Quanto é a mensalidade?"\n2. "Tem fidelidade?"\n3. "Tem aula de spinning?"\n4. "Posso fazer aula experimental?"',
  tom_cumprimento: 'Ex: "Fala! 💪 Bem-vindo(a) à PowerFit! Quer agendar uma aula experimental ou conhecer nossos planos?"',
  com_lista_servicos: 'Ex:\n- Musculação\n- Aulas coletivas (spinning, funcional, jump)\n- Avaliação física\n- Personal trainer\n- Plano anual/mensal',
  com_categorias: 'Ex:\n- Musculação\n- Aulas coletivas\n- Treino personalizado\n- Avaliação e nutrição',
  com_servico_premium: 'Ex: Plano Black (musculação + todas as aulas + personal + avaliação) R$ 299/mês',
  com_combos_pacotes: 'Ex: Plano anual R$ 99/mês; Dupla (2 pessoas) com 15% off; Trimestral R$ 119/mês',
  com_garantia: 'Ex: 7 dias de garantia — não gostou, devolvemos a primeira mensalidade.',
  qual_objecao_preco: 'Ex: Comparar custo/dia, destacar aulas inclusas e oferecer aula experimental gratuita.',
  pre_tabela_precos: 'Ex:\n- Mensal: R$ 130\n- Trimestral: R$ 119/mês\n- Anual: R$ 99/mês\n- Aula avulsa: R$ 30',
  pre_parcelamento: 'Ex: Anual em 12x no cartão; mensal recorrente; Pix com desconto.',
  faq_perguntas_frequentes: 'Ex:\nP: Tem aula experimental?\nR: Sim, grátis! Agende pelo WhatsApp.\nP: Tem fidelidade?\nR: Só no plano anual.\nP: Qual o horário?\nR: Seg-Sex 5h-23h, Sáb 8h-14h.',
  faq_contraindicacoes: 'Ex: Para condições cardíacas ou gestantes, pedimos liberação médica antes de iniciar.',
  crm_tags: 'Ex: #aula-experimental, #plano-anual, #renovacao, #personal, #emagrecimento',
  crm_ltv: 'Ex: R$ 1.400/ano por aluno (mensalidade média × retenção).',
};

// ── Pet shop / veterinário (petshop) ─────────────────────────────────────────
const petshop: Examples = {
  ide_nome_fantasia: 'Ex: Mundo Pet',
  ide_razao_social: 'Ex: Mundo Pet Comércio e Serviços Ltda.',
  pos_proposta_valor: 'Ex: Cuidado completo pro seu pet em um só lugar: banho & tosa, veterinário e produtos, com carinho de quem ama animais.',
  pos_diferenciais: 'Ex:\n1. Banho & tosa com hora marcada\n2. Veterinário todos os dias\n3. Leva e traz na região\n4. Produtos premium e naturais',
  pos_dor_principal: 'Ex: Tutores que se preocupam com o bem-estar do pet e não confiam em qualquer lugar.',
  pos_concorrentes: 'Ex:\n1. Pet shop de bairro\n2. Rede grande de pet\n3. Banho & tosa em domicílio',
  pos_jargoes_setor: 'Ex: "tosa higiênica", "tosa na máquina", "banho terapêutico", "vermífugo", "vacina V10", "castração"',
  pos_slogan: 'Ex: "Porque seu pet merece o melhor."',
  pos_o_que_nao_somos: 'Ex: Não fazemos hotel para pets. Não atendemos animais silvestres. Não vendemos filhotes.',
  pub_perfil_ideal: 'Ex: Tutores 25-50 anos que tratam o pet como família e valorizam segurança e carinho.',
  pub_perfil_nao_desejado: 'Ex: Quem busca só o banho mais barato sem se importar com a qualidade.',
  pub_ticket_medio: 'Ex: R$ 80 por banho & tosa; R$ 200 quando inclui consulta veterinária.',
  pub_dores_comuns: 'Ex:\n1. Medo de maus-tratos no banho\n2. Pet estressado/agressivo\n3. Não saber quais vacinas estão em dia\n4. Falta de tempo pra levar',
  pub_objecoes_comuns: 'Ex:\n1. "Quanto custa o banho?"\n2. "Tem leva e traz?"\n3. "Atende pet bravo?"\n4. "Tem veterinário hoje?"',
  tom_cumprimento: 'Ex: "Oi! 🐾 Bem-vindo ao Mundo Pet! Quer agendar banho & tosa, marcar o veterinário ou ver nossos produtos?"',
  com_lista_servicos: 'Ex:\n- Banho (R$ 50-90)\n- Tosa (R$ 60-120)\n- Consulta veterinária (R$ 120)\n- Vacinas\n- Leva e traz\n- Produtos e ração',
  com_categorias: 'Ex:\n- Banho & tosa\n- Veterinário e vacinas\n- Produtos (ração, petiscos, acessórios)\n- Leva e traz',
  com_servico_premium: 'Ex: Day care + banho + spa relaxante — R$ 250/dia',
  com_combos_pacotes: 'Ex: Plano mensal de banhos (4 banhos) R$ 280; Combo banho + tosa + hidratação R$ 150',
  com_garantia: 'Ex: Se o pet não ficar bem cuidado, refazemos o banho sem custo.',
  qual_objecao_preco: 'Ex: Destacar a segurança, o profissional especializado e o plano mensal que sai mais barato.',
  pre_tabela_precos: 'Ex:\n- Banho: R$ 50-90 (porte)\n- Tosa: R$ 60-120\n- Consulta vet: R$ 120\n- Leva e traz: R$ 20',
  pre_parcelamento: 'Ex: Pix, débito e crédito; plano mensal recorrente.',
  faq_perguntas_frequentes: 'Ex:\nP: Tem leva e traz?\nR: Sim, na região, R$ 20.\nP: Quanto custa o banho?\nR: De R$ 50 a R$ 90 conforme o porte.\nP: Tem veterinário?\nR: Sim, todos os dias.',
  faq_contraindicacoes: 'Ex: Pets idosos ou com problema cardíaco passam por avaliação antes do banho; carrapaticida só com orientação.',
  crm_tags: 'Ex: #banho-tosa, #veterinario, #vacina-pendente, #leva-e-traz, #cliente-fiel',
  crm_ltv: 'Ex: R$ 1.800/ano por pet (banhos recorrentes + vet + produtos).',
};

export const NICHE_EXAMPLES: Record<string, Examples> = {
  restaurante,
  dentista,
  salao,
  academia,
  petshop,
  // Próximas ondas (lote 2+): psicologo, advogado, nutricionista, imobiliaria,
  // escola, servicos_tecnicos, clinica_medica, contabilidade, oficina,
  // agencia_digital, ecommerce.
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
