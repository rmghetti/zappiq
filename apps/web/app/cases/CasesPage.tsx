'use client';

import Link from 'next/link';
import { ArrowRight, Star } from 'lucide-react';
import { PublicLayout } from '../../components/landing/PublicLayout';

/* PLACEHOLDER: substituir todos os cases por dados reais de clientes */
const CASES = [
  {
    id: 'clinica-vida-plena',
    company: 'Clínica Vida Plena',
    initials: 'VP',
    segment: 'Saúde',
    quote: { text: 'A ZappIQ mudou completamente a forma como atendemos pacientes. Antes, perdíamos 30% dos agendamentos.', author: 'Dra. Camila Ferreira', role: 'Diretora Clínica' },
    challenge: 'A Clínica Vida Plena atendia 200 pacientes por semana com uma equipe de recepção de 3 pessoas. O tempo médio de resposta no WhatsApp era de 4 horas — muitos pacientes desistiam e iam para outros consultórios. A taxa de no-show era de 28%, gerando um prejuízo estimado de R$15.000 mensais em horários vazios.',
    solution: 'Implementaram o ZappIQ Core para centralizar mensagens, o Pulse AI para agendamento automático, e o Spark Campaigns para lembretes de consulta. O Pulse AI foi treinado com o catálogo de especialidades, horários, convênios aceitos e protocolos de preparo para exames.',
    metrics: [
      { value: '+250%', label: 'leads qualificados' },
      { value: '-70%', label: 'tempo de resposta' },
      { value: '8%', label: 'taxa de no-show (era 28%)' },
      { value: '4.9', label: 'CSAT de pacientes' },
    ],
  },
  {
    id: 'trendmix-moda',
    company: 'TrendMix Moda',
    initials: 'TM',
    segment: 'Varejo',
    quote: { text: 'O Pulse AI vende de madrugada. Acordo de manhã e já tem pedidos fechados automaticamente.', author: 'Ricardo Mendes', role: 'CEO' },
    challenge: 'A TrendMix recebia 300+ mensagens por dia no WhatsApp — principalmente perguntas sobre tamanhos, disponibilidade e frete. Com apenas 2 atendentes, o tempo de resposta passava de 2 horas. Carrinhos abandonados representavam 45% das vendas potenciais perdidas.',
    solution: 'Ativaram o Pulse AI como vendedor 24/7, integrado com o catálogo de produtos. O Forge Studio automatizou fluxos de recuperação de carrinho e pós-venda. O Spark Campaigns gerencia promoções semanais para base segmentada.',
    metrics: [
      { value: '+35%', label: 'vendas pelo WhatsApp' },
      { value: '23%', label: 'carrinhos recuperados' },
      { value: 'R$48k', label: 'receita adicional/mês' },
      { value: '30s', label: 'tempo médio de resposta' },
    ],
  },
  {
    id: 'autotech-oficina',
    company: 'AutoTech Oficina',
    initials: 'AT',
    segment: 'Automotivo',
    quote: { text: 'Recuperei 3 horas do meu dia. Agora posso focar na oficina em vez de ficar respondendo WhatsApp.', author: 'Marcos Almeida', role: 'Proprietário' },
    challenge: 'Marcos administrava sozinho a oficina e ainda respondia todas as mensagens do WhatsApp. Perdia tempo com perguntas sobre preços de revisão, horários disponíveis e status de serviços. Não tinha controle sobre quantos leads chegavam nem a taxa de conversão.',
    solution: 'O Pulse AI foi treinado para responder sobre serviços, preços e disponibilidade. O sistema agenda revisões automaticamente e envia atualizações de status do veículo. O Nexus CRM registra todo o histórico de cada cliente e veículo.',
    metrics: [
      { value: '-70%', label: 'tempo em atendimento manual' },
      { value: '+28%', label: 'taxa de retenção' },
      { value: '12h/sem', label: 'economizadas' },
      { value: '+R$8.2k', label: 'receita mensal adicional' },
    ],
  },
  {
    id: 'nexus-consultoria',
    company: 'Nexus Consultoria',
    initials: 'NC',
    segment: 'Serviços B2B',
    quote: { text: 'O ciclo de vendas caiu de 14 para 5 dias. A IA qualifica e meu time só foca nos leads prontos para fechar.', author: 'Fernanda Costa', role: 'Diretora Comercial' },
    challenge: 'A Nexus Consultoria recebia 50+ leads por semana via WhatsApp, mas 70% eram de baixa qualificação. O time comercial de 4 pessoas gastava 60% do tempo com leads que nunca fechariam, enquanto leads quentes esfriavam pela falta de follow-up rápido.',
    solution: 'Implementaram o Pulse AI com roteiro de qualificação BANT. O Forge Studio cria sequências automáticas de follow-up para cada estágio do funil. O Radar Insights monitora conversão por origem, tempo de ciclo e valor médio de contrato.',
    metrics: [
      { value: '2x', label: 'contratos fechados/mês' },
      { value: '-64%', label: 'ciclo de vendas' },
      { value: 'R$180k', label: 'receita em 6 meses' },
      { value: '80%', label: 'leads pré-qualificados pela IA' },
    ],
  },
  {
    id: 'escola-nova-era',
    company: 'Escola Nova Era',
    initials: 'NE',
    segment: 'Educação',
    quote: { text: 'Aumentamos as matrículas em 45%. A IA responde pais de madrugada e no fim de semana — exatamente quando eles pesquisam.', author: 'Prof. Ana Beatriz', role: 'Coordenadora' },
    challenge: 'A Escola Nova Era recebia 80% das perguntas de pais fora do horário comercial. A secretaria respondia no dia seguinte, mas muitos pais já tinham visitado outra escola. A taxa de conversão de lead para matrícula era de apenas 12%.',
    solution: 'O Pulse AI responde sobre turmas, valores, material e processo de matrícula 24/7. O Spark Campaigns envia lembretes de vencimento e comunicados para turmas. O sistema também detecta sinais de evasão e dispara mensagens de retenção.',
    metrics: [
      { value: '+45%', label: 'matrículas no semestre' },
      { value: '-40%', label: 'inadimplência' },
      { value: '4.8/5', label: 'CSAT dos pais' },
      { value: '4 min', label: 'configuração inicial' },
    ],
  },
];

