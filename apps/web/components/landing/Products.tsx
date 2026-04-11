'use client';

import { useState } from 'react';
import { Inbox, Brain, Megaphone, BarChart3, Users, Workflow, Headphones, CheckCircle2, Star } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
// Logos SVG inline — mesma linguagem visual em todos os produtos
// ═══════════════════════════════════════════════════════════════════

interface LogoConfig {
  name1: string;
  name2: string;
  color2: string;
  subtitle: string;
  innerIcon: React.ReactNode;
}

const LOGO_CONFIGS: Record<string, LogoConfig> = {
  core: {
    name1: 'ZappIQ',
    name2: 'Core',
    color2: '#1B6B3A',
    subtitle: 'CENTRAL DE CONVERSAS INTELIGENTE',
    innerIcon: (
      <path d="M65 31L41 60H57L52 82L78 48H62L65 31Z" fill="white" />
    ),
  },
  pulse: {
    name1: 'Pulse',
    name2: 'AI',
    color2: '#EF4444',
    subtitle: 'AGENTE DE IA 24/7',
    innerIcon: (
      <>
        <polyline
          points="36,55 44,55 48,38 52,72 56,45 62,55 68,55"
          stroke="white" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round"
        />
        <line x1="68" y1="55" x2="78" y2="55" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.5" />
      </>
    ),
  },
  spark: {
    name1: 'Spark',
    name2: 'Campaigns',
    color2: '#F59E0B',
    subtitle: 'MOTOR DE CAMPANHAS EM MASSA',
    innerIcon: (
      <>
        <path d="M44,48 L50,48 L63,38 L63,68 L50,58 L44,58 Z" fill="white" />
        <path d="M50,58 L47,70 L53,70 L56,58" fill="white" opacity="0.8" />
        <path d="M67,44 C72,49 72,57 67,62" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M71,40 C78,47 78,59 71,66" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6" />
      </>
    ),
  },
  radar: {
    name1: 'Radar',
    name2: 'Insights',
    color2: '#7C3AED',
    subtitle: 'INTELIGÊNCIA ANALÍTICA EM TEMPO REAL',
    innerIcon: (
      <>
        <circle cx="60" cy="52" r="14" stroke="white" strokeWidth="3" fill="none" />
        <circle cx="60" cy="52" r="7" stroke="white" strokeWidth="3" fill="none" />
        <circle cx="60" cy="52" r="2.5" fill="white" />
        <line x1="60" y1="52" x2="70" y2="42" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        <polygon points="70,42 75,40 73,46" fill="white" />
      </>
    ),
  },
  nexus: {
    name1: 'Nexus',
    name2: 'CRM',
    color2: '#0D9488',
    subtitle: 'CRM NATIVO PARA WHATSAPP',
    innerIcon: (
      <>
        <line x1="42" y1="44" x2="78" y2="44" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
        <line x1="42" y1="53" x2="78" y2="53" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
        <line x1="42" y1="62" x2="62" y2="62" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
      </>
    ),
  },
  forge: {
    name1: 'Forge',
    name2: 'Studio',
    color2: '#F59E0B',
    subtitle: 'CONSTRUTOR VISUAL DE FLUXOS',
    innerIcon: (
      <>
        <rect x="47" y="46" width="13" height="13" rx="2" fill="white" />
        <rect x="63" y="35" width="13" height="13" rx="2" fill="white" />
        <rect x="63" y="58" width="13" height="13" rx="2" fill="white" />
        <line x1="60" y1="52" x2="63" y2="41.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="60" y1="52" x2="63" y2="64.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      </>
    ),
  },
  echo: {
    name1: 'Echo',
    name2: 'Copilot',
    color2: '#C026D3',
    subtitle: 'COPILOTO INTELIGENTE DO AGENTE',
    innerIcon: (
      <>
        <circle cx="60" cy="53" r="5" fill="white" />
        <path d="M48,53 C48,40 72,40 72,53" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M41,53 C41,33 79,33 79,53" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.6" />
      </>
    ),
  },
};

// ── Logo compacto para os tabs (sem subtitle) ─────────────────────

