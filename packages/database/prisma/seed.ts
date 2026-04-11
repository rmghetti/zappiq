import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Placeholder bcrypt hash para "demo123" (custo 10)
const DEMO_PASSWORD_HASH = '$2b$10$demohashedpasswordplaceholderXXXXXXXXXXXXXXXXXXXXXX';

async function main() {
  console.log('Iniciando seed do banco de dados...');

  await prisma.$transaction(async (tx) => {
    // ═══════════════════════════════════════════════════════
    // 1. ORGANIZAÇÃO
    // ═══════════════════════════════════════════════════════
    const org = await tx.organization.upsert({
      where: { slug: 'clinica-sorriso' },
      update: {},
      create: {
        name: 'Clínica Sorriso Perfeito',
        slug: 'clinica-sorriso',
        plan: 'GROWTH',
        whatsappPhoneNumberId: '000000000000000',
        whatsappBusinessAccountId: '000000000000000',
        settings: {
          niche: 'dentista',
          agentName: 'Sofia',
          tone: 'friendly',
          businessName: 'Clínica Sorriso Perfeito',
          businessHours: {
            weekdays: '08:00-19:00',
            saturday: '08:00-13:00',
            sunday: 'fechado',
          },
          address: 'Rua das Flores, 123 - Centro, Campinas/SP',
          phone: '(19) 3456-7890',
          website: 'https://clinicasorrisoperfeito.com.br',
        },
      },
    });

    console.log(`  Organizacao: ${org.name} (${org.id})`);

    // ═══════════════════════════════════════════════════════
    // 2. USUÁRIOS (admin, supervisor, agent)
    // ═══════════════════════════════════════════════════════
    const adminUser = await tx.user.upsert({
      where: { email: 'admin@sorrisoperfeito.com.br' },
      update: {},
      create: {
        email: 'admin@sorrisoperfeito.com.br',
        name: 'Dr. Ricardo Mendes',
        passwordHash: DEMO_PASSWORD_HASH,
        role: 'ADMIN',
        isOnline: true,
        maxConcurrentChats: 10,
        organizationId: org.id,
      },
    });

    const supervisorUser = await tx.user.upsert({
      where: { email: 'supervisora@sorrisoperfeito.com.br' },
      update: {},
      create: {
        email: 'supervisora@sorrisoperfeito.com.br',
        name: 'Dra. Camila Ferreira',
        passwordHash: DEMO_PASSWORD_HASH,
        role: 'SUPERVISOR',
        isOnline: true,
        maxConcurrentChats: 8,
        organizationId: org.id,
      },
    });

    const agentUser = await tx.user.upsert({
      where: { email: 'atendente@sorrisoperfeito.com.br' },
      update: {},
      create: {
        email: 'atendente@sorrisoperfeito.com.br',
        name: 'Juliana Costa',
        passwordHash: DEMO_PASSWORD_HASH,
        role: 'AGENT',
        isOnline: false,
        maxConcurrentChats: 5,
        organizationId: org.id,
      },
    });

    console.log('  3 usuarios criados (admin, supervisor, agent)');

    // ═══════════════════════════════════════════════════════
    // 3. CONTATOS (10 pacientes)
    // ═══════════════════════════════════════════════════════
    const contactsData = [
      {
        whatsappId: '5519998001001',
        phone: '5519998001001',
        name: 'Ana Carolina Lima',
        email: 'anacarolina@gmail.com',
        tags: ['clareamento', 'convenio-unimed'],
        leadScore: 92,
        leadStatus: 'CONVERTED' as const,
        funnelStage: 'won',
        consentMarketing: true,
        consentMarketingAt: new Date('2026-01-15'),
        lastInteractionAt: new Date('2026-03-25'),
      },
      {
        whatsappId: '5519998001002',
        phone: '5519998001002',
        name: 'Carlos Eduardo Santos',
        email: 'carloseduardo@hotmail.com',
        tags: ['ortodontia', 'adulto'],
        leadScore: 78,
        leadStatus: 'QUALIFIED' as const,
        funnelStage: 'proposal',
        consentMarketing: true,
        consentMarketingAt: new Date('2026-02-10'),
        lastInteractionAt: new Date('2026-03-24'),
      },
      {
        whatsappId: '5519998001003',
        phone: '5519998001003',
        name: 'Maria Fernanda Oliveira',
        email: 'mfernanda.oli@gmail.com',
        tags: ['implante', 'vip', 'indicacao'],
        leadScore: 95,
        leadStatus: 'CONVERTED' as const,
        funnelStage: 'won',
        consentMarketing: true,
        consentMarketingAt: new Date('2025-11-20'),
        lastInteractionAt: new Date('2026-03-20'),
      },
      {
        whatsappId: '5519998001004',
        phone: '5519998001004',
        name: 'Pedro Henrique Almeida',
        email: null,
        tags: ['limpeza', 'primeira-consulta'],
        leadScore: 35,
        leadStatus: 'NEW' as const,
        funnelStage: 'new',
        consentMarketing: false,
        consentMarketingAt: null,
        lastInteractionAt: new Date('2026-03-26'),
      },
      {
        whatsappId: '5519998001005',
        phone: '5519998001005',
        name: 'Beatriz Rocha',
        email: 'bia.rocha@outlook.com',
        tags: ['clareamento', 'estetica'],
        leadScore: 60,
        leadStatus: 'CONTACTED' as const,
        funnelStage: 'contacted',
        consentMarketing: true,
        consentMarketingAt: new Date('2026-03-01'),
        lastInteractionAt: new Date('2026-03-23'),
      },
      {
        whatsappId: '5519998001006',
        phone: '5519998001006',
        name: 'Lucas Gabriel Martins',
        email: 'lucasgm@gmail.com',
        tags: ['protese', 'idoso', 'convenio-bradesco'],
        leadScore: 88,
        leadStatus: 'QUALIFIED' as const,
        funnelStage: 'negotiation',
        consentMarketing: true,
        consentMarketingAt: new Date('2026-02-20'),
        lastInteractionAt: new Date('2026-03-25'),
      },
      {
        whatsappId: '5519998001007',
        phone: '5519998001007',
        name: 'Isabela Souza',
        email: null,
        tags: ['urgencia', 'dor-de-dente'],
        leadScore: 20,
        leadStatus: 'NEW' as const,
        funnelStage: 'new',
        consentMarketing: false,
        consentMarketingAt: null,
        lastInteractionAt: new Date('2026-03-26'),
      },
      {
        whatsappId: '5519998001008',
        phone: '5519998001008',
        name: 'Fernando Augusto Barbosa',
        email: 'fernando.barbosa@empresa.com.br',
        tags: ['canal', 'retorno'],
        leadScore: 55,
        leadStatus: 'CONTACTED' as const,
        funnelStage: 'contacted',
        consentMarketing: true,
        consentMarketingAt: new Date('2026-01-28'),
        lastInteractionAt: new Date('2026-03-18'),
      },
      {
        whatsappId: '5519998001009',
        phone: '5519998001009',
        name: 'Juliana Aparecida Dias',
        email: 'ju.dias@gmail.com',
        tags: ['facetas', 'estetica', 'vip'],
        leadScore: 15,
        leadStatus: 'UNQUALIFIED' as const,
        funnelStage: 'lost',
        consentMarketing: false,
        consentMarketingAt: null,
        lastInteractionAt: new Date('2026-02-05'),
      },
      {
        whatsappId: '5519998001010',
        phone: '5519998001010',
        name: 'Rafael Nascimento',
        email: 'rafael.nasc@yahoo.com.br',
        tags: ['ortodontia', 'invisalign', 'jovem'],
        leadScore: 72,
        leadStatus: 'QUALIFIED' as const,
        funnelStage: 'proposal',
        consentMarketing: true,
        consentMarketingAt: new Date('2026-03-10'),
        lastInteractionAt: new Date('2026-03-24'),
      },
    ];

    const contacts: Array<{ id: string; name: string | null; leadStatus: string }> = [];
    for (const data of contactsData) {
      const contact = await tx.contact.upsert({
        where: {
          whatsappId_organizationId: {
            whatsappId: data.whatsappId,
            organizationId: org.id,
          },
        },
        update: {},
        create: {
          ...data,
          organizationId: org.id,
        },
      });
      contacts.push(contact);
    }

    console.log(`  ${contacts.length} contatos criados`);

    // ═══════════════════════════════════════════════════════
    // 4. CONVERSAS (5) COM MENSAGENS
    // ═══════════════════════════════════════════════════════

    // Conversa 1 - Ana Carolina (clareamento, convertida)
    const conv1 = await tx.conversation.create({
      data: {
        status: 'CLOSED',
        channel: 'whatsapp',
        sentiment: 'POSITIVE',
        urgency: 'LOW',
        summary: 'Paciente agendou clareamento dental a laser. Pagamento em 6x no cartao.',
        csatScore: 5,
        contactId: contacts[0].id,
        organizationId: org.id,
        closedAt: new Date('2026-03-20'),
      },
    });

    await tx.message.createMany({
      data: [
        {
          direction: 'INBOUND',
          type: 'TEXT',
          content: 'Oi, boa tarde! Quanto custa o clareamento dental?',
          status: 'READ',
          conversationId: conv1.id,
          isFromBot: false,
          createdAt: new Date('2026-03-18T14:00:00'),
        },
        {
          direction: 'OUTBOUND',
          type: 'TEXT',
          content: 'Ola, Ana Carolina! Que bom receber voce aqui na Clinica Sorriso Perfeito! O clareamento dental a laser custa R$ 890,00, e voce pode parcelar em ate 6x sem juros. Gostaria de agendar uma avaliacao?',
          status: 'READ',
          conversationId: conv1.id,
          isFromBot: true,
          aiConfidence: 0.97,
          createdAt: new Date('2026-03-18T14:00:15'),
        },
        {
          direction: 'INBOUND',
          type: 'TEXT',
          content: 'Sim! Pode ser na quinta-feira de manha?',
          status: 'READ',
          conversationId: conv1.id,
          isFromBot: false,
          createdAt: new Date('2026-03-18T14:02:00'),
        },
        {
          direction: 'OUTBOUND',
          type: 'TEXT',
          content: 'Perfeito! Agendei sua avaliacao para quinta-feira, dia 20/03, as 09:00 com o Dr. Ricardo. Voce recebera uma confirmacao por aqui na vespera. Ate la!',
          status: 'READ',
          conversationId: conv1.id,
          isFromBot: true,
          aiConfidence: 0.95,
          createdAt: new Date('2026-03-18T14:02:30'),
        },
      ],
    });

    // Conversa 2 - Carlos Eduardo (ortodontia, aberta)
    const conv2 = await tx.conversation.create({
      data: {
        status: 'OPEN',
        channel: 'whatsapp',
        sentiment: 'NEUTRAL',
        urgency: 'MEDIUM',
        summary: 'Paciente interessado em ortodontia, solicitou valores e formas de pagamento.',
        assignedToId: supervisorUser.id,
        contactId: contacts[1].id,
        organizationId: org.id,
      },
    });

    await tx.message.createMany({
      data: [
        {
          direction: 'INBOUND',
          type: 'TEXT',
          content: 'Bom dia! Quero saber sobre aparelho ortodontico. Ja tenho 32 anos, ainda da tempo?',
          status: 'READ',
          conversationId: conv2.id,
          isFromBot: false,
          createdAt: new Date('2026-03-24T09:15:00'),
        },
        {
          direction: 'OUTBOUND',
          type: 'TEXT',
          content: 'Bom dia, Carlos! Claro que da tempo, nao existe idade limite para ortodontia! Trabalhamos com aparelho fixo convencional, estetico (ceramico) e tambem com alinhadores transparentes (Invisalign). Os valores comecam a partir de R$ 250/mes. Quer agendar uma avaliacao sem compromisso?',
          status: 'READ',
          conversationId: conv2.id,
          isFromBot: true,
          aiConfidence: 0.93,
          createdAt: new Date('2026-03-24T09:15:20'),
        },
        {
          direction: 'INBOUND',
          type: 'TEXT',
          content: 'Quanto fica o Invisalign? Aceita convenio Unimed?',
          status: 'READ',
          conversationId: conv2.id,
          isFromBot: false,
          createdAt: new Date('2026-03-24T09:20:00'),
        },
        {
          direction: 'OUTBOUND',
          type: 'TEXT',
          content: 'O Invisalign tem valores a partir de R$ 450/mes, dependendo da complexidade do caso. Sim, aceitamos Unimed! Na avaliacao a Dra. Camila vai fazer o planejamento digital e passar o orcamento certinho. Que tal na proxima segunda as 10h?',
          status: 'DELIVERED',
          conversationId: conv2.id,
          isFromBot: true,
          aiConfidence: 0.91,
          createdAt: new Date('2026-03-24T09:20:25'),
        },
      ],
    });

    // Conversa 3 - Pedro Henrique (nova, aguardando resposta)
    const conv3 = await tx.conversation.create({
      data: {
        status: 'WAITING',
        channel: 'whatsapp',
        sentiment: 'NEUTRAL',
        urgency: 'LOW',
        contactId: contacts[3].id,
        organizationId: org.id,
      },
    });

    await tx.message.createMany({
      data: [
        {
          direction: 'INBOUND',
          type: 'TEXT',
          content: 'Oi, voces atendem pelo SUS?',
          status: 'READ',
          conversationId: conv3.id,
          isFromBot: false,
          createdAt: new Date('2026-03-26T08:30:00'),
        },
        {
          direction: 'OUTBOUND',
          type: 'TEXT',
          content: 'Ola, Pedro! Infelizmente nao atendemos pelo SUS, somos uma clinica particular. Mas temos otimas condicoes de pagamento! Uma limpeza completa, por exemplo, custa R$ 180 e pode ser parcelada em 3x. Posso ajudar com mais alguma informacao?',
          status: 'DELIVERED',
          conversationId: conv3.id,
          isFromBot: true,
          aiConfidence: 0.89,
          createdAt: new Date('2026-03-26T08:30:18'),
        },
      ],
    });

    // Conversa 4 - Isabela (urgencia, escalada para humano)
    const conv4 = await tx.conversation.create({
      data: {
        status: 'ASSIGNED',
        channel: 'whatsapp',
        sentiment: 'NEGATIVE',
        urgency: 'HIGH',
        summary: 'Paciente com dor intensa, escalado para atendimento humano.',
        assignedToId: agentUser.id,
        contactId: contacts[6].id,
        organizationId: org.id,
      },
    });

    await tx.message.createMany({
      data: [
        {
          direction: 'INBOUND',
          type: 'TEXT',
          content: 'Socorro, estou com muita dor de dente!!! Tem como atender hoje urgente???',
          status: 'READ',
          conversationId: conv4.id,
          isFromBot: false,
          createdAt: new Date('2026-03-26T07:45:00'),
        },
        {
          direction: 'OUTBOUND',
          type: 'TEXT',
          content: 'Oi Isabela, entendo que voce esta com dor e vou te ajudar o mais rapido possivel! Vou transferir voce para nossa equipe de atendimento para encontrar o melhor horario de urgencia hoje. Um momento!',
          status: 'READ',
          conversationId: conv4.id,
          isFromBot: true,
          aiConfidence: 0.96,
          createdAt: new Date('2026-03-26T07:45:12'),
        },
        {
          direction: 'OUTBOUND',
          type: 'TEXT',
          content: 'Oi Isabela! Aqui e a Juliana da recepcao. Conseguimos encaixar voce hoje as 11h com o Dr. Ricardo. Pode vir nesse horario?',
          status: 'DELIVERED',
          conversationId: conv4.id,
          isFromBot: false,
          senderId: agentUser.id,
          createdAt: new Date('2026-03-26T07:48:00'),
        },
      ],
    });

    // Conversa 5 - Lucas Gabriel (protese, negociacao)
    const conv5 = await tx.conversation.create({
      data: {
        status: 'OPEN',
        channel: 'whatsapp',
        sentiment: 'POSITIVE',
        urgency: 'MEDIUM',
        summary: 'Paciente idoso interessado em protese fixa. Usando convenio Bradesco Dental.',
        contactId: contacts[5].id,
        organizationId: org.id,
      },
    });

    await tx.message.createMany({
      data: [
        {
          direction: 'INBOUND',
          type: 'TEXT',
          content: 'Boa tarde, meu pai precisa de uma protese dentaria. Ele tem 68 anos e tem convenio Bradesco Dental.',
          status: 'READ',
          conversationId: conv5.id,
          isFromBot: false,
          createdAt: new Date('2026-03-25T15:00:00'),
        },
        {
          direction: 'OUTBOUND',
          type: 'TEXT',
          content: 'Boa tarde, Lucas! Trabalhamos com protese fixa e protocolo sobre implante, e aceitamos o convenio Bradesco Dental. Para o caso do seu pai, o ideal e agendar uma avaliacao com radiografia panoramica. Temos horarios disponiveis essa semana. Prefere manha ou tarde?',
          status: 'READ',
          conversationId: conv5.id,
          isFromBot: true,
          aiConfidence: 0.94,
          createdAt: new Date('2026-03-25T15:00:22'),
        },
      ],
    });

    console.log('  5 conversas com mensagens criadas');

    // ═══════════════════════════════════════════════════════
    // 5. CAMPANHAS (1 concluida + 1 rascunho)
    // ═══════════════════════════════════════════════════════

    // Primeiro criar os templates que serao referenciados
    const templateLembrete = await tx.messageTemplate.create({
      data: {
        name: 'lembrete_consulta',
        category: 'UTILITY',
        language: 'pt_BR',
        headerType: 'TEXT',
        headerContent: 'Lembrete de Consulta',
        bodyText: 'Ola {{1}}! Passando para lembrar da sua consulta amanha, dia {{2}}, as {{3}} na Clinica Sorriso Perfeito. Confirma presenca? Responda SIM ou NAO.',
        footerText: 'Clinica Sorriso Perfeito - Seu sorriso, nossa prioridade!',
        buttons: [
          { type: 'QUICK_REPLY', text: 'SIM, confirmo!' },
          { type: 'QUICK_REPLY', text: 'Preciso remarcar' },
        ],
        metaStatus: 'APPROVED',
        organizationId: org.id,
      },
    });

    const templatePromocao = await tx.messageTemplate.create({
      data: {
        name: 'promocao_clareamento_marco',
        category: 'MARKETING',
        language: 'pt_BR',
        headerType: 'IMAGE',
        headerContent: 'https://clinicasorrisoperfeito.com.br/promo-clareamento.jpg',
        bodyText: 'Ola {{1}}! Este mes a Clinica Sorriso Perfeito esta com uma condicao especial: Clareamento dental a laser por R$ 890 em ate 6x sem juros! Agende sua avaliacao gratuita.',
        footerText: 'Promocao valida ate 31/03/2026. Vagas limitadas!',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Quero agendar!' },
          { type: 'QUICK_REPLY', text: 'Mais informacoes' },
        ],
        metaStatus: 'APPROVED',
        organizationId: org.id,
      },
    });

    console.log('  2 templates de mensagem criados');

    // Campanha concluida
    await tx.campaign.create({
      data: {
        name: 'Promocao Clareamento - Marco 2026',
        type: 'BROADCAST',
        status: 'COMPLETED',
        templateId: templatePromocao.id,
        audienceFilter: { leadStatus: ['QUALIFIED', 'CONTACTED'], tags: ['clareamento', 'estetica'] },
        scheduledAt: new Date('2026-03-10T09:00:00'),
        sentCount: 145,
        deliveredCount: 142,
        readCount: 118,
        repliedCount: 34,
        failedCount: 3,
        organizationId: org.id,
        completedAt: new Date('2026-03-10T09:45:00'),
      },
    });

    // Campanha rascunho
    await tx.campaign.create({
      data: {
        name: 'Lembrete Retorno Semestral - Abril 2026',
        type: 'BROADCAST',
        status: 'DRAFT',
        templateId: templateLembrete.id,
        audienceFilter: { leadStatus: ['CONVERTED'], lastVisitBefore: '2025-10-01' },
        organizationId: org.id,
      },
    });

    console.log('  2 campanhas criadas (1 concluida, 1 rascunho)');

    // ═══════════════════════════════════════════════════════
    // 6. DEALS (3 negocios em diferentes estagios)
    // ═══════════════════════════════════════════════════════
    await tx.deal.createMany({
      data: [
        {
          title: 'Clareamento Dental - Ana Carolina Lima',
          value: 890,
          stage: 'won',
          contactId: contacts[0].id,
          organizationId: org.id,
          closedAt: new Date('2026-03-20'),
        },
        {
          title: 'Ortodontia Invisalign - Carlos Eduardo Santos',
          value: 8500,
          stage: 'proposal',
          contactId: contacts[1].id,
          organizationId: org.id,
        },
        {
          title: 'Protese Protocolo - Lucas Gabriel Martins',
          value: 12000,
          stage: 'negotiation',
          contactId: contacts[5].id,
          organizationId: org.id,
        },
      ],
    });

    console.log('  3 deals criados (won, proposal, negotiation)');

    // ═══════════════════════════════════════════════════════
    // 7. BASE DE CONHECIMENTO (1 base + 2 documentos)
    // ═══════════════════════════════════════════════════════
    await tx.knowledgeBase.create({
      data: {
        name: 'Base de Conhecimento - Clinica Sorriso Perfeito',
        organizationId: org.id,
        documents: {
          create: [
            {
              title: 'Tabela de Servicos e Precos 2026',
              sourceType: 'manual',
              content: [
                'TABELA DE SERVICOS E PRECOS - CLINICA SORRISO PERFEITO - 2026',
                '',
                'PREVENCAO E DIAGNOSTICO:',
                '- Consulta inicial com avaliacao completa: R$ 120,00',
                '- Limpeza profissional (profilaxia): R$ 180,00',
                '- Radiografia panoramica digital: R$ 90,00',
                '- Radiografia periapical (por dente): R$ 35,00',
                '',
                'ESTETICA DENTAL:',
                '- Clareamento dental a laser (consultorio): R$ 890,00 (6x sem juros)',
                '- Clareamento caseiro com moldeira: R$ 450,00',
                '- Facetas de porcelana (por unidade): R$ 1.200,00 a R$ 2.500,00',
                '- Lente de contato dental (por unidade): R$ 2.000,00 a R$ 3.500,00',
                '- Restauracao estetica em resina: R$ 150,00 a R$ 350,00',
                '',
                'ORTODONTIA:',
                '- Aparelho fixo metalico convencional: R$ 250,00/mes (contrato 24 meses)',
                '- Aparelho fixo estetico (ceramica): R$ 350,00/mes',
                '- Invisalign (alinhadores transparentes): a partir de R$ 450,00/mes',
                '- Contencao fixa (pos-tratamento): R$ 300,00',
                '',
                'IMPLANTES E PROTESES:',
                '- Implante dentario unitario (com coroa): R$ 3.500,00 a R$ 5.500,00',
                '- Protocolo sobre implante (arcada completa): R$ 12.000,00 a R$ 25.000,00',
                '- Protese total removivel: R$ 1.800,00',
                '- Protese parcial removivel: R$ 1.200,00',
                '',
                'ENDODONTIA:',
                '- Tratamento de canal (anterior): R$ 600,00',
                '- Tratamento de canal (molar): R$ 900,00 a R$ 1.200,00',
                '',
                'CONDICOES DE PAGAMENTO:',
                '- Cartao de credito: ate 6x sem juros (acima de R$ 300)',
                '- Cartao de debito: 5% de desconto',
                '- PIX: 10% de desconto',
                '- Boleto: ate 3x sem juros',
                '',
                'CONVENIOS ACEITOS: Unimed Dental, Bradesco Dental, Amil Dental, SulAmerica Odonto',
              ].join('\n'),
            },
            {
              title: 'Perguntas Frequentes (FAQ)',
              sourceType: 'manual',
              content: [
                'FAQ - CLINICA SORRISO PERFEITO',
                '',
                'P: Qual o horario de funcionamento?',
                'R: Segunda a sexta das 08h as 19h, sabados das 08h as 13h.',
                '',
                'P: Onde fica a clinica?',
                'R: Rua das Flores, 123 - Centro, Campinas/SP. Ao lado da Padaria Central, com estacionamento proprio.',
                '',
                'P: Atendem por convenio?',
                'R: Sim! Aceitamos Unimed Dental, Bradesco Dental, Amil Dental e SulAmerica Odonto.',
                '',
                'P: Atendem emergencia/urgencia?',
                'R: Sim, temos horarios reservados para urgencias de segunda a sexta. Entre em contato que encaixamos o mais rapido possivel.',
                '',
                'P: Quanto tempo demora um clareamento?',
                'R: O clareamento a laser e feito em sessao unica de aproximadamente 1 hora. O caseiro leva de 2 a 3 semanas.',
                '',
                'P: O clareamento doi?',
                'R: Pode haver sensibilidade leve nos primeiros dias, mas utilizamos gel dessensibilizante antes e depois do procedimento.',
                '',
                'P: A partir de que idade pode usar aparelho?',
                'R: A ortodontia pode ser iniciada a partir dos 6-7 anos (ortopedia funcional) e nao tem limite maximo de idade.',
                '',
                'P: Qual a forma de pagamento?',
                'R: Cartao de credito (ate 6x sem juros), debito (5% desconto), PIX (10% desconto) e boleto (ate 3x).',
                '',
                'P: Preciso de pedido medico para fazer implante?',
                'R: Nao, basta agendar uma avaliacao. O Dr. Ricardo fara o planejamento completo com tomografia.',
                '',
                'P: Posso remarcar minha consulta?',
                'R: Sim! Pedimos apenas que avise com pelo menos 24 horas de antecedencia.',
              ].join('\n'),
            },
          ],
        },
      },
    });

    console.log('  1 base de conhecimento com 2 documentos criada');
  });

  console.log('');
  console.log('Seed finalizado com sucesso!');
  console.log('  Login admin:      admin@sorrisoperfeito.com.br / demo123');
  console.log('  Login supervisor: supervisora@sorrisoperfeito.com.br / demo123');
  console.log('  Login atendente:  atendente@sorrisoperfeito.com.br / demo123');
  console.log('  Organizacao:      Clinica Sorriso Perfeito (slug: clinica-sorriso)');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
