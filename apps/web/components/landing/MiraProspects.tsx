'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * MiraProspects: destaque do add-on Mira Prospects (V6 reposicionamento)
 * --------------------------------------------------------------------------
 * Estende a operação autônoma para o topo do funil: a plataforma não só
 * atende, vende e faz campanha, agora também ENCONTRA quem está pronto para
 * comprar. Mira Prospects = inteligência de oportunidades dentro da ZappIQ.
 * Fonte: docs/09-descritivo-produto.md (Mira Prospects v1.0).
 * Destaque reforçado (12/07/2026, decisão do fundador): badge sólido no
 * padrão "flagship" (mesma linguagem visual do selo Qualidade da IA), passo
 * a passo de como funciona e a primeira abordagem sugerida no mock, pra
 * deixar claro que Mira Prospects é um pilar da operação, não um extra.
 * ══════════════════════════════════════════════════════════════════════════ */

import Link from 'next/link';
import { Target, Gauge, Search, ShieldCheck, MessageSquareText } from 'lucide-react';

const FEATURES = [
  { icon: Target, title: 'Alvos, não listas frias', desc: 'Cada oportunidade vem com um dossiê: quem decide, a demanda de agora, por que abordar e a primeira mensagem pronta.' },
  { icon: Gauge, title: 'Mira Score explicável', desc: 'Uma nota de 0 a 100 que diz a prioridade e o porquê. Viva: o sinal desta semana pesa mais que o de seis meses atrás.' },
  { icon: Search, title: 'Dois motores, B2B e B2C', desc: 'Enriquece a sua carteira e descobre mercado novo, a partir do CNPJ da Receita e do Google Places.' },
  { icon: ShieldCheck, title: 'Fonte legal, LGPD no núcleo', desc: 'Só dado público e provedor licenciado, com origem por campo. Nunca lista comprada nem raspagem de rede social logada.' },
];

const PASSOS = [
  'Você define o perfil ideal de cliente',
  'A Mira cruza dados públicos e calcula o Score',
  'Você aprova e a Iza aborda no WhatsApp',
];

export function MiraProspects() {
  return (
    <section className="py-24 lg:py-32 bg-bg-soft">
      <div className="zappiq-wrap">
        <div className="grid lg:grid-cols-[1.02fr_.98fr] gap-12 lg:gap-16 items-center">
          {/* Copy */}
          <div>
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-[11px] font-semibold uppercase tracking-[0.14em] mb-5 shadow-[0_8px_20px_-8px_rgba(74,82,208,0.4)]"
              style={{ background: 'linear-gradient(135deg,#2FB57A,#2F7FB5,#4A52D0)' }}
            >
              Mira Prospects · Inteligência de oportunidades
            </div>
            <h2 className="text-[32px] sm:text-[40px] lg:text-[46px] leading-[1.05] tracking-[-0.03em] font-semibold text-ink mb-5">
              A operação também <span className="text-grad">encontra quem está pronto para comprar.</span>
            </h2>
            <p className="text-[17px] lg:text-[18px] text-muted leading-[1.55] mb-8 max-w-[560px]">
              Você diz o que vende e para quem. A Mira Prospects cruza a Receita Federal e o Google
              Places pra mapear o mercado, dá a cada oportunidade um Mira Score explicado e entrega
              o Alvo pronto, com a primeira mensagem já escrita, pra Iza fechar no WhatsApp. Não é
              lista fria. É inteligência de vendas dentro da plataforma onde você já vende.
            </p>

            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-5 mb-6">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="flex gap-3">
                    <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#2FB57A,#2F7FB5,#4A52D0)' }}>
                      <Icon size={17} strokeWidth={2} aria-hidden />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold text-ink mb-0.5">{f.title}</h3>
                      <p className="text-[13.5px] text-muted leading-[1.5]">{f.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Como funciona: 3 passos, mesma logica aprova/executa da operacao */}
            <div className="flex flex-col sm:flex-row gap-2.5 mb-8">
              {PASSOS.map((p, i) => (
                <div key={p} className="flex-1 flex items-center gap-2.5 bg-white border border-line rounded-[12px] px-3.5 py-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-bg-soft text-accent text-[11px] font-mono font-semibold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-[12.5px] text-muted leading-tight">{p}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Link href="/cadastro" className="btn btn-accent btn-lg">
                Encontrar quem está pronto pra comprar <span aria-hidden>→</span>
              </Link>
              <span className="text-[13px] text-muted">
                Add-on nos planos Growth e Scale. Incluído no Enterprise.
              </span>
            </div>
          </div>

          {/* Mock do Alvo (Dossiê) */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="w-full max-w-[380px] bg-white border border-line rounded-[22px] shadow-[var(--shadow-card)] overflow-hidden">
              <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg,#2FB57A,#2F7FB5,#4A52D0)' }} />
              <div className="p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-accent mb-1">Alvo</div>
                    <div className="text-[17px] font-semibold text-ink leading-tight">Distribuidora Norte Ltda</div>
                    <div className="text-[13px] text-muted">Atacado de materiais · Manaus, AM</div>
                  </div>
                  <div className="text-center flex-shrink-0">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-[18px] font-bold" style={{ background: 'linear-gradient(135deg,#2FB57A,#2F7FB5,#4A52D0)' }}>
                      87
                    </div>
                    <div className="text-[10px] text-muted mt-1">Mira Score</div>
                  </div>
                </div>

                <div className="border-t border-line pt-4 space-y-3.5">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">Comitê de compra</div>
                    <div className="flex flex-wrap gap-1.5">
                      {['Diretor Comercial', 'Head de TI', 'CEO'].map((r) => (
                        <span key={r} className="text-[12px] bg-bg-soft border border-line rounded-lg px-2.5 py-1 text-ink">{r}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">Demanda agora</div>
                    <div className="text-[13.5px] text-ink">Expansão de 2 filiais, com edital aberto de compra.</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">Janela de entrada</div>
                    <div className="text-[13.5px] text-ink">Renovação de fornecedor nos próximos 30 dias.</div>
                  </div>
                  <div className="bg-bg-soft rounded-[12px] p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-accent mb-1">Por que subiu</div>
                    <div className="text-[12.5px] text-muted leading-[1.5]">Tem CISO mapeado e edital aberto. Fornecedor atual deslocável.</div>
                  </div>
                  <div className="rounded-[12px] p-3 text-white" style={{ background: 'linear-gradient(135deg,#2FB57A,#2F7FB5,#4A52D0)' }}>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider mb-1.5">
                      <MessageSquareText size={12} aria-hidden /> Primeira abordagem, já escrita
                    </div>
                    <div className="text-[12.5px] leading-[1.5] text-white/95">
                      &quot;Oi, tudo bem? Vi que a Distribuidora Norte está expandindo pra mais 2
                      filiais. Consigo estruturar um plano de fornecimento sob medida, topa uma
                      conversa de 15 minutos essa semana?&quot;
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