function ProductTabLogo({ id }: { id: string }) {
  const cfg = LOGO_CONFIGS[id];
  if (!cfg) return null;
  const gid = `gt_${id}`;
  return (
    <svg
      viewBox="0 0 162 40"
      width="162"
      height="40"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
      textRendering="optimizeLegibility"
    >
      <defs>
        {/* objectBoundingBox: gradiente independente do transform — sempre top-right→bottom-left */}
        <linearGradient id={gid} x1="0.9" y1="0" x2="0.1" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0" stopColor="#25D366" />
          <stop offset="1" stopColor="#4361EE" />
        </linearGradient>
      </defs>
      {/* Bubble + ícone + sparkles — escala 0.37 da viewBox original */}
      <g transform="translate(2, 2) scale(0.37)">
        <path
          d="M60 95C82.0914 95 100 77.0914 100 55C100 32.9086 82.0914 15 60 15C37.9086 15 20 32.9086 20 55C20 63.271 22.508 70.9554 26.8407 77.2646L20 95L38.9912 89.6133C45.242 93.1171 52.4096 95 60 95Z"
          fill={`url(#${gid})`}
        />
        {cfg.innerIcon}
        <path d="M104,15 L105.5,20 L110.5,21.5 L105.5,23 L104,28 L102.5,23 L97.5,21.5 L102.5,20 Z" fill="#818CF8" />
        <path d="M91,8 L92,11.5 L95.5,12.5 L92,13.5 L91,17 L90,13.5 L86.5,12.5 L90,11.5 Z" fill="#A5B4FC" />
      </g>
      {/* Nome do produto */}
      <text
        x="46"
        y="25"
        fontFamily="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"
        letterSpacing="-0.3"
      >
        <tspan fontWeight="800" fontSize="14" fill="#1A2744">{cfg.name1}</tspan>
        <tspan fontWeight="700" fontSize="14" fill={cfg.color2}>{cfg.name2}</tspan>
      </text>
    </svg>
  );
}

// ── Logo completo com subtitle (cabeçalho do produto ativo) ───────

