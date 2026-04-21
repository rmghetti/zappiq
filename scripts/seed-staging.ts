import { PrismaClient, PlanType, UserRole, ConversationStatus, MessageDirection, LeadStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const STAGING_PASSWORD = 'StagingTest2026!';
const SALT_ROUNDS = 10;

interface OrgConfig {
  name: string;
  plan: PlanType;
  isTrialActive: boolean;
  trialConverted: boolean;
  aiReadinessScore: number;
  lastActivityDaysAgo?: number;
  vertical: string;
}

const ORGANIZATIONS: OrgConfig[] = [
  // Trials em diferentes estágios
  {
    name: 'Clínica Santa Luz-STAGING',
    plan: 'STARTER',
    isTrialActive: true,
    trialConverted: false,
    aiReadinessScore: 15,
    vertical: 'healthcare',
  },
  {
    name: 'Varejo Expresso-STAGING',
    plan: 'STARTER',
    isTrialActive: true,
    trialConverted: false,
    aiReadinessScore: 45,
    vertical: 'retail',
  },
  {
    name: 'Colégio Horizonte-STAGING',
    plan: 'STARTER',
    isTrialActive: true,
    trialConverted: false,
    aiReadinessScore: 72,
    aiTrainingReadyAt: new Date(),
    vertical: 'education',
  },
  // Convertidos
  {
    name: 'Consultoria Meridiano-STAGING',
    plan: 'GROWTH',
    isTrialActive: false,
    trialConverted: true,
    aiReadinessScore: 85,
    vertical: 'consulting',
  },
  {
    name: 'Tech Serviços-STAGING',
    plan: 'GROWTH',
    isTrialActive: false,
    trialConverted: true,
    aiReadinessScore: 78,
    vertical: 'technology',
  },
  {
    name: 'Imobiliária Primus-STAGING',
    plan: 'SCALE',
    isTrialActive: false,
    trialConverted: true,
    aiReadinessScore: 92,
    vertical: 'realestate',
  },
  // Enterprise
  {
    name: 'Banco Corporativo-STAGING',
    plan: 'BUSINESS',
    isTrialActive: false,
    trialConverted: true,
    aiReadinessScore: 88,
    vertical: 'banking',
  },
  // Expirado sem conversão
  {
    name: 'Startup Falida-STAGING',
    plan: 'STARTER',
    isTrialActive: false,
    trialConverted: false,
    aiReadinessScore: 8,
    vertical: 'startup',
  },
  // Churn risk
  {
    name: 'Loja Dormida-STAGING',
    plan: 'GROWTH',
    isTrialActive: false,
    trialConverted: true,
    aiReadinessScore: 65,
    lastActivityDaysAgo: 20,
    vertical: 'retail',
  },
  // Extra para volume
  {
    name: 'Agência Digital-STAGING',
    plan: 'SCALE',
    isTrialActive: false,
    trialConverted: true,
    aiReadinessScore: 80,
    vertical: 'marketing',
  },
];

const QA_BY_VERTICAL: Record<string, Array<{ q: string; a: string; cat: string }>> = {
  healthcare: [
    {
      q: 'Qual é o horário de atendimento?',
      a: 'Segunda a sexta, 08:00-19:00. Sábado 08:00-13:00.',
      cat: 'horários',
    },
    {
      q: 'Como faço para agendar uma consulta?',
      a: 'Envie sua disponibilidade aqui e nossa equipe confirma em até 2 horas.',
      cat: 'agendamento',
    },
    {
      q: 'Qual é o valor da consulta inicial?',
      a: 'R$ 150,00. Este valor inclui avaliação completa.',
      cat: 'preço',
    },
    {
      q: 'Vocês aceitam plano de saúde?',
      a: 'Sim, aceitamos os principais planos. Verifique sua cobertura conosco.',
      cat: 'planos',
    },
    {
      q: 'Preciso levar documento na primeira visita?',
      a: 'Sim, leve RG/CPF e cartão do plano (se aplicável).',
      cat: 'documentos',
    },
  ],
  retail: [
    {
      q: 'Qual é o horário da loja?',
      a: 'Seg-sex 10:00-19:00, sab 10:00-18:00, dom 12:00-17:00.',
      cat: 'operacional',
    },
    {
      q: 'Vocês fazem entrega?',
      a: 'Sim! Entrega grátis acima de R$ 150. Prazo 2-3 dias úteis.',
      cat: 'logística',
    },
    {
      q: 'Qual é a política de devolução?',
      a: 'Devolução em até 30 dias com cupom fiscal. Reembolso total.',
      cat: 'políticas',
    },
    {
      q: 'Posso comprar online?',
      a: 'Sim, acesse www.varejo-expresso.com.br ou envie foto do produto.',
      cat: 'vendas',
    },
  ],
  education: [
    {
      q: 'Como faço para matricular meu filho?',
      a: 'Entre em contato conosco para agendar uma visita. Temos 4 períodos de matrícula ao ano.',
      cat: 'matrícula',
    },
    {
      q: 'Qual é o valor da mensalidade?',
      a: 'Educação infantil R$ 800. Fundamental R$ 1.200. Desconto para irmãos.',
      cat: 'financeiro',
    },
    {
      q: 'Vocês oferecem bolsa de estudos?',
      a: 'Sim, temos programa de bolsas para alunos com desempenho acadêmico excepcional.',
      cat: 'bolsas',
    },
    {
      q: 'Qual é a proposta pedagógica?',
      a: 'Seguimos metodologia ativa com foco em desenvolvimento integral do aluno.',
      cat: 'pedagógico',
    },
    {
      q: 'Vocês têm atividades extracurriculares?',
      a: 'Sim! Oferecemos inglês, esportes, artes, música e robótica.',
      cat: 'atividades',
    },
  ],
  consulting: [
    {
      q: 'Quais serviços vocês oferecem?',
      a: 'Estratégia empresarial, transformação digital, otimização de processos e gestão de projetos.',
      cat: 'serviços',
    },
    {
      q: 'Como é o processo de contratação?',
      a: 'Diagnóstico gratuito → Proposta → Contrato → Execução. Dura 2-3 semanas.',
      cat: 'processo',
    },
    {
      q: 'Qual é o ticket mínimo?',
      a: 'Nossos projetos começam em R$ 50.000. Consultamos especificidades individuais.',
      cat: 'comercial',
    },
    {
      q: 'Vocês trabalham com PMEs?',
      a: 'Sim, temos projetos customizados para empresas de 5 a 500 funcionários.',
      cat: 'público',
    },
  ],
  technology: [
    {
      q: 'Quais tecnologias vocês dominam?',
      a: 'Node.js, Python, React, AWS, Docker, Kubernetes e infraestrutura moderna.',
      cat: 'tech',
    },
    {
      q: 'Vocês fazem manutenção de código legacy?',
      a: 'Sim, refatoração, testes e modernização de sistemas antigos.',
      cat: 'serviços',
    },
    {
      q: 'Como é o modelo de contratação?',
      a: 'Projeto fixo, time dedicado ou consultoria horária. Mínimo 40h/mês.',
      cat: 'comercial',
    },
    {
      q: 'Qual é o prazo típico de um MVP?',
      a: '6-12 semanas dependendo da complexidade. Temos metodologia ágil.',
      cat: 'processo',
    },
  ],
  realestate: [
    {
      q: 'Como vocês avaliam um imóvel?',
      a: 'Análise de mercado, localização, estado físico e comparativo de preços.',
      cat: 'avaliação',
    },
    {
      q: 'Qual é a comissão de vocês?',
      a: '4-6% dependendo do tipo de imóvel. Combinado com o cliente.',
      cat: 'financeiro',
    },
    {
      q: 'Vocês fazem financiamento?',
      a: 'Somos intermediários. Conectamos com bancos e fintechs parceiras.',
      cat: 'financiamento',
    },
    {
      q: 'Quanto tempo leva para vender?',
      a: 'Média 60-90 dias. Dependem da localização e preço.',
      cat: 'processo',
    },
  ],
  banking: [
    {
      q: 'Qual é o horário de atendimento ao cliente?',
      a: 'Seg-sex 08:00-18:00. Feriados: 09:00-13:00. Suporte 24/7 para emergências.',
      cat: 'operacional',
    },
    {
      q: 'Como abrir uma conta?',
      a: 'Online em 5 minutos com CPF/CNPJ. Presencialmente em nossas agências.',
      cat: 'contas',
    },
    {
      q: 'Qual é a taxa de manutenção de conta?',
      a: 'Gratuita para pessoa física. PJ conforme pacote contratado.',
      cat: 'taxas',
    },
    {
      q: 'Como faço para sacar dinheiro?',
      a: 'Caixas eletrônicos 24h, saque em agências, Pix instantâneo.',
      cat: 'operações',
    },
  ],
  startup: [
    {
      q: 'Qual é a sua proposta de valor?',
      a: 'Conectar startups com investidores e aceleradoras.',
      cat: 'negócio',
    },
  ],
  marketing: [
    {
      q: 'Quais serviços vocês oferecem?',
      a: 'Branding, digital marketing, social media, SEO e produção de conteúdo.',
      cat: 'serviços',
    },
    {
      q: 'Como é o processo?',
      a: 'Discovery → Estratégia → Produção → Análise. Ciclos de 30 dias.',
      cat: 'processo',
    },
    {
      q: 'Qual é o ROI que vocês garantem?',
      a: 'Customizado por cliente. Média 300% em 6 meses para campanhas digitais.',
      cat: 'resultados',
    },
  ],
};

const BRAZILIAN_FIRST_NAMES = [
  'João',
  'Maria',
  'Carlos',
  'Ana',
  'Pedro',
  'Jennifer',
  'Lucas',
  'Sofia',
  'Felipe',
  'Beatriz',
  'Rafael',
  'Marina',
  'Diego',
  'Camila',
  'Bruno',
];

const BRAZILIAN_LAST_NAMES = [
  'Silva',
  'Santos',
  'Oliveira',
  'Costa',
  'Ferreira',
  'Gomes',
  'Martins',
  'Alves',
  'Souza',
  'Correia',
  'Pereira',
  'Rocha',
  'Pinto',
  'Barbosa',
  'Machado',
];

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateBrazilianPhone(): string {
  const ddd = String(Math.floor(Math.random() * 90 + 11)).padStart(2, '0');
  const first = String(Math.floor(Math.random() * 90000 + 10000));
  const second = String(Math.floor(Math.random() * 9000 + 1000));
  return `+55${ddd}${first}${second}`;
}

function generateBrazilianName(): string {
  const first = getRandomElement(BRAZILIAN_FIRST_NAMES);
  const last = getRandomElement(BRAZILIAN_LAST_NAMES);
  return `${first} ${last}`;
}

async function resetStagingOrgs() {
  console.log('[SEED] Resetting staging organizations...');
  const stagingOrgs = await prisma.organization.findMany({
    where: { name: { endsWith: '-STAGING' } },
    select: { id: true },
  });

  for (const org of stagingOrgs) {
    await prisma.organization.delete({ where: { id: org.id } });
  }
  console.log(`[SEED] Deleted ${stagingOrgs.length} existing staging orgs`);
}

async function seedOrganizations() {
  console.log('[SEED] Creating organizations...');
  const passwordHash = await bcrypt.hash(STAGING_PASSWORD, SALT_ROUNDS);
  const now = new Date();
  const trialStart = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000); // 15 days ago
  const trialEnd = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000); // 6 days from now
  const trialExpired = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // expired 5 days ago

  for (const orgConfig of ORGANIZATIONS) {
    const isTrialOrg = orgConfig.plan === 'STARTER' && orgConfig.isTrialActive;
    const isExpiredTrial =
      orgConfig.plan === 'STARTER' && !orgConfig.isTrialActive && !orgConfig.trialConverted;
    const isConverted = orgConfig.trialConverted;

    const slug = orgConfig.name.toLowerCase().replace(/\s+/g, '-');
    const org = await (prisma.organization as any).upsert({
      where: { slug },
      update: {},
      create: {
        name: orgConfig.name,
        slug,
        plan: orgConfig.plan,
        isTrialActive: orgConfig.isTrialActive,
        trialConverted: orgConfig.trialConverted,
        trialStartedAt: isTrialOrg || isExpiredTrial || isConverted ? trialStart : null,
        trialEndsAt: isTrialOrg ? trialEnd : isExpiredTrial ? trialExpired : null,
        aiReadinessScore: orgConfig.aiReadinessScore,
        aiReadinessUpdatedAt: new Date(),
        aiTrainingReadyAt: orgConfig.aiTrainingReadyAt || null,
        settings: {
          niche: orgConfig.vertical,
          agentName: 'Bot ZappIQ',
          tone: 'professional',
          businessName: orgConfig.name.replace('-STAGING', ''),
          businessHours: { weekdays: '08:00-18:00', saturday: '08:00-14:00', sunday: 'closed' },
          address: `Rua Virtual ${Math.floor(Math.random() * 1000)}, São Paulo/SP`,
          phone: generateBrazilianPhone(),
          website: `https://${orgConfig.name.toLowerCase().replace(/\s+/g, '-')}.com.br`,
        },
      },
    });

    // Create OWNER user
    await prisma.user.upsert({
      where: { email: `owner-${org.id.substring(0, 8)}@exemplo-staging.zappiq.com.br` },
      update: {},
      create: {
        email: `owner-${org.id.substring(0, 8)}@exemplo-staging.zappiq.com.br`,
        name: generateBrazilianName(),
        passwordHash,
        role: 'ADMIN' as UserRole,
        organizationId: org.id,
      },
    });

    // Create 2 AGENT users
    for (let i = 0; i < 2; i++) {
      await prisma.user.upsert({
        where: { email: `agent${i + 1}-${org.id.substring(0, 8)}@exemplo-staging.zappiq.com.br` },
        update: {},
        create: {
          email: `agent${i + 1}-${org.id.substring(0, 8)}@exemplo-staging.zappiq.com.br`,
          name: generateBrazilianName(),
          passwordHash,
          role: 'AGENT' as UserRole,
          organizationId: org.id,
        },
      });
    }

    console.log(
      `[SEED] Created org: ${orgConfig.name} | Plan: ${orgConfig.plan} | Trial: ${orgConfig.isTrialActive} | Score: ${orgConfig.aiReadinessScore}`,
    );

    // Create QA Pairs
    const qaList = QA_BY_VERTICAL[orgConfig.vertical] || [];
    for (const qa of qaList.slice(0, 5)) {
      await prisma.qAPair.create({
        data: {
          question: qa.q,
          answer: qa.a,
          category: qa.cat,
          isActive: true,
          organizationId: org.id,
        },
      });
    }

    // Create KB Documents
    for (let i = 1; i <= 2; i++) {
      const kbDoc = await prisma.kBDocument.create({
        data: {
          title: `Documento ${i} - ${orgConfig.name}`,
          sourceType: 'text',
          sourceUrl: null,
          content: `Conteúdo placeholder para documento ${i}. Este é um documento de teste para ${orgConfig.name}.`,
          knowledgeBase: {
            create: {
              name: `Base de Conhecimento - ${orgConfig.name}`,
              organizationId: org.id,
            },
          },
        },
      });
    }

    // Create Contacts
    for (let i = 0; i < 3; i++) {
      const phone = generateBrazilianPhone();
      await prisma.contact.create({
        data: {
          whatsappId: `${phone.replace(/\D/g, '')}`,
          phone,
          name: generateBrazilianName(),
          email: null,
          leadStatus: 'NEW' as LeadStatus,
          organizationId: org.id,
        },
      });
    }

    // Create Conversations & Messages
    const contacts = await prisma.contact.findMany({
      where: { organizationId: org.id },
    });

    for (const contact of contacts.slice(0, 2)) {
      const conv = await prisma.conversation.create({
        data: {
          status: 'OPEN' as ConversationStatus,
          channel: 'whatsapp',
          contactId: contact.id,
          organizationId: org.id,
        },
      });

      const msgCount = Math.floor(Math.random() * 10 + 5);
      for (let i = 0; i < msgCount; i++) {
        const isBot = i % 2 === 0;
        await prisma.message.create({
          data: {
            direction: isBot ? ('OUTBOUND' as MessageDirection) : ('INBOUND' as MessageDirection),
            type: 'TEXT',
            content: isBot
              ? `Olá! Como posso ajudar com sua dúvida sobre ${orgConfig.vertical}?`
              : `Preciso saber mais sobre seus serviços de ${orgConfig.vertical}.`,
            conversationId: conv.id,
            isFromBot: isBot,
            status: 'DELIVERED',
          },
        });
      }
    }

    // Create TenantUsageMonthly for converted orgs
    if (orgConfig.trialConverted) {
      const months = ['2026-01', '2026-02', '2026-03'];
      for (const month of months) {
        await (prisma as any).tenantUsageMonthly.upsert({
          where: {
            organizationId_periodYearMonth: {
              organizationId: org.id,
              periodYearMonth: month,
            },
          },
          update: {},
          create: {
            organizationId: org.id,
            periodYearMonth: month,
            llmCostUsd: Math.random() * 150 + 50,
            llmInputTokens: BigInt(Math.floor(Math.random() * 1000000)),
            llmOutputTokens: BigInt(Math.floor(Math.random() * 500000)),
            aiMessagesProcessed: Math.floor(Math.random() * 500 + 100),
            broadcastsSent: Math.floor(Math.random() * 50),
            conversationsOpened: Math.floor(Math.random() * 200 + 50),
            conversationsClosed: Math.floor(Math.random() * 150 + 30),
            conversationsAiResolved: Math.floor(Math.random() * 100 + 20),
            conversationsHumanResolved: Math.floor(Math.random() * 80 + 10),
            handoffsCount: Math.floor(Math.random() * 30 + 5),
            revenueBrlCents: Math.floor((Math.random() * 3000 + 500) * 100),
            infraCostUsd: Math.random() * 30 + 10,
          },
        });
      }
    }
  }
}