export function CasesPage() {
  return (
    <PublicLayout>
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 mb-16">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Cases de Sucesso</p>
          <h1 className="font-display text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-5">
            Resultados reais de empresas reais
          </h1>
          <p className="text-lg text-gray-500">
            Descubra como empresas de diferentes segmentos estão usando ZappIQ para automatizar atendimento, aumentar vendas e reduzir custos.
          </p>
        </div>
      </div>

      {/* Cases */}
      <div className="max-w-5xl mx-auto px-6 space-y-16 pb-20">
        {CASES.map((c) => (
          <article key={c.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow">
            {/* Header do case */}
            <div className="bg-gradient-to-r from-primary-500 to-secondary-500 px-8 py-6 flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-white text-lg font-bold backdrop-blur-sm">
                {c.initials}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{c.company}</h2>
                <span className="text-sm text-white/70">{c.segment}</span>
              </div>
            </div>

            <div className="p-8">
              {/* O Desafio */}
              <div className="mb-8">
                <h3 className="font-display text-lg font-bold text-gray-900 mb-3">O Desafio</h3>
                <p className="text-gray-600 leading-relaxed">{c.challenge}</p>
              </div>

              {/* A Solução */}
              <div className="mb-8">
                <h3 className="font-display text-lg font-bold text-gray-900 mb-3">A Solução</h3>
                <p className="text-gray-600 leading-relaxed">{c.solution}</p>
              </div>

              {/* Resultados */}
              <div className="mb-8">
                <h3 className="font-display text-lg font-bold text-gray-900 mb-4">Os Resultados</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {c.metrics.map((m) => (
                    <div key={m.label} className="bg-primary-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-extrabold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">{m.value}</p>
                      <p className="text-xs text-gray-500 mt-1">{m.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quote */}
              <div className="bg-[#F8FAF9] rounded-xl p-6 flex items-start gap-4">
                <div className="text-4xl font-serif text-primary-200 leading-none">&ldquo;</div>
                <div>
                  <p className="text-gray-700 leading-relaxed italic mb-3">{c.quote.text}</p>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white text-[10px] font-bold">{c.initials}</div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{c.quote.author}</p>
                      <p className="text-xs text-gray-400">{c.quote.role}, {c.company}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* CTA */}
      <section className="py-20 bg-[#1A1A2E]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-white mb-5">
            Quero resultados como esses
          </h2>
          <p className="text-gray-400 mb-8">Comece gratuitamente e veja o impacto no seu negócio em dias.</p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-secondary-500 hover:bg-secondary-600 text-white font-semibold px-8 py-4 rounded-xl transition-colors shadow-lg shadow-secondary-500/30 text-base">
            Começar Grátis por 14 Dias <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