function ProductFullLogo({ id }: { id: string }) {
  const cfg = LOGO_CONFIGS[id];
  if (!cfg) return null;
  const gid = `gf_${id}`;
  return (
    <svg
      viewBox="0 0 260 64"
      width="260"
      height="64"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
      textRendering="optimizeLegibility"
    >
      <defs>
        <linearGradient id={gid} x1="0.9" y1="0" x2="0.1" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0" stopColor="#25D366" />
          <stop offset="1" stopColor="#4361EE" />
        </linearGradient>
      </defs>
      {/* Bubble + ícone + sparkles — escala 0.55 */}
      <g transform="translate(2, 4) scale(0.55)">
        <path
          d="M60 95C82.0914 95 100 77.0914 100 55C100 32.9086 82.0914 15 60 15C37.9086 15 20 32.9086 20 55C20 63.271 22.508 70.9554 26.8407 77.2646L20 95L38.9912 89.6133C45.242 93.1171 52.4096 95 60 95Z"
          fill={`url(#${gid})`}
        />
        {cfg.innerIcon}
        <path d="M104,15 L105.5,20 L110.5,21.5 L105.5,23 L104,28 L102.5,23 L97.5,21.5 L102.5,20 Z" fill="#818CF8" />
        <path d="M91,8 L92,11.5 L95.5,12.5 L92,13.5 L91,17 L90,13.5 L86.5,12.5 L90,11.5 Z" fill="#A5B4FC" />
      </g>
      {/* Nome */}
      <text
        x="68"
        y="36"
        fontFamily="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"
        letterSpacing="-0.4"
      >
        <tspan fontWeight="800" fontSize="22" fill="#1A2744">{cfg.name1}</tspan>
        <tspan fontWeight="700" fontSize="22" fill={cfg.color2}>{cfg.name2}</tspan>
      </text>
      {/* Subtitle */}
      <text
        x="69"
        y="53"
        fontFamily="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"
        fontSize="8"
        fontWeight="600"
        fill="#6B7280"
        letterSpacing="1.8"
      >
        {cfg.subtitle}
      </text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Dados dos produtos
// ═══════════════════════════════════════════════════════════════════

const PRODUCTS = [
  {
    id: 'core', icon: Inbox, name: 'ZappIQ Core', tagline: 'Central de Conversas Inteligente',
    desc: 'Todas as conversas do WhatsApp centralizadas em um painel profissional de nível enterprise. Gerencie múltiplos atendentes, acompanhe conversas em tempo real e nunca perca uma mensagem.',
    bullets: [
      'Distribuição inteligente de conversas entre agentes (round-robin, por skill, por carga)',
      'Histórico completo e unificado de cada cliente em um timeline visual',
      'Indicadores de performance em tempo real (tempo de resposta, SLA, CSAT)',
      'Tags, filtros avançados e segmentação automática de conversas',
      'Notas internas entre agentes sem o cliente ver',
      'Transferência de conversas com contexto completo preservado',
    ],
    metrics: [
      { label: 'Redução no tempo de resposta', value: '89%' },
      { label: 'Conversas gerenciadas/agente', value: '5x mais' },
      { label: 'Satisfação do cliente (CSAT)', value: '4.8/5' },
    ],
    caseStudy: {
      business: 'Clínica Vida Plena', segment: 'Saúde',
      quote: 'Antes, perdíamos 40% das mensagens fora do horário comercial. Com o ZappIQ Core, nossa taxa de resposta chegou a 99,2% e o tempo médio caiu de 4 horas para 3 minutos.',
      author: 'Dra. Camila Andrade', role: 'Diretora Clínica',
      results: ['99,2% taxa de resposta', '3 min tempo médio', '+45% agendamentos'],
    },
    mockup: 'inbox',
  },
  {
    id: 'pulse', icon: Brain, name: 'Pulse AI', tagline: 'Assistente Virtual com IA Generativa',
    desc: 'Um agente de IA que aprende tudo sobre seu negócio e atende seus clientes 24/7 com linguagem natural, empatia e precisão. Não é um chatbot com respostas prontas — é inteligência de verdade.',
    bullets: [
      'Aprende com documentos, FAQs, catálogos, políticas e até o tom de voz do seu negócio',
      'Agenda consultas automaticamente integrando com Google Calendar',
      'Gera orçamentos personalizados em tempo real com base no catálogo de serviços',
      'Consulta status de pedidos via integração com APIs externas',
      'Reconhece sentimento negativo e escala para humano com resumo completo',
      'Transcreve e responde áudios do WhatsApp automaticamente',
    ],
    metrics: [
      { label: 'Respostas automatizadas', value: '81%' },
      { label: 'Precisão das respostas', value: '94%' },
      { label: 'Disponibilidade', value: '24/7/365' },
    ],
    caseStudy: {
      business: 'TrendMix Moda', segment: 'Varejo',
      quote: 'O Pulse AI vende sozinho! Ele entende as preferências dos clientes, sugere produtos e fecha vendas enquanto dormimos. Nossas vendas noturnas representam 28% do faturamento agora.',
      author: 'Ricardo Mendes', role: 'CEO',
      results: ['+35% em vendas', '28% das vendas à noite', 'R$42k/mês via IA'],
    },
    mockup: 'chat',
  },
  {
    id: 'spark', icon: Megaphone, name: 'Spark Campaigns', tagline: 'Motor de Campanhas em Massa',
    desc: 'Dispare promoções, recupere carrinhos abandonados e reengaje clientes inativos com campanhas segmentadas pela API oficial do WhatsApp. Zero risco de banimento, máximo resultado.',
    bullets: [
      'Disparos segmentados por tags, comportamento, localização e histórico de compras',
      'Automações por gatilho: carrinho abandonado, aniversário, pós-venda, reengajamento',
      'Templates pré-aprovados pela Meta com variáveis dinâmicas e botões interativos',
      'Sequências multi-etapa com condições e delays configuráveis',
      'Dashboard de resultados em tempo real (enviados, entregues, lidos, respondidos)',
      'A/B testing de mensagens para otimizar conversão',
    ],
    metrics: [
      { label: 'Taxa de abertura', value: '98%' },
      { label: 'ROI médio por campanha', value: '270%' },
      { label: 'Carrinhos recuperados', value: '35%' },
    ],
    caseStudy: {
      business: 'Sabor & Arte Restaurante', segment: 'Restaurante',
      quote: 'Uma campanha de reativação de clientes inativos gerou R$18.000 em reservas em apenas 48 horas. O Spark Campaigns tem o melhor ROI de qualquer canal de marketing que já usamos.',
      author: 'Fernanda Costa', role: 'Proprietária',
      results: ['R$18k em 48h', '98% taxa de entrega', '3x mais reservas'],
    },
    mockup: 'campaign',
  },
  {
    id: 'radar', icon: BarChart3, name: 'Radar Insights', tagline: 'Inteligência Analítica em Tempo Real',
    desc: 'Dashboards executivos com todas as métricas que importam: conversão, performance de agentes, sentimento de clientes, receita gerada e tendências. Decisões baseadas em dados, não em achismo.',
    bullets: [
      'KPIs em tempo real: conversas, automação, CSAT, receita gerada via WhatsApp',
      'Ranking de performance individual de cada agente com metas configuráveis',
      'Análise de sentimento por IA em cada conversa (positivo, neutro, negativo)',
      'Heatmap de horários de pico para otimizar escalas e disponibilidade da IA',
      'Relatórios automáticos enviados por e-mail (diário, semanal, mensal)',
      'Funil de conversão visual desde o primeiro contato até o fechamento',
    ],
    metrics: [
      { label: 'Decisões data-driven', value: '100%' },
      { label: 'Tempo para gerar relatório', value: '0 min' },
      { label: 'Melhoria média em conversão', value: '+42%' },
    ],
    caseStudy: {
      business: 'EducaMais Cursos', segment: 'Educação',
      quote: 'O Radar mostrou que perdíamos 60% dos leads entre 12h-14h por falta de atendentes. Ajustamos a escala e as matrículas subiram 55% no mês seguinte. Dados salvaram nosso período de captação.',
      author: 'Prof. André Souza', role: 'Coordenador',
      results: ['+55% matrículas', '60% gap identificado', 'Escala otimizada'],
    },
    mockup: 'analytics',
  },
  {
    id: 'nexus', icon: Users, name: 'Nexus CRM', tagline: 'CRM Nativo para WhatsApp',
    desc: 'Um CRM que nasce das conversas do WhatsApp. Cada interação alimenta o perfil do cliente, atualiza o funil automaticamente e programa follow-ups que nunca são esquecidos.',
    bullets: [
      'Ficha completa do contato com timeline de todas as interações via WhatsApp',
      'Funil de vendas Kanban visual com drag-and-drop e stages personalizáveis',
      'Lead scoring automático baseado em comportamento e engajamento na conversa',
      'Follow-ups programados com lembretes automáticos para a equipe',
      'Importação em massa via CSV e exportação para Excel/Google Sheets',
      'Integração com HubSpot, RD Station e Pipedrive via API',
    ],
    metrics: [
      { label: 'Leads qualificados automaticamente', value: '92%' },
      { label: 'Taxa de follow-up cumprido', value: '100%' },
      { label: 'Ciclo de venda reduzido em', value: '40%' },
    ],
    caseStudy: {
      business: 'Bella Casa Imóveis', segment: 'Imobiliário',
      quote: 'O Nexus CRM transformou nosso processo. Antes, leads de portais esfriavam em horas. Agora, são qualificados em 30 segundos e o corretor recebe um briefing completo. Fechamentos subiram 30%.',
      author: 'Marcos Oliveira', role: 'Diretor Comercial',
      results: ['+30% fechamentos', '30seg para qualificar', 'Zero lead perdido'],
    },
    mockup: 'crm',
  },
  {
    id: 'forge', icon: Workflow, name: 'Forge Studio', tagline: 'Construtor Visual de Fluxos',
    desc: 'Crie jornadas de atendimento complexas arrastando e soltando blocos. Sem código, sem desenvolvedor. Templates prontos para cada segmento aceleram o go-to-market.',
    bullets: [
      'Editor drag-and-drop intuitivo com blocos de condição, ação e delay',
      '50+ templates prontos para 16 segmentos diferentes de mercado',
      'Condições inteligentes: horário, tag, lead score, palavras-chave, sentimento',
      'Teste seu fluxo antes de publicar com simulador integrado',
      'Versionamento automático para rollback rápido se necessário',
      'Integração com todos os módulos ZappIQ (IA, CRM, Campanhas, Agenda)',
    ],
    metrics: [
      { label: 'Tempo para criar um fluxo', value: '15 min' },
      { label: 'Templates prontos', value: '50+' },
      { label: 'Segmentos cobertos', value: '16' },
    ],
    caseStudy: {
      business: 'AutoTech Oficina', segment: 'Automotivo',
      quote: 'Criei um fluxo de agendamento de revisão em 15 minutos, sem ajuda técnica. Quando o cliente manda "revisão", a IA verifica o histórico do veículo, sugere serviços e agenda. Agendamentos subiram 40%.',
      author: 'Marcos Silva', role: 'Proprietário',
      results: ['+40% agendamentos', '15min para criar fluxo', 'Zero código necessário'],
    },
    mockup: 'flow',
  },
  {
    id: 'echo', icon: Headphones, name: 'Echo Copilot', tagline: 'Copiloto Inteligente do Agente',
    desc: 'Um assistente de IA que trabalha ao lado do seu atendente humano. Sugere respostas, resume conversas, transcreve áudios e identifica oportunidades de venda em tempo real.',
    bullets: [
      'Sugestões de resposta em tempo real baseadas no contexto e histórico do cliente',
      'Resumo automático de conversas longas em 1 clique (útil para transferências)',
      'Transcrição instantânea de áudios do WhatsApp com destaque de pontos-chave',
      'Detecção de oportunidades de upsell/cross-sell durante a conversa',
      'Análise de sentimento em tempo real com alertas para conversas em risco',
      'Base de conhecimento contextual ao lado do chat para consulta rápida',
    ],
    metrics: [
      { label: 'Tempo de resposta do agente', value: '-60%' },
      { label: 'Precisão das sugestões', value: '91%' },
      { label: 'Oportunidades identificadas', value: '+35%' },
    ],
    caseStudy: {
      business: 'Dra. Renata Psicologia', segment: 'Psicologia',
      quote: 'O Echo Copilot transformou minha recepcionista em uma especialista. Ela responde com confiança porque o copiloto sugere respostas perfeitas. O tempo de resposta caiu 60% e os pacientes elogiam o atendimento.',
      author: 'Dra. Renata Silva', role: 'Psicóloga Clínica',
      results: ['-60% tempo resposta', '91% precisão', '+35% agendamentos'],
    },
    mockup: 'copilot',
  },
];

// ═══════════════════════════════════════════════════════════════════
// Mockups de preview
// ═══════════════════════════════════════════════════════════════════

const MOCKUPS: Record<string, React.ReactNode> = {
  inbox: (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-[10px] text-gray-500 font-medium uppercase mb-1">Conversas ativas</p>
          <p className="text-2xl font-extrabold text-gray-900">147</p>
          <p className="text-[10px] text-green-500 font-semibold">▲ +23% vs semana anterior</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-[10px] text-gray-500 font-medium uppercase mb-1">Tempo médio</p>
          <p className="text-2xl font-extrabold text-primary-600">2.4min</p>
          <p className="text-[10px] text-green-500 font-semibold">▲ -67% vs mês anterior</p>
        </div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 text-[10px] font-semibold text-gray-700">Conversas recentes</div>
        {[
          { name: 'Ana Lima', msg: 'Consulta agendada para quinta 14h ✅', tag: 'IA', tagColor: 'bg-green-100 text-green-700' },
          { name: 'Carlos Santos', msg: 'Pedindo orçamento de clareamento', tag: 'Novo', tagColor: 'bg-blue-100 text-blue-700' },
          { name: 'Maria Oliveira', msg: 'Pagamento confirmado — R$890', tag: 'Venda', tagColor: 'bg-purple-100 text-purple-700' },
          { name: 'Pedro Alves', msg: 'Quer remarcar para segunda', tag: 'Agente', tagColor: 'bg-yellow-100 text-yellow-700' },
        ].map((c, i) => (
          <div key={i} className="px-3 py-2.5 border-b border-gray-50 flex items-center gap-2 hover:bg-gray-50">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400 to-secondary-400 flex items-center justify-center text-white text-[9px] font-bold">{c.name.split(' ').map(n => n[0]).join('')}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-gray-900">{c.name}</p>
              <p className="text-[10px] text-gray-400 truncate">{c.msg}</p>
            </div>
            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${c.tagColor}`}>{c.tag}</span>
          </div>
        ))}
      </div>
    </div>
  ),
  chat: (
    <div className="bg-[#ECE5DD] rounded-lg overflow-hidden">
      <div className="bg-[#075E54] px-3 py-2 flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-[10px] font-bold">ML</div>
        <div><p className="text-white text-[11px] font-semibold">Maria Lopes</p><p className="text-green-200 text-[9px]">online</p></div>
      </div>
      <div className="p-3 space-y-2">
        <div className="bg-white rounded-lg rounded-tl-none px-3 py-2 max-w-[85%] text-[11px] text-gray-700 shadow-sm">Vi o vestido floral no Instagram! Ainda tem em M?</div>
        <div className="bg-[#D9FDD3] rounded-lg rounded-tr-none px-3 py-2 max-w-[85%] ml-auto text-[11px] text-gray-700 shadow-sm">
          <div className="text-[8px] text-[#075E54] font-bold mb-0.5">⚡ Pulse IA</div>
          Sim, Maria! 🌸 Temos o Vestido Floral Primavera em M!<br /><br />💰 R$ 189,90 ou 3x de R$ 63,30<br />📦 Frete grátis!<br /><br />Quer que eu envie o link de pagamento?
        </div>
        <div className="bg-white rounded-lg rounded-tl-none px-3 py-2 max-w-[85%] text-[11px] text-gray-700 shadow-sm">Sim, quero comprar! 😍</div>
        <div className="bg-[#D9FDD3] rounded-lg rounded-tr-none px-3 py-2 max-w-[85%] ml-auto text-[11px] text-gray-700 shadow-sm">
          <div className="text-[8px] text-[#075E54] font-bold mb-0.5">⚡ Pulse IA</div>
          ✅ Aqui está seu link seguro:<br />🔗 pay.trendmix.com/abc<br /><br />Após o pagamento, envio o rastreio em até 2h! 🚀
        </div>
      </div>
    </div>
  ),
  campaign: (
    <div className="space-y-3">
      <div className="bg-white rounded-lg border border-green-200 p-3 flex items-center justify-between">
        <div><p className="text-[11px] font-bold text-gray-900">📣 Campanha: Volta às Aulas</p><p className="text-[9px] text-gray-400">Iniciada há 2 horas</p></div>
        <span className="bg-green-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">ATIVA</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Enviados', value: '2.450', color: 'text-gray-900' },
          { label: 'Entregues', value: '2.398', color: 'text-blue-600' },
          { label: 'Lidos', value: '1.870', color: 'text-primary-600' },
          { label: 'Responderam', value: '342', color: 'text-secondary-500' },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-lg border border-gray-200 p-2.5 text-center">
            <p className={`text-lg font-extrabold ${m.color}`}>{m.value}</p>
            <p className="text-[9px] text-gray-400">{m.label}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <p className="text-[10px] font-semibold text-gray-700 mb-2">Progresso</p>
        {[
          { label: 'Entrega', pct: 98, color: 'bg-green-500' },
          { label: 'Leitura', pct: 76, color: 'bg-blue-500' },
          { label: 'Resposta', pct: 14, color: 'bg-primary-500' },
        ].map((b) => (
          <div key={b.label} className="flex items-center gap-2 mb-1.5">
            <span className="text-[9px] text-gray-500 w-12">{b.label}</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${b.color} rounded-full`} style={{ width: `${b.pct}%` }} /></div>
            <span className="text-[9px] font-bold text-gray-700">{b.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  ),
  analytics: (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Conversas', value: '247', color: 'text-gray-900' },
          { label: 'Automação', value: '89%', color: 'text-primary-600' },
          { label: 'CSAT', value: '4.8', color: 'text-yellow-500' },
          { label: 'Receita', value: 'R$18k', color: 'text-secondary-500' },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-lg border border-gray-200 p-2.5 text-center">
            <p className={`text-lg font-extrabold ${m.color}`}>{m.value}</p>
            <p className="text-[9px] text-gray-400">{m.label}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <p className="text-[10px] font-semibold text-gray-700 mb-2">📊 Receita via WhatsApp</p>
        <div className="flex items-end gap-1.5 h-20">
          {[35, 42, 55, 62, 58, 72, 85, 78, 92, 88, 95, 100].map((h, i) => (
            <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, background: i >= 10 ? 'linear-gradient(180deg, #1B6B3A, #25D366)' : 'rgba(27,107,58,0.15)' }} />
          ))}
        </div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <p className="text-[10px] font-semibold text-gray-700 mb-2">Sentimento das conversas</p>
        <div className="flex gap-2">
          <div className="flex-1 bg-green-50 rounded-lg p-2 text-center"><p className="text-sm font-bold text-green-600">72%</p><p className="text-[9px] text-gray-500">Positivo</p></div>
          <div className="flex-1 bg-gray-50 rounded-lg p-2 text-center"><p className="text-sm font-bold text-gray-600">22%</p><p className="text-[9px] text-gray-500">Neutro</p></div>
          <div className="flex-1 bg-red-50 rounded-lg p-2 text-center"><p className="text-sm font-bold text-red-500">6%</p><p className="text-[9px] text-gray-500">Negativo</p></div>
        </div>
      </div>
    </div>
  ),
  crm: (
    <div className="space-y-3">
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <p className="text-[10px] font-semibold text-gray-700 mb-3">🎯 Pipeline de Vendas</p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { stage: 'Novo', count: 14, color: 'bg-blue-100 border-blue-200', leads: ['Ana L. ⭐85', 'Pedro S. ⭐72'] },
            { stage: 'Qualificado', count: 8, color: 'bg-green-100 border-green-200', leads: ['Maria C. ⭐92', 'João R. ⭐88'] },
            { stage: 'Proposta', count: 5, color: 'bg-yellow-100 border-yellow-200', leads: ['Carlos ⭐90', 'Julia ⭐85'] },
            { stage: 'Fechado ✓', count: 3, color: 'bg-primary-100 border-primary-200', leads: ['Marcos R$1.2k', 'Ana R$890'] },
          ].map((s) => (
            <div key={s.stage} className="text-center">
              <p className="text-[9px] font-bold text-gray-500 uppercase mb-1.5">{s.stage}</p>
              {s.leads.map((l, i) => (
                <div key={i} className={`${s.color} border rounded-md p-1.5 mb-1 text-[9px] text-gray-700 font-medium`}>{l}</div>
              ))}
              <p className="text-[9px] text-gray-400 mt-1">+{s.count - 2} mais</p>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <p className="text-xl font-extrabold text-primary-600">67%</p>
          <p className="text-[9px] text-gray-500">Taxa de conversão</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <p className="text-xl font-extrabold text-secondary-500">R$34k</p>
          <p className="text-[9px] text-gray-500">Pipeline total</p>
        </div>
      </div>
    </div>
  ),
  flow: (
    <div className="space-y-3">
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <p className="text-[10px] font-semibold text-gray-700 mb-3">⚙️ Fluxo: Agendamento Automático</p>
        <div className="space-y-2">
          {[
            { label: 'Gatilho: Cliente envia "agendar"', color: 'bg-blue-100 border-blue-300 text-blue-700' },
            { label: '→ IA verifica slots disponíveis', color: 'bg-yellow-100 border-yellow-300 text-yellow-700' },
            { label: '→ Oferece 3 horários ao cliente', color: 'bg-green-100 border-green-300 text-green-700' },
            { label: '→ Cliente escolhe → Confirma agendamento', color: 'bg-green-100 border-green-300 text-green-700' },
            { label: '→ Envia lembrete 24h antes', color: 'bg-purple-100 border-purple-300 text-purple-700' },
            { label: '→ Se não responde → Escala para agente', color: 'bg-red-100 border-red-300 text-red-700' },
          ].map((step, i) => (
            <div key={i} className={`${step.color} border rounded-lg px-3 py-2 text-[10px] font-medium`}>{step.label}</div>
          ))}
        </div>
      </div>
    </div>
  ),
  copilot: (
    <div className="space-y-3">
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-primary-50 px-3 py-2 border-b border-primary-100">
          <p className="text-[10px] font-bold text-primary-700">💡 Echo Copilot — Sugestões em tempo real</p>
        </div>
        <div className="p-3 space-y-2">
          <div className="bg-green-50 border border-green-200 rounded-lg p-2.5">
            <p className="text-[9px] font-bold text-green-700 mb-1">✨ Sugestão de resposta (91% match)</p>
            <p className="text-[10px] text-gray-700">"Claro, Maria! Temos o vestido em M. O valor é R$ 189,90 com frete grátis. Posso enviar o link de pagamento?"</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
            <p className="text-[9px] font-bold text-blue-700 mb-1">🎯 Oportunidade de venda detectada</p>
            <p className="text-[10px] text-gray-700">Cliente mencionou "acessórios". Sugerir o colar que combina com o vestido (R$ 49,90).</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5">
            <p className="text-[9px] font-bold text-yellow-700 mb-1">📝 Resumo da conversa</p>
            <p className="text-[10px] text-gray-700">Maria, cliente recorrente (3 compras). Interesse: vestido floral M. Preferência: parcelamento. Ticket médio: R$220.</p>
          </div>
        </div>
      </div>
    </div>
  ),
};

// ═══════════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════════

export function Products() {
  const [active, setActive] = useState(0);
  const product = PRODUCTS[active];

  return (
    <section id="produtos" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Produtos</p>
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-3">
            7 módulos, uma única plataforma
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            Cada módulo resolve um problema específico. Juntos, transformam seu WhatsApp em uma máquina de vendas e atendimento de classe mundial.
          </p>
        </div>

        {/* Tabs com logos */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {PRODUCTS.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setActive(i)}
              className={`rounded-lg transition-all duration-200 px-2.5 py-1.5 ${
                active === i
                  ? 'bg-white border-2 border-primary-500 shadow-md shadow-primary-500/15'
                  : 'bg-gray-100 border-2 border-transparent hover:bg-gray-50 hover:border-gray-200'
              }`}
            >
              <ProductTabLogo id={p.id} />
            </button>
          ))}
        </div>

        {/* Conteúdo do produto ativo */}
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div>
            {/* Logo completo com subtitle */}
            <div className="mb-5">
              <ProductFullLogo id={product.id} />
            </div>

            <p className="text-gray-500 mb-6 leading-relaxed">{product.desc}</p>

            <ul className="space-y-2.5 mb-8">
              {product.bullets.map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm text-gray-600">
                  <CheckCircle2 size={16} className="text-secondary-500 flex-shrink-0 mt-0.5" />
                  {b}
                </li>
              ))}
            </ul>

            {/* Métricas */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {product.metrics.map((m) => (
                <div key={m.label} className="bg-primary-50 rounded-xl p-3 text-center border border-primary-100">
                  <p className="text-xl font-extrabold text-primary-600">{m.value}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>

            {/* Case Study */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex">
                  {[...Array(5)].map((_, i) => <Star key={i} size={12} className="text-yellow-400 fill-yellow-400" />)}
                </div>
                <span className="text-[10px] text-gray-400">Case real — {product.caseStudy.segment}</span>
              </div>
              <p className="text-sm text-gray-700 italic leading-relaxed mb-3">"{product.caseStudy.quote}"</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{product.caseStudy.author}</p>
                  <p className="text-xs text-gray-500">{product.caseStudy.role} — {product.caseStudy.business}</p>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  {product.caseStudy.results.map((r) => (
                    <span key={r} className="text-[9px] font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-100">{r}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Preview / Mockup */}
          <div className="bg-gradient-to-br from-gray-50 to-primary-50/30 rounded-2xl border border-gray-200 p-6">
            <div className="mb-4">
              <ProductTabLogo id={product.id} />
            </div>
            {MOCKUPS[product.mockup]}
          </div>
        </div>
      </div>
    </section>
  );
}
