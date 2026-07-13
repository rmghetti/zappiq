'use client';

import s from './prelaunch.module.css';

export function PrelaunchPillars() {
  return (
    <section className={`${s.section} ${s.sectionAlt}`} id="preview">
      <div className={s.shell}>
        <div className={s.sectionEyebrow}>
          <span className={s.sectionEyebrowNum}>01 ·</span>
          <span>O QUE ESTÁ POR VIR</span>
        </div>
        <h2 className={s.sectionH2}>
          Não é só um chatbot.<br />
          É <em className={s.sectionH2Em}>uma nova infraestrutura</em> de conversa para o seu negócio.
        </h2>
        <p className={s.sectionSub}>
          Três pilares que vão redefinir como empresas brasileiras conversam com seus clientes.
          Pequenas pistas do que vai chegar no dia 04 de maio.
        </p>

        <div className={s.pillars}>
          {/* Pillar 1: Iza */}
          <article className={s.pillar}>
            <div className={s.pillarVisual}>
              <div className={s.pillarNumTag}>01 · IZA</div>
              <div className={s.vizPulse}>
                <div className={s.vizRing} />
                <div className={`${s.vizRing} ${s.vizRing2}`} />
                <div className={`${s.vizRing} ${s.vizRing3}`} />
                <div className={s.vizCore}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                </div>
              </div>
            </div>
            <h3 className={s.pillarH3}>Iza, a IA que entende seu negócio</h3>
            <p className={s.pillarP}>
              Treinada com seus documentos, calibrada em minutos, fala em texto e em voz. Resolve 65% dos
              atendimentos sem precisar de humano, com a mesma IA que empresas Fortune 500 usam.
            </p>
          </article>

          {/* Pillar 2: Voz */}
          <article className={s.pillar}>
            <div className={s.pillarVisual}>
              <div className={s.pillarNumTag}>02 · VOZ</div>
              <div className={s.vizFlow}>
                <svg viewBox="0 0 320 140" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="vg53" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#2fb57a" stopOpacity="0" />
                      <stop offset="50%" stopColor="#2fb57a" stopOpacity="1" />
                      <stop offset="100%" stopColor="#4a52d0" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <g transform="translate(0, 70)">
                    <path d="M0,0 Q40,-40 80,0 T160,0 T240,0 T320,0" fill="none" stroke="url(#vg53)" strokeWidth="2">
                      <animate
                        attributeName="d"
                        dur="3s"
                        repeatCount="indefinite"
                        values="M0,0 Q40,-40 80,0 T160,0 T240,0 T320,0;
                                M0,0 Q40,40 80,0 T160,0 T240,0 T320,0;
                                M0,0 Q40,-40 80,0 T160,0 T240,0 T320,0"
                      />
                    </path>
                    <path d="M0,0 Q40,-25 80,0 T160,0 T240,0 T320,0" fill="none" stroke="rgba(47,181,122,0.5)" strokeWidth="1">
                      <animate
                        attributeName="d"
                        dur="2.4s"
                        repeatCount="indefinite"
                        values="M0,0 Q40,-25 80,0 T160,0 T240,0 T320,0;
                                M0,0 Q40,25 80,0 T160,0 T240,0 T320,0;
                                M0,0 Q40,-25 80,0 T160,0 T240,0 T320,0"
                      />
                    </path>
                    <path d="M0,0 Q40,-12 80,0 T160,0 T240,0 T320,0" fill="none" stroke="rgba(74,82,208,0.5)" strokeWidth="1">
                      <animate
                        attributeName="d"
                        dur="3.8s"
                        repeatCount="indefinite"
                        values="M0,0 Q40,-12 80,0 T160,0 T240,0 T320,0;
                                M0,0 Q40,12 80,0 T160,0 T240,0 T320,0;
                                M0,0 Q40,-12 80,0 T160,0 T240,0 T320,0"
                      />
                    </path>
                  </g>
                </svg>
              </div>
            </div>
            <h3 className={s.pillarH3}>Voz nativa em português</h3>
            <p className={s.pillarP}>
              Cliente manda áudio? A Iza entende. Quer que ela responda falando? Ela fala, com entonação natural,
              praticamente humana, no mesmo WhatsApp. Do jeito que o brasileiro conversa.
            </p>
          </article>

          {/* Pillar 3: Radar 360 */}
          <article className={s.pillar}>
            <div className={s.pillarVisual}>
              <div className={s.pillarNumTag}>03 · RADAR 360°</div>
              <div className={s.vizBars}>
                {[30, 55, 42, 78, 60, 90, 70, 48, 82, 65, 95, 72].map((h, i) => (
                  <div
                    key={i}
                    className={s.vizBar}
                    style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
            </div>
            <h3 className={s.pillarH3}>Radar 360°: dashboards que viram decisão</h3>
            <p className={s.pillarP}>
              Conversas viram BI executável. Alertas quando algo foge do normal, previsão de vendas por IA,
              comparativo anônimo com seu setor. Tudo em tempo real, sem analista.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
