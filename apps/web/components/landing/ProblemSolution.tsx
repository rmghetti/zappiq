'use client';

import { useState } from 'react';
import { MessageSquareOff, Users, EyeOff, TrendingDown, ArrowDown, X, CheckCircle2, BarChart3, MessageCircle, Clock, Zap } from 'lucide-react';

const problems = [
  {
    icon: MessageSquareOff,
    title: 'Mensagens sem resposta',
    desc: '60% dos clientes desistem se não recebem resposta em 1 hora',
    details: {
      problem: 'Estudos mostram que 60% dos consumidores desistem da compra quando não recebem resposta em até 1 hora. À noite, fins de semana e feriados, seu WhatsApp fica mudo — e seus concorrentes ficam ativos.',
      examples: [
        'Cliente manda mensagem às 22h pedindo orçamento — fica sem resposta até 9h do dia seguinte',
        'Leads de campanhas no Instagram chegam no WhatsApp e ninguém responde a tempo',
        'Clientes recorrentes pedem informações simples e esperam horas por uma resposta'
      ],
      solution: 'O Pulse AI responde instantaneamente 24/7, com linguagem natural e personalizada para o seu negócio. Respostas em menos de 3 segundos, a qualquer hora.',
      metric: '89% de redução no tempo médio de resposta'
    }
  },
  {
    icon: Users,
    title: 'Time sobrecarregado',
    desc: 'Seus atendentes copiam e colam as mesmas respostas 50 vezes por dia',
    details: {
      problem: 'Seus atendentes gastam 70% do tempo respondendo perguntas repetitivas sobre preço, horário, localização e formas de pagamento. Isso gera frustração, erros e alta rotatividade.',
      examples: [
        'Atendente copia e cola a mesma tabela de preços 40 vezes por dia',
        'Erros de digitação e informações desatualizadas são enviadas para clientes',
        'Atendentes não conseguem dar atenção personalizada por estarem sobrecarregados'
      ],
      solution: 'A IA cuida automaticamente de 80% das perguntas rotineiras. Sua equipe foca apenas em negociações complexas e atendimentos que realmente precisam do toque humano.',
      metric: '12h/semana economizadas por atendente'
    }
  },
  {
    icon: EyeOff,
    title: 'Zero visibilidade',
    desc: 'Você não sabe quantas vendas seu WhatsApp gera ou quantos leads são perdidos',
    details: {
      problem: 'Sem métricas, você opera no escuro. Não sabe qual atendente vende mais, qual horário tem mais demanda, qual campanha traz resultado ou quantos leads são perdidos por falta de follow-up.',
      examples: [
        'Impossível saber quantas vendas foram feitas via WhatsApp no mês',
        'Nenhum controle sobre taxa de conversão ou tempo de resposta da equipe',
        'Leads entram e somem sem nenhum acompanhamento sistemático'
      ],
      solution: 'O Radar Insights oferece dashboards completos com métricas de conversão, performance por agente, análise de sentimento e receita gerada — tudo em tempo real.',
      metric: '3x mais conversões com dados acionáveis'
    }
  },
  {
    icon: TrendingDown,
    title: 'Escala manual',
    desc: 'Para crescer, você precisa contratar mais gente em vez de ser mais inteligente',
    details: {
      problem: 'Cada vez que a demanda cresce, a solução é contratar mais atendentes. Isso aumenta custos, complexidade de gestão e não garante qualidade consistente.',
      examples: [
        'Black Friday chega e você precisa contratar 5 temporários que não conhecem o produto',
        'Crescimento de 50% em leads requer 50% mais atendentes',
        'Treinamento de novos atendentes leva semanas e a qualidade varia muito'
      ],
      solution: 'Com ZappIQ, sua IA escala infinitamente sem custo adicional. Atenda 10 ou 10.000 conversas simultâneas com a mesma qualidade e consistência.',
      metric: '10x mais atendimentos sem contratar'
    }
  },
];

