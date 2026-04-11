import type { Segment } from './surveyTypes';

export const SEGMENTS: Segment[] = [
  // ── 1. Academia e Fitness ──────────────────────────────────────────
  {
    key: 'academia',
    icon: '🏋️',
    label: 'Academia e Fitness',
    description: 'Academias, studios e profissionais de atividade física',
    subsegments: [
      {
        key: 'musculacao',
        label: 'Musculação',
        description:
          'Treinos de hipertrofia e força com foco em ganho de massa muscular e definição corporal',
      },
      {
        key: 'funcional',
        label: 'Treinamento Funcional',
        description:
          'Treinos que trabalham movimentos naturais do corpo para melhorar a capacidade física geral',
      },
      {
        key: 'crossfit',
        label: 'CrossFit',
        description:
          'Treinos de alta intensidade combinando levantamento de peso, ginástica e condicionamento metabólico',
      },
      {
        key: 'pilates',
        label: 'Pilates',
        description:
          'Exercícios de fortalecimento e alongamento com foco em consciência corporal e postura',
      },
      {
        key: 'personal_trainer',
        label: 'Personal Trainer',
        description:
          'Atendimento individual com treinos personalizados de acordo com os objetivos do aluno',
      },
      {
        key: 'emagrecimento',
        label: 'Emagrecimento',
        description:
          'Programas voltados para perda de peso saudável com acompanhamento de exercícios e orientação nutricional',
      },
      {
        key: 'natacao',
        label: 'Natação',
        description:
          'Aulas de natação para todas as idades, desde iniciantes até treinamento competitivo',
      },
      {
        key: 'lutas',
        label: 'Lutas e Artes Marciais',
        description:
          'Modalidades como jiu-jitsu, muay thai, boxe, judô e outras artes marciais para condicionamento e defesa pessoal',
      },
      {
        key: 'danca',
        label: 'Dança',
        description:
          'Aulas de dança como zumba, ballet fitness, ritmos e outras modalidades para condicionamento e diversão',
      },
      {
        key: 'studio_boutique',
        label: 'Studio Boutique',
        description:
          'Espaços exclusivos com turmas reduzidas e experiência premium de treino personalizado',
      },
      {
        key: 'reabilitacao',
        label: 'Reabilitação Física',
        description:
          'Exercícios terapêuticos voltados para recuperação de lesões e fortalecimento pós-cirúrgico',
      },
    ],
  },

  // ── 2. Odontologia ─────────────────────────────────────────────────
  {
    key: 'dentista',
    icon: '🦷',
    label: 'Odontologia',
    description: 'Clínicas e consultórios odontológicos',
    subsegments: [
      {
        key: 'clinica_geral',
        label: 'Clínica Geral',
        description:
          'Atendimento odontológico preventivo e restaurador incluindo limpeza, obturações e tratamentos de rotina',
      },
      {
        key: 'estetica_dental',
        label: 'Estética Dental',
        description:
          'Procedimentos estéticos como clareamento, lentes de contato dental e facetas de porcelana',
      },
      {
        key: 'harmonizacao_facial',
        label: 'Harmonização Facial',
        description:
          'Procedimentos estéticos faciais como toxina botulínica, preenchimento e bioestimuladores de colágeno',
      },
      {
        key: 'implantodontia',
        label: 'Implantodontia',
        description:
          'Reabilitação oral com implantes dentários para substituição de dentes perdidos',
      },
      {
        key: 'ortodontia',
        label: 'Ortodontia',
        description:
          'Correção de posicionamento dos dentes com aparelhos fixos, removíveis e alinhadores transparentes',
      },
      {
        key: 'odontopediatria',
        label: 'Odontopediatria',
        description:
          'Cuidados odontológicos especializados para bebês, crianças e adolescentes',
      },
      {
        key: 'urgencia',
        label: 'Urgência Odontológica',
        description:
          'Atendimento emergencial para dores agudas, traumas dentários e infecções bucais',
      },
      {
        key: 'protese',
        label: 'Prótese Dentária',
        description:
          'Confecção e instalação de próteses fixas e removíveis para reabilitação da mastigação e estética',
      },
      {
        key: 'periodontia',
        label: 'Periodontia',
        description:
          'Tratamento de doenças gengivais, periodontite e cirurgias para regeneração dos tecidos de suporte dos dentes',
      },
      {
        key: 'cirurgia_oral',
        label: 'Cirurgia Oral',
        description:
          'Procedimentos cirúrgicos como extração de sisos, enxertos ósseos e cirurgias corretivas',
      },
      {
        key: 'endodontia',
        label: 'Endodontia',
        description:
          'Tratamento de canal radicular para salvar dentes comprometidos por cárie profunda ou trauma',
      },
    ],
  },

  // ── 3. Psicologia ──────────────────────────────────────────────────
  {
    key: 'psicologo',
    icon: '🧠',
    label: 'Psicologia',
    description: 'Psicólogos clínicos e organizacionais',
    subsegments: [
      {
        key: 'clinica_geral',
        label: 'Clínica Geral',
        description:
          'Atendimento psicoterapêutico para adultos abrangendo diversas demandas emocionais e comportamentais',
      },
      {
        key: 'infantil',
        label: 'Psicologia Infantil',
        description:
          'Acompanhamento psicológico especializado para crianças com foco em desenvolvimento e questões emocionais',
      },
      {
        key: 'adolescente',
        label: 'Psicologia do Adolescente',
        description:
          'Atendimento voltado para as demandas específicas da adolescência como identidade, autoestima e conflitos familiares',
      },
      {
        key: 'casal',
        label: 'Terapia de Casal',
        description:
          'Sessões voltadas para melhorar a comunicação, resolver conflitos e fortalecer o relacionamento conjugal',
      },
      {
        key: 'online',
        label: 'Atendimento Online',
        description:
          'Psicoterapia realizada por videoconferência com a mesma qualidade do atendimento presencial',
      },
      {
        key: 'ansiedade_depressao',
        label: 'Ansiedade e Depressão',
        description:
          'Tratamento especializado em transtornos de ansiedade, depressão e outros transtornos do humor',
      },
      {
        key: 'avaliacao_psicologica',
        label: 'Avaliação Psicológica',
        description:
          'Aplicação de testes e instrumentos para avaliação cognitiva, emocional e comportamental',
      },
      {
        key: 'neuropsicologia',
        label: 'Neuropsicologia',
        description:
          'Avaliação e reabilitação de funções cognitivas como memória, atenção e funções executivas',
      },
      {
        key: 'organizacional',
        label: 'Psicologia Organizacional',
        description:
          'Atuação em empresas com foco em clima organizacional, desenvolvimento de equipes e saúde mental no trabalho',
      },
      {
        key: 'executivo',
        label: 'Coaching Executivo',
        description:
          'Atendimento voltado para líderes e executivos com foco em performance, tomada de decisão e gestão de estresse',
      },
    ],
  },

  // ── 4. Advocacia ───────────────────────────────────────────────────
  {
    key: 'advogado',
    icon: '⚖️',
    label: 'Advocacia',
    description: 'Escritórios e advogados autônomos',
    subsegments: [
      {
        key: 'familia',
        label: 'Direito de Família',
        description:
          'Casos de divórcio, guarda de filhos, pensão alimentícia, inventário e questões de direito sucessório',
      },
      {
        key: 'trabalhista_reclamante',
        label: 'Trabalhista (Reclamante)',
        description:
          'Defesa dos direitos do trabalhador em ações como rescisão indevida, horas extras e assédio moral',
      },
      {
        key: 'trabalhista_empresa',
        label: 'Trabalhista (Empresa)',
        description:
          'Assessoria jurídica para empresas em questões trabalhistas, defesa em reclamações e compliance',
      },
      {
        key: 'empresarial',
        label: 'Direito Empresarial',
        description:
          'Constituição de empresas, contratos societários, fusões, aquisições e governança corporativa',
      },
      {
        key: 'tributario',
        label: 'Direito Tributário',
        description:
          'Planejamento fiscal, defesa em autuações, recuperação de créditos tributários e consultoria fiscal',
      },
      {
        key: 'previdenciario',
        label: 'Direito Previdenciário',
        description:
          'Aposentadorias, benefícios do INSS, auxílio-doença, pensão por morte e revisão de benefícios',
      },
      {
        key: 'civel',
        label: 'Direito Cível',
        description:
          'Ações indenizatórias, cobranças, contratos, responsabilidade civil e litígios patrimoniais',
      },
      {
        key: 'criminal',
        label: 'Direito Criminal',
        description:
          'Defesa criminal em processos penais, audiências de custódia, habeas corpus e crimes econômicos',
      },
      {
        key: 'consumidor',
        label: 'Direito do Consumidor',
        description:
          'Defesa dos direitos do consumidor em relações de consumo, vícios de produtos e práticas abusivas',
      },
      {
        key: 'imobiliario',
        label: 'Direito Imobiliário',
        description:
          'Contratos de compra e venda, locação, usucapião, incorporações e regularização de imóveis',
      },
      {
        key: 'lgpd_digital',
        label: 'LGPD e Direito Digital',
        description:
          'Adequação à Lei Geral de Proteção de Dados, crimes virtuais e questões jurídicas do ambiente digital',
      },
      {
        key: 'consultivo',
        label: 'Consultoria Jurídica',
        description:
          'Assessoria preventiva para empresas e pessoas físicas evitando litígios e garantindo segurança jurídica',
      },
    ],
  },

  // ── 5. Nutrição ────────────────────────────────────────────────────
  {
    key: 'nutricionista',
    icon: '🥗',
    label: 'Nutrição',
    description: 'Nutricionistas clínicos e esportivos',
    subsegments: [
      {
        key: 'emagrecimento',
        label: 'Emagrecimento',
        description:
          'Planos alimentares personalizados para perda de peso saudável com reeducação alimentar e acompanhamento contínuo',
      },
      {
        key: 'esportiva',
        label: 'Nutrição Esportiva',
        description:
          'Alimentação estratégica para atletas e praticantes de exercícios visando performance e recuperação muscular',
      },
      {
        key: 'clinica',
        label: 'Nutrição Clínica',
        description:
          'Tratamento nutricional para condições de saúde como diabetes, hipertensão, alergias alimentares e doenças intestinais',
      },
      {
        key: 'infantil',
        label: 'Nutrição Infantil',
        description:
          'Alimentação adequada para bebês, crianças e adolescentes garantindo crescimento e desenvolvimento saudável',
      },
      {
        key: 'materno_infantil',
        label: 'Nutrição Materno-Infantil',
        description:
          'Acompanhamento nutricional durante gestação, pós-parto e amamentação para mãe e bebê',
      },
      {
        key: 'estetica',
        label: 'Nutrição Estética',
        description:
          'Alimentação voltada para saúde da pele, cabelos e unhas com foco em beleza e antienvelhecimento',
      },
      {
        key: 'comportamental',
        label: 'Nutrição Comportamental',
        description:
          'Abordagem que trabalha a relação emocional com a comida tratando compulsão e comportamentos alimentares',
      },
      {
        key: 'doencas_especificas',
        label: 'Doenças Específicas',
        description:
          'Tratamento nutricional direcionado para condições como doença celíaca, intolerância à lactose e síndrome metabólica',
      },
      {
        key: 'performance',
        label: 'Alta Performance',
        description:
          'Nutrição avançada para maximizar resultados em competições esportivas e treinos de alto rendimento',
      },
    ],
  },

  // ── 6. Salão e Beleza ──────────────────────────────────────────────
  {
    key: 'salao',
    icon: '💇',
    label: 'Salão e Beleza',
    description: 'Salões, barbearias e studios de beleza',
    subsegments: [
      {
        key: 'cabelo',
        label: 'Cabelo',
        description:
          'Cortes, escovas, hidratações, cauterizações e tratamentos capilares para todos os tipos de cabelo',
      },
      {
        key: 'coloracao',
        label: 'Coloração',
        description:
          'Mechas, balayage, luzes, tintura e técnicas avançadas de coloração capilar',
      },
      {
        key: 'manicure_pedicure',
        label: 'Manicure e Pedicure',
        description:
          'Cuidados com as unhas das mãos e pés incluindo esmaltação tradicional e cuidados com cutículas',
      },
      {
        key: 'nail_designer',
        label: 'Nail Designer',
        description:
          'Alongamento de unhas, unhas em gel, fibra de vidro, nail art e design personalizado',
      },
      {
        key: 'maquiagem',
        label: 'Maquiagem',
        description:
          'Maquiagem profissional para eventos, ensaios fotográficos e ocasiões especiais',
      },
      {
        key: 'noivas',
        label: 'Noivas',
        description:
          'Pacotes completos para noivas incluindo dia da noiva com cabelo, maquiagem e cuidados especiais',
      },
      {
        key: 'sobrancelha',
        label: 'Sobrancelha',
        description:
          'Design de sobrancelhas, micropigmentação, henna e técnicas de realce do olhar',
      },
      {
        key: 'cilios',
        label: 'Cílios',
        description:
          'Extensão de cílios fio a fio, volume russo, lifting de cílios e manutenção',
      },
      {
        key: 'depilacao',
        label: 'Depilação',
        description:
          'Depilação com cera, laser, luz pulsada e técnicas modernas para remoção de pelos',
      },
      {
        key: 'barbearia',
        label: 'Barbearia',
        description:
          'Cortes masculinos, barba, tratamentos capilares e experiência premium de barbearia',
      },
      {
        key: 'estetica_leve',
        label: 'Estética Leve',
        description:
          'Limpeza de pele, peeling, drenagem linfática e tratamentos faciais e corporais não invasivos',
      },
    ],
  },

  // ── 7. Pet Shop e Veterinário ──────────────────────────────────────
  {
    key: 'petshop',
    icon: '🐾',
    label: 'Pet Shop e Veterinário',
    description: 'Pet shops, clínicas vet e serviços pet',
    subsegments: [
      {
        key: 'banho_tosa',
        label: 'Banho e Tosa',
        description:
          'Serviços de higiene e estética animal incluindo banho, tosa higiênica, tosa na máquina e na tesoura',
      },
      {
        key: 'veterinario',
        label: 'Veterinário',
        description:
          'Consultas veterinárias, vacinação, exames, cirurgias e tratamentos clínicos para animais de estimação',
      },
      {
        key: 'hospedagem',
        label: 'Hospedagem Pet',
        description:
          'Alojamento para pets durante viagens e ausências dos tutores com monitoramento e cuidados diários',
      },
      {
        key: 'daycare',
        label: 'Daycare e Creche',
        description:
          'Creche diurna para cães com socialização, atividades recreativas e supervisão profissional',
      },
      {
        key: 'loja_pet',
        label: 'Loja Pet',
        description:
          'Venda de rações, petiscos, brinquedos, acessórios e produtos de higiene para animais',
      },
      {
        key: 'adestramento',
        label: 'Adestramento',
        description:
          'Treinamento comportamental e obediência para cães visando convivência harmoniosa e socialização',
      },
      {
        key: 'transporte_pet',
        label: 'Transporte Pet',
        description:
          'Serviço de leva-e-traz de animais para consultas veterinárias, banho e tosa e outros compromissos',
      },
      {
        key: 'clinica_felina',
        label: 'Clínica Felina',
        description:
          'Atendimento veterinário especializado exclusivamente para gatos em ambiente adaptado e sem estresse',
      },
      {
        key: 'pets_exoticos',
        label: 'Pets Exóticos',
        description:
          'Cuidados veterinários e produtos para animais exóticos como aves, répteis e roedores',
      },
    ],
  },

  // ── 8. Imobiliária ─────────────────────────────────────────────────
  {
    key: 'imobiliaria',
    icon: '🏠',
    label: 'Imobiliária',
    description: 'Imobiliárias e corretores de imóveis',
    subsegments: [
      {
        key: 'locacao_residencial',
        label: 'Locação Residencial',
        description:
          'Aluguel de casas e apartamentos residenciais com gestão de contratos e intermediação entre locador e inquilino',
      },
      {
        key: 'locacao_comercial',
        label: 'Locação Comercial',
        description:
          'Aluguel de salas, lojas, galpões e espaços comerciais para empresas e empreendedores',
      },
      {
        key: 'venda_residencial',
        label: 'Venda Residencial',
        description:
          'Compra e venda de imóveis residenciais com assessoria completa desde a captação até a escritura',
      },
      {
        key: 'alto_padrao',
        label: 'Alto Padrão',
        description:
          'Imóveis de luxo e alto padrão com atendimento diferenciado e estratégias exclusivas de comercialização',
      },
      {
        key: 'lancamentos',
        label: 'Lançamentos',
        description:
          'Venda de imóveis na planta diretamente de construtoras e incorporadoras com condições especiais',
      },
      {
        key: 'investimento',
        label: 'Investimento Imobiliário',
        description:
          'Assessoria para investidores que buscam imóveis com potencial de valorização e renda de aluguel',
      },
      {
        key: 'administracao',
        label: 'Administração de Imóveis',
        description:
          'Gestão completa de imóveis alugados incluindo cobrança, manutenção e relacionamento com inquilinos',
      },
      {
        key: 'temporada',
        label: 'Temporada',
        description:
          'Locação de imóveis por temporada para férias, feriados e estadias de curta duração',
      },
      {
        key: 'captacao',
        label: 'Captação de Imóveis',
        description:
          'Estratégias para atrair proprietários e ampliar a carteira de imóveis disponíveis para locação e venda',
      },
    ],
  },

  // ── 9. Restaurante e Food ──────────────────────────────────────────
  {
    key: 'restaurante',
    icon: '🍽️',
    label: 'Restaurante e Food',
    description: 'Restaurantes, cafeterias e food service',
    subsegments: [
      {
        key: 'salao',
        label: 'Salão (Presencial)',
        description:
          'Atendimento no restaurante com reservas de mesa, gestão de fila de espera e experiência gastronômica no local',
      },
      {
        key: 'delivery',
        label: 'Delivery',
        description:
          'Entrega de refeições em domicílio com gestão de pedidos, rastreamento e integração com plataformas',
      },
      {
        key: 'retirada',
        label: 'Retirada no Local',
        description:
          'Pedidos para buscar no balcão com antecedência otimizando tempo de espera do cliente',
      },
      {
        key: 'eventos',
        label: 'Eventos e Festas',
        description:
          'Organização de eventos gastronômicos, jantares especiais, confraternizações e festas no restaurante',
      },
      {
        key: 'buffet',
        label: 'Buffet e Catering',
        description:
          'Serviço de buffet para eventos externos, casamentos, aniversários e reuniões corporativas',
      },
      {
        key: 'marmitas',
        label: 'Marmitas e Refeições',
        description:
          'Preparação e venda de marmitas fitness, congeladas ou do dia para alimentação prática e saudável',
      },
      {
        key: 'assinatura',
        label: 'Assinatura de Refeições',
        description:
          'Planos semanais ou mensais de refeições com entrega recorrente e cardápio personalizado',
      },
      {
        key: 'premium',
        label: 'Gastronomia Premium',
        description:
          'Experiências gastronômicas de alto nível com menu degustação, harmonização e chef exclusivo',
      },
      {
        key: 'saudavel',
        label: 'Alimentação Saudável',
        description:
          'Restaurantes e serviços focados em comida natural, orgânica, vegana, vegetariana e funcional',
      },
      {
        key: 'corporativo',
        label: 'Corporativo',
        description:
          'Alimentação empresarial com refeições para colaboradores, coffee breaks e eventos corporativos',
      },
      {
        key: 'cafeteria',
        label: 'Cafeteria',
        description:
          'Cafés especiais, confeitaria artesanal, brunch e experiências em torno da cultura do café',
      },
      {
        key: 'pizzaria',
        label: 'Pizzaria',
        description:
          'Pizzarias com atendimento no salão e delivery incluindo sabores tradicionais e gourmet',
      },
      {
        key: 'hamburgueria',
        label: 'Hamburgueria',
        description:
          'Hambúrgueres artesanais e gourmet com opções criativas de lanches e acompanhamentos',
      },
    ],
  },

  // ── 10. Educação ───────────────────────────────────────────────────
  {
    key: 'escola',
    icon: '📚',
    label: 'Educação',
    description: 'Escolas, cursos e instituições de ensino',
    subsegments: [
      {
        key: 'educacao_infantil',
        label: 'Educação Infantil',
        description:
          'Creches e pré-escolas com foco no desenvolvimento cognitivo, social e emocional de crianças de 0 a 5 anos',
      },
      {
        key: 'fundamental',
        label: 'Ensino Fundamental',
        description:
          'Escolas de ensino fundamental com formação acadêmica e desenvolvimento integral do aluno',
      },
      {
        key: 'medio',
        label: 'Ensino Médio',
        description:
          'Escolas de ensino médio com preparação acadêmica, formação cidadã e orientação profissional',
      },
      {
        key: 'idiomas',
        label: 'Escola de Idiomas',
        description:
          'Cursos de inglês, espanhol, francês e outros idiomas para todas as idades e níveis de proficiência',
      },
      {
        key: 'reforco',
        label: 'Reforço Escolar',
        description:
          'Aulas particulares e de reforço para alunos com dificuldades em matérias específicas',
      },
      {
        key: 'tecnico',
        label: 'Curso Técnico',
        description:
          'Formação técnica profissionalizante em áreas como enfermagem, administração, TI e design',
      },
      {
        key: 'preparatorio',
        label: 'Preparatório',
        description:
          'Cursinhos preparatórios para vestibular, ENEM, concursos públicos e certificações profissionais',
      },
      {
        key: 'livre',
        label: 'Curso Livre',
        description:
          'Cursos de curta duração em áreas como música, culinária, artesanato, fotografia e desenvolvimento pessoal',
      },
      {
        key: 'bilingue',
        label: 'Escola Bilíngue',
        description:
          'Instituições com ensino bilíngue integrando idioma estrangeiro ao currículo regular desde a infância',
      },
      {
        key: 'premium',
        label: 'Ensino Premium',
        description:
          'Escolas de alto padrão com infraestrutura diferenciada, turmas reduzidas e metodologias inovadoras',
      },
    ],
  },

  // ── 11. Serviços Técnicos ──────────────────────────────────────────
  {
    key: 'servicos_tecnicos',
    icon: '🔧',
    label: 'Serviços Técnicos',
    description: 'Prestadores de serviços técnicos e manutenção',
    subsegments: [
      {
        key: 'eletrica',
        label: 'Elétrica',
        description:
          'Instalações elétricas residenciais e comerciais, manutenção de quadros, reparos e projetos elétricos',
      },
      {
        key: 'hidraulica',
        label: 'Hidráulica',
        description:
          'Instalações e reparos hidráulicos incluindo encanamentos, válvulas, bombas e sistemas de água e esgoto',
      },
      {
        key: 'ar_condicionado',
        label: 'Ar Condicionado',
        description:
          'Instalação, manutenção preventiva e corretiva de sistemas de climatização residencial e comercial',
      },
      {
        key: 'seguranca_eletronica',
        label: 'Segurança Eletrônica',
        description:
          'Instalação de alarmes, sensores de presença, cercas elétricas e sistemas de controle de acesso',
      },
      {
        key: 'cftv',
        label: 'CFTV e Câmeras',
        description:
          'Projetos e instalação de câmeras de vigilância, DVR, NVR e monitoramento remoto por aplicativo',
      },
      {
        key: 'automacao',
        label: 'Automação Residencial',
        description:
          'Projetos de casa inteligente com controle de iluminação, cortinas, som ambiente e integração por voz',
      },
      {
        key: 'ti',
        label: 'Suporte de TI',
        description:
          'Manutenção de computadores, redes, servidores, suporte técnico e infraestrutura de tecnologia',
      },
      {
        key: 'energia_solar',
        label: 'Energia Solar',
        description:
          'Projetos e instalação de sistemas de energia solar fotovoltaica para residências e empresas',
      },
      {
        key: 'manutencao_predial',
        label: 'Manutenção Predial',
        description:
          'Serviços de manutenção para condomínios e edifícios incluindo pintura, impermeabilização e reparos gerais',
      },
      {
        key: 'assistencia_tecnica',
        label: 'Assistência Técnica',
        description:
          'Reparo de eletrodomésticos, eletrônicos e equipamentos com diagnóstico e orçamento prévio',
      },
    ],
  },

  // ── 12. Clínica Médica ─────────────────────────────────────────────
  {
    key: 'clinica_medica',
    icon: '🏥',
    label: 'Clínica Médica',
    description: 'Clínicas médicas e especialidades',
    subsegments: [
      {
        key: 'clinica_geral',
        label: 'Clínica Geral',
        description:
          'Consultas médicas gerais para diagnóstico, prevenção e acompanhamento de saúde do paciente adulto',
      },
      {
        key: 'dermatologia',
        label: 'Dermatologia',
        description:
          'Tratamento de doenças de pele, cabelos e unhas além de procedimentos estéticos dermatológicos',
      },
      {
        key: 'ginecologia',
        label: 'Ginecologia e Obstetrícia',
        description:
          'Saúde da mulher incluindo consultas ginecológicas, pré-natal, planejamento familiar e climatério',
      },
      {
        key: 'pediatria',
        label: 'Pediatria',
        description:
          'Acompanhamento médico de crianças e adolescentes com foco em crescimento, vacinação e desenvolvimento',
      },
      {
        key: 'psiquiatria',
        label: 'Psiquiatria',
        description:
          'Diagnóstico e tratamento de transtornos mentais com abordagem medicamentosa e acompanhamento contínuo',
      },
      {
        key: 'ortopedia',
        label: 'Ortopedia',
        description:
          'Tratamento de lesões e doenças do sistema musculoesquelético incluindo ossos, articulações e coluna',
      },
      {
        key: 'cardiologia',
        label: 'Cardiologia',
        description:
          'Prevenção, diagnóstico e tratamento de doenças cardiovasculares com exames e acompanhamento especializado',
      },
      {
        key: 'exames',
        label: 'Exames e Diagnóstico',
        description:
          'Laboratório e centro de diagnóstico por imagem com exames de sangue, ultrassom, raio-x e ressonância',
      },
      {
        key: 'estetica_medica',
        label: 'Estética Médica',
        description:
          'Procedimentos estéticos médicos como toxina botulínica, preenchimento, bioestimuladores e laser',
      },
      {
        key: 'telemedicina',
        label: 'Telemedicina',
        description:
          'Consultas médicas por videoconferência com emissão de receitas e atestados digitais',
      },
    ],
  },

  // ── 13. Contabilidade ──────────────────────────────────────────────
  {
    key: 'contabilidade',
    icon: '📊',
    label: 'Contabilidade',
    description: 'Escritórios contábeis e consultoria fiscal',
    subsegments: [
      {
        key: 'abertura_empresa',
        label: 'Abertura de Empresa',
        description:
          'Assessoria completa para abertura de CNPJ incluindo escolha do regime tributário, contrato social e alvarás',
      },
      {
        key: 'bpo_financeiro',
        label: 'BPO Financeiro',
        description:
          'Terceirização do setor financeiro com gestão de contas a pagar, receber, conciliação e fluxo de caixa',
      },
      {
        key: 'recorrente',
        label: 'Contabilidade Recorrente',
        description:
          'Serviço mensal de escrituração contábil, fiscal e trabalhista para empresas de todos os portes',
      },
      {
        key: 'mei',
        label: 'MEI e Microempresa',
        description:
          'Orientação especializada para microempreendedores individuais e microempresas com tributação simplificada',
      },
      {
        key: 'irpf',
        label: 'Imposto de Renda PF',
        description:
          'Declaração de imposto de renda para pessoas físicas com planejamento para maximizar restituição',
      },
      {
        key: 'planejamento_tributario',
        label: 'Planejamento Tributário',
        description:
          'Análise e reestruturação fiscal para reduzir legalmente a carga tributária da empresa',
      },
      {
        key: 'folha',
        label: 'Folha de Pagamento',
        description:
          'Processamento de folha de pagamento, admissões, demissões, férias e obrigações trabalhistas',
      },
      {
        key: 'regularizacao',
        label: 'Regularização',
        description:
          'Regularização de pendências fiscais, certidões negativas e resolução de débitos com a Receita Federal',
      },
      {
        key: 'troca_contador',
        label: 'Troca de Contador',
        description:
          'Migração contábil de outro escritório com análise de pendências e transição segura de toda a documentação',
      },
    ],
  },

  // ── 14. Oficina e Automotivo ───────────────────────────────────────
  {
    key: 'oficina',
    icon: '🚗',
    label: 'Oficina e Automotivo',
    description: 'Oficinas mecânicas e centros automotivos',
    subsegments: [
      {
        key: 'mecanica_geral',
        label: 'Mecânica Geral',
        description:
          'Reparos mecânicos diversos incluindo motor, sistema de arrefecimento, embreagem e componentes gerais',
      },
      {
        key: 'revisao',
        label: 'Revisão Preventiva',
        description:
          'Revisão completa do veículo com troca de óleo, filtros, correias e verificação dos principais sistemas',
      },
      {
        key: 'eletrica_auto',
        label: 'Elétrica Automotiva',
        description:
          'Diagnóstico e reparo de sistemas elétricos e eletrônicos do veículo incluindo injeção eletrônica',
      },
      {
        key: 'ar_condicionado_auto',
        label: 'Ar Condicionado Automotivo',
        description:
          'Manutenção e reparo do sistema de climatização veicular incluindo recarga de gás e higienização',
      },
      {
        key: 'suspensao_freios',
        label: 'Suspensão e Freios',
        description:
          'Manutenção e troca de amortecedores, molas, pastilhas de freio, discos e alinhamento de rodas',
      },
      {
        key: 'funilaria_pintura',
        label: 'Funilaria e Pintura',
        description:
          'Reparos de lataria, correção de amassados, pintura automotiva e polimento para restaurar a estética do veículo',
      },
      {
        key: 'cambio',
        label: 'Câmbio',
        description:
          'Manutenção e reparo de câmbio manual e automático incluindo troca de óleo e revisão completa da transmissão',
      },
      {
        key: 'importados',
        label: 'Veículos Importados',
        description:
          'Manutenção especializada para veículos importados e de marcas premium com peças originais',
      },
      {
        key: 'motos',
        label: 'Motos',
        description:
          'Oficina especializada em motocicletas com manutenção mecânica, elétrica e estética de motos',
      },
      {
        key: 'centro_rapido',
        label: 'Centro Automotivo Rápido',
        description:
          'Serviços rápidos como troca de óleo, pneus, balanceamento e pequenos reparos sem agendamento',
      },
    ],
  },

  // ── 15. Agência Digital ────────────────────────────────────────────
  {
    key: 'agencia_digital',
    icon: '🌐',
    label: 'Agência Digital',
    description: 'Agências de marketing e comunicação digital',
    subsegments: [
      {
        key: 'trafego_pago',
        label: 'Tráfego Pago',
        description:
          'Gestão de anúncios em Google Ads, Meta Ads, TikTok Ads e outras plataformas para geração de resultados',
      },
      {
        key: 'social_media',
        label: 'Social Media',
        description:
          'Gestão de redes sociais com criação de conteúdo, planejamento editorial e engajamento com seguidores',
      },
      {
        key: 'branding',
        label: 'Branding e Identidade Visual',
        description:
          'Criação e posicionamento de marcas com logotipo, manual de identidade visual e estratégia de marca',
      },
      {
        key: 'sites',
        label: 'Criação de Sites',
        description:
          'Desenvolvimento de sites institucionais, landing pages e e-commerces otimizados para conversão',
      },
      {
        key: 'seo',
        label: 'SEO',
        description:
          'Otimização de sites para mecanismos de busca visando posicionamento orgânico e tráfego qualificado',
      },
      {
        key: 'crm_automacao',
        label: 'CRM e Automação',
        description:
          'Implementação de ferramentas de CRM e automação de marketing para nutrição e conversão de leads',
      },
      {
        key: 'geracao_leads',
        label: 'Geração de Leads',
        description:
          'Estratégias integradas para captação de leads qualificados usando múltiplos canais digitais',
      },
      {
        key: 'lancamentos',
        label: 'Lançamentos Digitais',
        description:
          'Estratégias de lançamento de produtos digitais e infoprodutos com funis de vendas e campanhas de alta conversão',
      },
      {
        key: 'consultoria',
        label: 'Consultoria de Marketing',
        description:
          'Diagnóstico e planejamento estratégico de marketing digital com mentoria e acompanhamento de resultados',
      },
      {
        key: 'nichada',
        label: 'Agência Nichada',
        description:
          'Agências especializadas em segmentos específicos como saúde, educação, gastronomia ou mercado imobiliário',
      },
    ],
  },

  // ── 16. Loja e E-commerce ──────────────────────────────────────────
  {
    key: 'ecommerce',
    icon: '🛒',
    label: 'Loja e E-commerce',
    description: 'Lojas físicas e virtuais',
    subsegments: [
      {
        key: 'moda',
        label: 'Moda e Vestuário',
        description:
          'Lojas de roupas, calçados e acessórios de moda com vendas presenciais e online',
      },
      {
        key: 'cosmeticos',
        label: 'Cosméticos e Beleza',
        description:
          'Venda de produtos de beleza, skincare, maquiagem e cuidados pessoais em loja física ou virtual',
      },
      {
        key: 'eletronicos',
        label: 'Eletrônicos',
        description:
          'Loja de celulares, computadores, acessórios de tecnologia e eletrônicos em geral',
      },
      {
        key: 'casa_decoracao',
        label: 'Casa e Decoração',
        description:
          'Produtos para casa, decoração, móveis, utilidades domésticas e itens de conforto',
      },
      {
        key: 'acessorios',
        label: 'Acessórios e Joias',
        description:
          'Venda de bijuterias, joias, relógios, bolsas e acessórios de moda feminina e masculina',
      },
      {
        key: 'infantil',
        label: 'Infantil e Bebê',
        description:
          'Produtos para bebês e crianças incluindo roupas, brinquedos, enxoval e itens de puericultura',
      },
      {
        key: 'premium',
        label: 'Loja Premium',
        description:
          'E-commerce ou loja física de produtos de alto padrão com experiência de compra diferenciada e exclusiva',
      },
      {
        key: 'marketplace',
        label: 'Marketplace',
        description:
          'Vendas em marketplaces como Mercado Livre, Shopee e Amazon com gestão de múltiplos canais',
      },
      {
        key: 'd2c',
        label: 'D2C (Direto ao Consumidor)',
        description:
          'Marca própria vendendo diretamente ao consumidor final sem intermediários com loja virtual própria',
      },
      {
        key: 'catalogo_tecnico',
        label: 'Catálogo Técnico',
        description:
          'Loja com produtos técnicos ou especializados que exigem consultoria e orientação na venda',
      },
    ],
  },
];
