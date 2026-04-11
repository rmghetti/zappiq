'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Heart, ShoppingBag, Briefcase, BookOpen, Car, Home, Dog, Scissors, UtensilsCrossed, Dumbbell, Scale, Calculator, Brain, Apple, Smile, Globe, X, Zap, CheckCircle2, ArrowRight } from 'lucide-react';

// Segmentos que possuem landing page dedicada
const SEGMENT_PAGES: Record<string, string> = {
  'Sa��de': '/segmentos/saude',
  'Varejo': '/segmentos/varejo',
  'Serviços B2B': '/segmentos/servicos-b2b',
  'Educação': '/segmentos/educacao',
};

const SEGMENTS = [
  { icon: Heart, name: 'Saúde', desc: 'Agendamento automático, lembretes e recall', metric: '-65% em faltas', color: 'bg-red-50 text-red-500',
    details: { problems: ['Pacientes faltam em consultas sem avisar', 'Recepcionista gasta horas confirmando agenda', 'Recall de pacientes inativos é manual e inconsistente'],
      solution: 'O Pulse AI agenda consultas, envia lembretes automáticos 24h antes, confirma presença e faz recall de pacientes que não retornam há mais de 6 meses.',
      results: ['65% menos faltas com lembretes automáticos', '3x mais pacientes reagendados via recall', 'Recepcionista focada no atendimento presencial'] }},
  { icon: ShoppingBag, name: 'Varejo', desc: 'Recuperação de carrinhos e campanhas segmentadas', metric: '+35% conversões', color: 'bg-purple-50 text-purple-500',
    details: { problems: ['Carrinhos abandonados sem follow-up', 'Promoções enviadas para base inteira sem segmentação', 'Sem controle de estoque na conversa'],
      solution: 'Spark Campaigns recupera carrinhos automaticamente, segmenta campanhas por perfil de compra e o Pulse AI consulta estoque em tempo real durante a conversa.',
      results: ['35% mais conversões com recuperação de carrinho', 'R$12k/mês em vendas recuperadas automaticamente', '4x mais ROI em campanhas segmentadas'] }},
  { icon: Briefcase, name: 'Serviços B2B', desc: 'Qualificação automática e follow-up', metric: '+25% fechamentos', color: 'bg-blue-50 text-blue-500',
    details: { problems: ['Leads chegam e ficam sem qualificação', 'Follow-up manual é esquecido frequentemente', 'Propostas demoram dias para serem enviadas'],
      solution: 'Nexus CRM qualifica leads automaticamente por lead scoring, programa follow-ups e o Pulse AI gera propostas personalizadas em minutos.',
      results: ['25% mais fechamentos com follow-up automatizado', '80% dos leads qualificados em até 5 minutos', 'Propostas geradas em 2 minutos vs 2 dias'] }},
  { icon: BookOpen, name: 'Educação', desc: 'Matrículas, avisos e comunicação escolar', metric: '+55% matrículas', color: 'bg-yellow-50 text-yellow-600',
    details: { problems: ['Processo de matrícula burocrático e lento', 'Comunicados escolares não chegam aos pais', 'Período de rematrícula com sobrecarga na secretaria'],
      solution: 'Automatize matrículas pelo WhatsApp, envie comunicados com confirmação de leitura e gerencie rematrículas com campanhas segmentadas por turma.',
      results: ['55% mais matrículas no período de captação', '98% de taxa de leitura em comunicados', 'Secretaria com 70% menos ligações'] }},
  { icon: Car, name: 'Automotivo', desc: 'Orçamentos e revisões periódicas', metric: '+40% agendamentos', color: 'bg-green-50 text-green-600',
    details: { problems: ['Clientes pedem orçamento e não recebem resposta rápida', 'Revisões periódicas são esquecidas', 'Sem follow-up pós-serviço'],
      solution: 'O Pulse AI gera orçamentos instantâneos baseados no catálogo de serviços, agenda revisões automaticamente e faz follow-up pós-serviço com pesquisa de satisfação.',
      results: ['40% mais agendamentos com orçamentos instantâneos', 'Revisões periódicas nunca mais esquecidas', 'CSAT de 4.7 com follow-up automático'] }},
  { icon: Home, name: 'Imobiliárias', desc: 'Qualificação de leads e agendamento de visitas', metric: '+30% visitas', color: 'bg-indigo-50 text-indigo-500',
    details: { problems: ['Leads de portais chegam e esfriam sem contato rápido', 'Corretor não consegue atender todos ao mesmo tempo', 'Agendamento de visitas é caótico'],
      solution: 'Pulse AI qualifica leads instantaneamente, filtra por perfil do imóvel, agenda visitas automaticamente e encaminha para o corretor com o briefing completo.',
      results: ['30% mais visitas agendadas', 'Tempo de primeiro contato de 4h para 30 segundos', 'Corretores atendem apenas leads quentes'] }},
  { icon: Dog, name: 'Pet Shop', desc: 'Agendamento de banho e tosa, vacinas', metric: '+45% agendamentos', color: 'bg-orange-50 text-orange-500',
    details: { problems: ['Clientes ligam para agendar e a linha está ocupada', 'Controle de vacinas e vermífugos é manual', 'Sem programa de fidelidade eficiente'],
      solution: 'Agendamento online 24h via WhatsApp, lembretes automáticos de vacinas e vermífugos, programa de fidelidade com pontos e ofertas personalizadas.',
      results: ['45% mais agendamentos com IA 24h', 'Recall de vacinas com 90% de adesão', '3x mais vendas com ofertas personalizadas'] }},
  { icon: Scissors, name: 'Salão de Beleza', desc: 'Agendamento e confirmação automática', metric: '-50% no-shows', color: 'bg-pink-50 text-pink-500',
    details: { problems: ['Clientes marcam e não aparecem', 'Agenda confusa com conflitos de horário', 'Sem remarketing para clientes inativos'],
      solution: 'Sistema de agendamento inteligente com confirmação automática 24h antes, lista de espera automática e campanhas de reativação para clientes que sumiram.',
      results: ['50% menos no-shows com confirmação automática', 'Ocupação da agenda subiu de 60% para 90%', '25% dos inativos voltaram com campanhas'] }},
  { icon: UtensilsCrossed, name: 'Restaurante', desc: 'Reservas, cardápio e delivery', metric: '+40% reservas', color: 'bg-amber-50 text-amber-600',
    details: { problems: ['Reservas por telefone são perdidas em horário de pico', 'Perguntas repetitivas sobre cardápio e horários', 'Sem controle de filas de espera'],
      solution: 'Reservas automáticas via WhatsApp, cardápio interativo com fotos e preços, fila de espera digital com estimativa de tempo e notificação quando a mesa está pronta.',
      results: ['40% mais reservas com atendimento 24h', 'Redução de 80% em perguntas repetitivas', 'Tempo de espera percebido caiu 60%'] }},
  { icon: Dumbbell, name: 'Academia', desc: 'Matrículas, agenda de aulas e retenção', metric: '+35% retenção', color: 'bg-emerald-50 text-emerald-500',
    details: { problems: ['Alta taxa de cancelamento nos primeiros 3 meses', 'Alunos não sabem dos horários de aulas', 'Sem comunicação proativa com alunos ausentes'],
      solution: 'Onboarding automático para novos alunos, grade de aulas sempre atualizada no WhatsApp, alertas para alunos que não frequentam há mais de 7 dias.',
      results: ['35% mais retenção nos primeiros 90 dias', 'Grade de aulas consultada 5x mais que app', 'Recuperação de 40% dos alunos ausentes'] }},
  { icon: Scale, name: 'Advocacia', desc: 'Qualificação e acompanhamento processual', metric: '+30% clientes', color: 'bg-slate-50 text-slate-600',
    details: { problems: ['Leads entram sem triagem de área de atuação', 'Clientes ligam pedindo atualização de processo', 'Contratos e documentos demoram para serem enviados'],
      solution: 'Triagem automática por área do direito, notificações proativas sobre andamento processual e envio automatizado de documentos e contratos para assinatura.',
      results: ['30% mais clientes com qualificação automática', '90% menos ligações sobre andamento', 'Contratos enviados em minutos vs dias'] }},
  { icon: Calculator, name: 'Contabilidade', desc: 'Coleta de documentos e comunicação', metric: '-60% atrasos', color: 'bg-cyan-50 text-cyan-500',
    details: { problems: ['Clientes atrasam envio de documentos fiscais', 'Dúvidas repetitivas sobre impostos e prazos', 'Comunicação com muitos clientes simultaneamente'],
      solution: 'Lembretes automáticos para envio de documentos, FAQ inteligente sobre impostos e obrigações, e campanhas em massa sobre mudanças na legislação.',
      results: ['60% menos atrasos na entrega de documentos', '80% das dúvidas resolvidas pela IA', '5x mais clientes atendidos com mesma equipe'] }},
  { icon: Brain, name: 'Psicologia', desc: 'Agendamento, lembretes e acompanhamento', metric: '-55% faltas', color: 'bg-violet-50 text-violet-500',
    details: { problems: ['Pacientes faltam sem avisar e não reagendam', 'Dificuldade em manter acompanhamento entre sessões', 'Agenda manual gera conflitos'],
      solution: 'Agendamento online 24h, confirmação automática, lembretes gentis e mensagens de acompanhamento entre sessões programadas pelo profissional.',
      results: ['55% menos faltas com lembretes automáticos', 'Pacientes 2x mais engajados entre sessões', 'Agenda 100% digitalizada sem conflitos'] }},
  { icon: Apple, name: 'Nutrição', desc: 'Consultas, planos alimentares e follow-up', metric: '+40% adesão', color: 'bg-lime-50 text-lime-600',
    details: { problems: ['Pacientes abandonam o plano alimentar após poucas semanas', 'Sem acompanhamento entre consultas', 'Agendamento manual e lembretes por telefone'],
      solution: 'Envio automático de planos alimentares via WhatsApp, check-ins semanais com o paciente, lembretes de refeições e agendamento de retorno automatizado.',
      results: ['40% mais adesão ao plano alimentar', '3x mais retornos agendados automaticamente', 'Pacientes mais engajados e satisfeitos'] }},
  { icon: Smile, name: 'Odontologia', desc: 'Agendamento, recall e orçamentos', metric: '-60% faltas', color: 'bg-sky-50 text-sky-500',
    details: { problems: ['Alto índice de faltas em consultas', 'Pacientes não retornam para manutenção semestral', 'Orçamentos demoram para serem enviados'],
      solution: 'Agendamento e confirmação automática, recall inteligente a cada 6 meses, envio de orçamentos instantâneos com opções de parcelamento.',
      results: ['60% menos faltas com confirmação automática', 'Recall com 45% de conversão', 'Orçamentos aprovados 3x mais rápido'] }},
  { icon: Globe, name: 'Agência Digital', desc: 'Atendimento de clientes e relatórios', metric: '+50% eficiência', color: 'bg-teal-50 text-teal-500',
    details: { problems: ['Clientes pedem status de projetos o tempo todo', 'Relatórios são enviados manualmente', 'Muitas reuniões desnecessárias para alinhamento'],
      solution: 'Status automático de projetos via WhatsApp, relatórios de performance enviados automaticamente e gestão de aprovações via chat.',
      results: ['50% mais eficiência operacional', '70% menos reuniões de alinhamento', 'Clientes 3x mais satisfeitos com transparência'] }},
];

