'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * PlataformaAutonoma: o destaque do "trio de autonomia" (V6 reposicionamento)
 * --------------------------------------------------------------------------
 * Mostra o que separa a ZappIQ de um chatbot: a IA trabalha sozinha de ponta
 * a ponta. Três produtos-bandeira onde a inteligência executa, e o cliente
 * apenas aprova: Maestro (monta o fluxo), Zap Impulso (cria a campanha),
 * Qualidade da IA (se corrige). Nomes conforme o Dash.
 * ══════════════════════════════════════════════════════════════════════════ */

import Link from 'next/link';
import { GitBranch, Megaphone, Gauge } from 'lucide-react';

const PRODUTOS = [
  {
    icon: GitBranch,
    verb: 'A IA monta o fluxo',
    name: 'Maestro',
    desc: 'Você diz o objetivo e a Iza desenha o fluxo de atendimento inteiro no canvas, a partir do seu negócio. Você vê, ajusta e aprova. Sem consultor, sem tela em branco.',
    proof: 'Do zero ao fluxo pronto numa tarde.',
  },
  {
    icon: Megaphone,
    verb: 'A IA cria a campanha',
    name: 'Zap Impulso',
    desc: 'Escreva "reativar quem não compra há 60 dias" e a IA monta a campanha inteira: público, copy na sua voz, horário e verba. Dispara pela API oficial, e quem responde cai no atendimento da Iza.',
    proof: 'Um objetivo em português vira campanha pronta.',
  },
  {
    icon: Gauge,
    verb: 'A IA se corrige',
    name: 'Qualidade da IA',
    desc: 'A plataforma testa a Iza, detecta desvio, dá o score e sugere a correção. Você aprova e ela comprova o ajuste em minutos, com trilha de auditoria. A IA melhora sozinha, você no comando.',
    proof: 'Do desvio à correção aprovada em cerca de 3 minutos.',
  },
];

export function PlataformaAutonoma() {
  return (
    <section id="plataforma-autonoma" className="py-20 lg:py-28 bg-bg-soft">
      <div className="zappiq-wrap">
        <div className="text-center max-w-[730px] mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-line text-[12px] text-muted mb-5">
            <span className="w-2 h-2 rounded-full bg-grad" />
            A plataforma trabalha sozinha
          </div>
          <h2 className="text-[32px] sm:text-[40px] lg:text-[46px] leading-[1.05] tracking-[-0.03em] font-semibold text-ink mb-5">
            A IA não só atende. Ela <span className="text-grad">monta, dispara e se corrige</span> sozinha.
          </h2>
          <p className="text-[17px] lg:text-[18px] text-muted leading-[1.55]">
            O que separa a ZappIQ de um chatbot: três produtos onde a inteligência trabalha por você de ponta a ponta. Você aprova, ela executa.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 lg:gap-6">
          {PRODUTOS.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.name}
                className="relative bg-white border border-line rounded-[20px] p-7 flex flex-col shadow-[var(--shadow-card)] transition-transform duration-300 hover:-translate-y-1"
              >
                <div
                  className="w-12 h-12 rounded-[14px] flex items-center justify-center mb-5 text-white"
                  style={{ background: 'linear-gradient(135deg,#2FB57A,#2F7FB5,#4A52D0)' }}
                >
                  <Icon size={22} strokeWidth={2} aria-hidden />
                </div>
                <div className="text-[12.5px] font-semibold uppercase tracking-wider text-accent mb-1.5">
                  {p.verb}
                </div>
                <h3 className="text-[22px] font-semibold text-ink mb-3 tracking-[-0.02em]">{p.name}</h3>
                <p className="text-[15px] text-muted leading-[1.6] flex-1">{p.desc}</p>
                <div className="mt-5 pt-4 border-t border-line text-[14px] font-medium text-ink">
                  {p.proof}
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-12">
          <Link href="/cadastro" className="btn btn-accent btn-lg">
            Montar minha operação autônoma <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