async function createSuperAdmin() {
  console.log('[SEED] Creating superadmin user...');
  const passwordHash = await bcrypt.hash(STAGING_PASSWORD, SALT_ROUNDS);

  const dummyOrg = await (prisma.organization as any).upsert({
    where: { slug: 'zappiq-superadmin' },
    update: {},
    create: {
      name: 'ZappIQ-Superadmin',
      slug: 'zappiq-superadmin',
      plan: 'ENTERPRISE',
      isTrialActive: false,
      trialConverted: true,
      aiReadinessScore: 100,
    },
  });

  await prisma.user.upsert({
    where: { email: 'rodrigo@zappiq.com.br' },
    update: {},
    create: {
      email: 'rodrigo@zappiq.com.br',
      name: 'Rodrigo Ghetti',
      passwordHash,
      role: 'ADMIN' as UserRole,
      organizationId: dummyOrg.id,
    },
  });

  console.log('[SEED] Superadmin created: rodrigo@zappiq.com.br');
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('[ERROR] Seed script cannot run in production!');
    process.exit(1);
  }

  console.log('[SEED] Starting staging database seed...');
  console.log(`[SEED] Default password: ${STAGING_PASSWORD}`);
  console.log('[SEED] Hash cost rounds: 10');

  if (process.argv.includes('--reset')) {
    await resetStagingOrgs();
  }

  await seedOrganizations();
  await createSuperAdmin();

  console.log('[SEED] ✓ Seeding complete!');
  console.log('[SEED] Organizations created: 10 staging + 1 superadmin');
  console.log('[SEED] All users can log in with password: ' + STAGING_PASSWORD);
}

main()
  .catch((e) => {
    console.error('[ERROR]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