function SegmentModal({ segment, onClose }: { segment: typeof SEGMENTS[0]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl ${segment.color} flex items-center justify-center`}>
                <segment.icon size={24} />
              </div>
              <div>
                <h3 className="font-display text-xl font-bold text-gray-900">{segment.name}</h3>
                <p className="text-sm text-gray-500">{segment.desc}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400" /></button>
          </div>

          <div className="space-y-5">
            <div>
              <h4 className="text-sm font-semibold text-red-600 uppercase tracking-wide mb-2">Problemas comuns</h4>
              <ul className="space-y-2">
                {segment.details.problems.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-red-500 font-bold">{i+1}</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-primary-50 rounded-xl p-4 border border-primary-100">
              <h4 className="text-sm font-semibold text-primary-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Zap size={14} /> Como o ZappIQ resolve
              </h4>
              <p className="text-sm text-primary-800 leading-relaxed">{segment.details.solution}</p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-2">Resultados esperados</h4>
              <ul className="space-y-2">
                {segment.details.results.map((r, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle2 size={16} className="text-secondary-500 flex-shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-gradient-to-r from-primary-500 to-secondary-500 rounded-xl p-4 text-center">
              <p className="text-white font-bold text-lg">{segment.metric}</p>
              <p className="text-white/80 text-xs">Resultado médio dos clientes ZappIQ neste segmento</p>
            </div>

            {SEGMENT_PAGES[segment.name] && (
              <Link href={SEGMENT_PAGES[segment.name]} onClick={onClose}
                className="flex items-center justify-center gap-2 w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 rounded-xl transition-colors text-sm mt-2">
                Ver página completa <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Segments() {
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);

  return (
    <section id="segmentos" className="py-20 lg:py-28 bg-[#F8FAF9]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Segmentos</p>
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900">Feito para o seu tipo de negócio</h2>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto">Clique em um segmento para ver como o ZappIQ resolve os problemas específicos do seu setor</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
          {SEGMENTS.map((s, i) => (
            <button key={s.name} onClick={() => setSelectedSegment(i)}
              className="bg-white rounded-xl border border-gray-200 p-5 text-center hover:shadow-lg hover:-translate-y-1 hover:border-primary-200 transition-all cursor-pointer group">
              <div className={`w-12 h-12 rounded-xl ${s.color} flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform`}>
                <s.icon size={22} />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1 text-sm">{s.name}</h3>
              <p className="text-[11px] text-gray-500 mb-2 leading-relaxed">{s.desc}</p>
              <p className="text-[11px] font-bold text-primary-600 bg-primary-50 inline-block px-2.5 py-1 rounded-full">{s.metric}</p>
            </button>
          ))}
        </div>
      </div>

      {selectedSegment !== null && (
        <SegmentModal segment={SEGMENTS[selectedSegment]} onClose={() => setSelectedSegment(null)} />
      )}
    </section>
  );
}
