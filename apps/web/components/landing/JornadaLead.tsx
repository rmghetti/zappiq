/* ══════════════════════════════════════════════════════════════════════════
 * JornadaLead: a narrativa de ponta a ponta (V6 reposicionamento)
 * --------------------------------------------------------------------------
 * O coração do reposicionamento: os produtos não são peças soltas, são uma
 * operação só. Do anúncio à receita, sem o dono tocar. Cada passo destaca o
 * produto (nome do Dash) que age naquele momento.
 * ══════════════════════════════════════════════════════════════════════════ */

import { MessageCircle, Users, CalendarCheck, TrendingUp, Megaphone, Activity } from 'lucide-react';

const STEPS = [
  { icon: MessageCircle, tag: 'Iza', title: 'Chega o lead', desc: 'Um clique no anúncio do Instagram vira uma DM. A Iza responde em segundos, em texto ou áudio, na voz da sua marca.' },
  { icon: Users, tag: 'CRM', title: 'O CRM enche sozinho', desc: 'Enquanto conversa, a IA já cria o contato, marca o estágio do funil e dá o lead score. Você não digitou nada.' },
  { icon: CalendarCheck, tag: 'Maestro e Agenda', title: 'A IA qualifica e agenda', desc: 'A Iza qualifica pelo fluxo que o Maestro montou e marca na agenda, checando o horário real, sem alucinar.' },
  { icon: TrendingUp, tag: 'Atribuição de vendas', title: 'A venda fecha e vira número', desc: 'O negócio fecha e a receita que passou pela Iza é creditada a ela. No fim do mês você vê, em reais, quanto a IA vendeu.' },
  { icon: Megaphone, tag: 'Zap Impulso', title: 'A base volta a comprar', desc: 'Você diz ao Zap Impulso "reativar quem parou há 60 dias". A campanha sai pronta, dispara, e quem responde volta pro atendimento da Iza.' },
  { icon: Activity, tag: 'Analytics e Qualidade da IA', title: 'A operação se explica e se corrige', desc: 'Todo dia o Pulso conta o que aconteceu. Quando a IA desvia do script, ele sugere o ajuste, você aprova, e a plataforma comprova em minutos.' },
];

export function JornadaLead() {
  return (
    <section className="py-20 lg:py-28">
      <div className="zappiq-wrap">
        <div className="text-center max-w-[720px] mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-soft border border-line text-[12px] text-muted mb-5">
            <span className="w-2 h-2 rounded-full bg-grad" />
            A jornada de um lead
          </div>
          <h2 className="text-[32px] sm:text-[40px] lg:text-[46px] leading-[1.05] tracking-[-0.03em] font-semibold text-ink mb-5">
            Do anúncio à receita, <span className="text-grad">sem você tocar.</span>
          </h2>
          <p className="text-[17px] lg:text-[18px] text-muted leading-[1.55]">
            Os produtos não são peças soltas. São uma operação só, com um cérebro só e uma aprovação só.
          </p>
        </div>

        <div className="relative max-w-[760px] mx-auto">
          <div className="absolute left-[27px] top-6 bottom-6 w-px bg-line hidden sm:block" aria-hidden />
          <div className="flex flex-col gap-5">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="relative flex gap-5 items-start">
                  <div
                    className="relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#2FB57A,#2F7FB5,#4A52D0)' }}
                  >
                    <Icon size={22} strokeWidth={2} aria-hidden />
                  </div>
                  <div className="bg-white border border-line rounded-[18px] p-5 flex-1 shadow-[var(--shadow-card)]">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">{s.tag}</span>
                      <span className="text-[11px] text-muted">Passo {i + 1}</span>
                    </div>
                    <h3 className="text-[18px] font-semibold text-ink mb-1.5 tracking-[-0.01em]">{s.title}</h3>
                    <p className="text-[14.5px] text-muted leading-[1.6]">{s.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-center text-[17px] text-ink font-medium max-w-[620px] mx-auto mt-12 leading-[1.5]">
          Um cérebro, uma aprovação, uma operação. O concorrente entrega uma peça e deixa você integrar o resto. A ZappIQ entrega a operação inteira já costurada.
        </p>
      </div>
    </section>
  );
}
