'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * AgentQualityProactive: Seção Self-Healing (única no mundo)
 * --------------------------------------------------------------------------
 * Apresenta o diferencial competitivo da ZappIQ: a única plataforma
 * conversacional do mundo que (a) detecta sozinha desvios/alucinações
 * do agente, (b) sugere correção, (c) deixa humano aprovar/editar/recusar,
 * (d) grava no system prompt automaticamente.
 *
 * Layout: fundo branco · caixas com borda escura · crítico em vermelho.
 * Posição na LandingPage: entre ROICalculator e TrustAndCompliance.
 * ══════════════════════════════════════════════════════════════════════════ */

import Link from 'next/link';
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  User,
  AlertCircle,
  Edit3,
  Check,
  ArrowDownRight,
  Award,
} from 'lucide-react';

export function AgentQualityProactive() {
  return (
    <section id="agent-quality" className="py-20 lg:py-28 bg-white">
      <div className="zappiq-wrap">
        {/* ─── Header ─── */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          {/* Selo "Única no mundo": design profissional + harmônico
              Gradient dark da brand (ink → indigo deep) · Award icon · pulse luminoso · tracking generoso */}
          <div className="inline-flex items-center gap-2.5 mb-5">
            <span
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-[11px] font-semibold uppercase tracking-[0.16em] shadow-[0_8px_24px_-8px_rgba(74,82,208,0.45)]"
              style={{
                background: 'linear-gradient(135deg,#0F172A 0%,#1E1B4B 45%,#4C1D95 100%)',
              }}
            >
              <Award size={14} className="text-amber-300" strokeWidth={2.2} />
              <span className="relative">
                A IA que se corrige sozinha
                <span className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)] animate-pulse" />
              </span>
            </span>
          </div>
          <h2 className="text-[36px] lg:text-[44px] font-medium text-[#0F172A] leading-[1.08] tracking-[-0.025em] mb-4">
            A operação de atendimento que{' '}
            <span className="text-grad">aprende com os próprios erros</span>, e te avisa antes
            de você descobrir
          </h2>
          <p className="text-[15px] lg:text-[16.5px] text-[#475569] leading-relaxed">
            Na ZappIQ, a IA detecta sozinha os desvios e as alucinações do seu agente, sugere a
            correção e deixa <b className="text-[#0F172A]">você decidir</b> se aprova, edita ou
            recusa. Cada correção aprovada vira conhecimento: na próxima vez, o agente já
            responde do jeito certo, sozinho.
          </p>
        </div>

        {/* ─── Quadro principal (mock agent-quality) ─── */}
        <div className="max-w-5xl mx-auto bg-white border border-[#CBD5E1] rounded-2xl overflow-hidden shadow-[0_8px_32px_-12px_rgba(15,23,42,0.08)]">
          {/* Header do quadro */}
          <div className="px-5 lg:px-6 py-4 border-b border-[#CBD5E1] flex items-center gap-3 bg-[#F8FAFC]">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#4A52D0,#6B74E8)' }}
            >
              <ShieldCheck size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium text-[#0F172A]">
                Correções sugeridas pela IA · última execução
              </div>
              <div className="text-[12px] text-[#64748B]">
                Agente: Iza · Sorriso &amp; Cia · há 14 minutos
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-[#FEE2E2] text-[#991B1B] font-medium border border-[#FCA5A5] whitespace-nowrap">
              <AlertTriangle size={12} /> 3 desvios identificados
            </span>
          </div>

          {/* Grid 2x2 */}
          <div className="p-5 lg:p-6 grid md:grid-cols-2 gap-4 lg:gap-5">
            {/* Cliente perguntou */}
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#64748B] mb-1.5 flex items-center gap-1.5">
                <User size={13} /> Cliente perguntou
              </div>
              <div className="px-3.5 py-3 bg-white border border-[#CBD5E1] rounded-lg text-[13px] leading-[1.5] text-[#0F172A]">
                Vocês fazem clareamento dental? Quanto custa em média?
              </div>
            </div>

            {/* Iza respondeu (com problema) */}
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#991B1B] mb-1.5 flex items-center gap-1.5">
                <AlertCircle size={13} /> Iza respondeu
                <span className="ml-1 px-1.5 py-0.5 rounded bg-[#DC2626] text-white text-[10px] font-semibold">
                  desvio crítico
                </span>
              </div>
              <div className="px-3.5 py-3 bg-white border border-[#FCA5A5] rounded-lg text-[13px] leading-[1.5] text-[#0F172A]">
                Fazemos sim! O{' '}
                <span className="bg-[#FEE2E2] text-[#991B1B] px-1 py-0.5 rounded font-medium">
                  tratamento estético odontológico
                </span>{' '}
                tem valor sob consulta. Recomendamos avaliação para{' '}
                <span className="bg-[#FEE2E2] text-[#991B1B] px-1 py-0.5 rounded font-medium">
                  customização do protocolo terapêutico
                </span>
                .
              </div>
              <div className="text-[11px] text-[#475569] mt-1.5 leading-[1.5]">
                Iza detectou: <b className="text-[#991B1B]">2 termos técnicos</b> que diluem
                clareza + <b className="text-[#991B1B]">sem preço concreto</b> +{' '}
                <b className="text-[#991B1B]">sem CTA</b>. Score:{' '}
                <b className="text-[#991B1B]">62/100</b>.
              </div>
            </div>

            {/* Sugestão da plataforma */}
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#4A52D0] mb-1.5 flex items-center gap-1.5">
                <Sparkles size={13} /> Sugestão da plataforma ZappIQ
              </div>
              <div className="px-3.5 py-3 bg-white border border-[#AFA9EC] rounded-lg text-[13px] leading-[1.5] text-[#0F172A]">
                "Fazemos! Clareamento começa em <b>R$ 690</b> (sessão única) ou{' '}
                <b>R$ 1.290</b> (protocolo completo, 3 sessões). Avaliação inicial é{' '}
                <b>gratuita</b>. Quer agendar?"
              </div>
              <div className="text-[11px] text-[#534AB7] mt-1.5 leading-[1.5]">
                ↑ Linguagem natural · preço concreto · próximo passo claro
              </div>
            </div>

            {/* Edição humana */}
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#0F6E56] mb-1.5 flex items-center gap-1.5">
                <Edit3 size={13} /> Você editou · humano no controle
              </div>
              <div className="px-3.5 py-3 bg-white border-2 border-[#2FB57A] rounded-lg text-[13px] leading-[1.5] text-[#0F172A]">
                "Fazemos sim 😊 Clareamento começa em <b>R$ 690</b> (sessão única) ou{' '}
                <b>R$ 1.290</b> (protocolo de 3 sessões, resultado dura ~18 meses).{' '}
                <b>Avaliação grátis</b> com a Dra. Letícia. Quer agendar essa semana?"
              </div>
              <div className="text-[11px] text-[#0F6E56] mt-1.5 leading-[1.5]">
                ↑ Você adicionou emoji + nome da profissional + duração + CTA temporal
              </div>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="px-5 lg:px-6 pb-5 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              className="flex-1 py-2.5 px-4 bg-[#0F6E56] hover:bg-[#085041] text-white rounded-lg text-[13px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <Check size={14} /> Aplicar sugestão editada
            </button>
            <button
              type="button"
              className="py-2.5 px-4 bg-white border border-[#CBD5E1] hover:bg-[#F8FAFC] rounded-lg text-[13px] font-medium text-[#475569] transition-colors"
            >
              Recusar
            </button>
          </div>

          {/* Footer com explicação */}
          <div className="px-5 lg:px-6 py-3.5 bg-[#F0FDF4] border-t border-[#BBF7D0] flex items-start gap-2.5">
            <ArrowDownRight size={16} className="text-[#0F6E56] mt-0.5 flex-shrink-0" />
            <div className="text-[12px] text-[#0F6E56] leading-[1.5]">
              Ao aplicar, esta versão é gravada no <b>system prompt</b> do seu agente. Da próxima
              vez que alguém perguntar sobre clareamento, a Iza responde do jeito que você
              aprovou, sem precisar de re-treinamento, sem custo de consultor, sem fricção.
            </div>
          </div>
        </div>

        {/* ─── Métricas de impacto ─── */}
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
          <div className="bg-white border border-[#CBD5E1] rounded-lg p-4">
            <div className="text-[28px] font-medium text-[#0F172A] leading-none">100%</div>
            <div className="text-[12px] text-[#475569] mt-1.5 leading-[1.4]">
              das respostas auditadas <b className="text-[#0F172A]">automaticamente</b>
            </div>
          </div>
          <div className="bg-white border border-[#CBD5E1] rounded-lg p-4">
            <div className="text-[28px] font-medium text-[#0F172A] leading-none">~3 min</div>
            <div className="text-[12px] text-[#475569] mt-1.5 leading-[1.4]">
              do desvio à correção <b className="text-[#0F172A]">em produção</b>
            </div>
          </div>
          <div className="bg-white border border-[#CBD5E1] rounded-lg p-4">
            <div className="text-[28px] font-medium text-[#0F172A] leading-none">R$ 0</div>
            <div className="text-[12px] text-[#475569] mt-1.5 leading-[1.4]">
              consultoria adicional · <b className="text-[#0F172A]">você no controle</b>
            </div>
          </div>
        </div>

        {/* ─── CTA band ─── */}
        <div
          className="max-w-5xl mx-auto mt-6 px-5 lg:px-6 py-4 lg:py-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          style={{
            background:
              'linear-gradient(135deg,#0F172A 0%,#1E1B4B 35%,#4C1D95 70%,#2FB57A 110%)',
          }}
        >
          <div className="text-white">
            <div className="text-[15px] font-medium mb-1">
              A IA se corrige sozinha. Você fica no comando.
            </div>
            <div className="text-[13px] opacity-85">
              Iza identifica · sugere · você decide · plataforma aprende. Loop fechado.
            </div>
          </div>
          <Link
            href="/cadastro"
            className="whitespace-nowrap px-5 py-2.5 bg-white text-[#1E1B4B] rounded-lg text-[13px] font-semibold hover:bg-white/95 transition-colors"
          >
            Testar 14 dias →
          </Link>
        </div>
      </div>
    </section>
  );
}