function ProblemModal({ problem, onClose }: { problem: typeof problems[0]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                <problem.icon size={24} className="text-red-500" />
              </div>
              <h3 className="font-display text-xl font-bold text-gray-900">{problem.title}</h3>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400" /></button>
          </div>

          <div className="space-y-5">
            <div>
              <h4 className="text-sm font-semibold text-red-600 uppercase tracking-wide mb-2">O Problema</h4>
              <p className="text-sm text-gray-600 leading-relaxed">{problem.details.problem}</p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-2">Exemplos reais</h4>
              <ul className="space-y-2">
                {problem.details.examples.map((ex, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] text-red-500 font-bold">{i + 1}</span>
                    {ex}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-primary-50 rounded-xl p-4 border border-primary-100">
              <h4 className="text-sm font-semibold text-primary-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Zap size={14} /> Como o ZappIQ resolve
              </h4>
              <p className="text-sm text-primary-800 leading-relaxed">{problem.details.solution}</p>
            </div>

            <div className="bg-gradient-to-r from-primary-500 to-secondary-500 rounded-xl p-4 text-center">
              <p className="text-white font-bold text-lg">{problem.details.metric}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProblemSolution() {
  const [selectedProblem, setSelectedProblem] = useState<number | null>(null);

  return (
    <section className="py-20 lg:py-28 bg-[#F8FAF9]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-4">
            Seu WhatsApp está <span className="text-red-500">custando vendas</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto mb-12">
          {problems.map((p, i) => (
            <button key={p.title} onClick={() => setSelectedProblem(i)}
              className="bg-white rounded-xl border border-gray-200 p-6 flex gap-4 hover:shadow-lg hover:border-red-200 transition-all text-left group cursor-pointer">
              <div className="w-11 h-11 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-red-100 transition-colors">
                <p.icon size={20} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">{p.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{p.desc}</p>
                <p className="text-xs text-primary-500 font-medium mt-2">Clique para saber mais →</p>
              </div>
            </button>
          ))}
        </div>

        <div className="text-center mb-12">
          <ArrowDown size={32} className="mx-auto text-primary-400 mb-4 animate-bounce" />
          <p className="text-lg font-semibold text-primary-600 bg-primary-50 inline-block px-6 py-3 rounded-full">
            ZappIQ resolve tudo isso em uma única plataforma
          </p>
        </div>

        {/* Dashboard Mockup */}
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            {/* Browser bar */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-gray-400 border border-gray-200 text-center">app.zappiq.com.br/dashboard</div>
            </div>

            <div className="p-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Conversas Hoje', value: '247', change: '+23%', color: 'text-primary-600' },
                  { label: 'Taxa de Automação', value: '89%', change: '+4%', color: 'text-secondary-500' },
                  { label: 'CSAT Médio', value: '4.8', change: '+0.3', color: 'text-yellow-500' },
                  { label: 'Receita WhatsApp', value: 'R$18.4k', change: '+31%', color: 'text-primary-600' },
                ].map((kpi) => (
                  <div key={kpi.label} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1">{kpi.label}</p>
                    <p className={`text-xl font-extrabold ${kpi.color}`}>{kpi.value}</p>
                    <p className="text-[10px] text-green-500 font-semibold mt-0.5">▲ {kpi.change}</p>
                  </div>
                ))}
              </div>

              {/* Chart + Conversations */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-700 mb-3">Volume de conversas — últimos 7 dias</p>
                  <div className="flex items-end gap-2 h-24">
                    {[45, 62, 55, 78, 92, 85, 100].map((h, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full rounded-t-md" style={{ height: `${h}%`, background: i === 6 ? 'linear-gradient(180deg, #1B6B3A, #25D366)' : 'rgba(27,107,58,0.15)' }} />
                        <span className="text-[8px] text-gray-400">{['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'][i]}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-700 mb-3">Últimas conversas</p>
                  {[
                    { name: 'Ana L.', msg: 'Agendamento confirmado', tag: 'IA' },
                    { name: 'Carlos S.', msg: 'Pedido de orçamento', tag: 'Novo' },
                    { name: 'Maria O.', msg: 'Finalizado com sucesso', tag: 'Fechado' },
                  ].map((c, i) => (
                    <div key={i} className="flex items-center gap-2 py-2 border-b border-gray-100 last:border-0">
                      <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-[8px] font-bold text-primary-600">{c.name[0]}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold text-gray-800 truncate">{c.name}</p>
                        <p className="text-[9px] text-gray-400 truncate">{c.msg}</p>
                      </div>
                      <span className="text-[8px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">{c.tag}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedProblem !== null && (
        <ProblemModal problem={problems[selectedProblem]} onClose={() => setSelectedProblem(null)} />
      )}
    </section>
  );
}
