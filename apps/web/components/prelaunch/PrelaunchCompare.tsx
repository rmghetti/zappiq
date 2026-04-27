'use client';

import s from './prelaunch.module.css';

export function PrelaunchCompare() {
  return (
    <section className={s.section}>
      <div className={s.shell}>
        <div className={s.sectionEyebrow}>
          <span className={s.sectionEyebrowNum}>02 ·</span>
          <span>O QUE MUDA</span>
        </div>
        <h2 className={s.sectionH2}>
          Atender 24 horas por dia.<br />
          Sem contratar <em className={s.sectionH2Em}>mais ninguém.</em>
        </h2>

        <div className={s.revealGrid}>
          <article className={s.revealCard}>
            <div className={s.revealCardLabel}>─ Antes</div>
            <h3 className={s.revealCardH3}>5 atendentes. R$ 15 mil/mês. Cliente esperando 2 horas.</h3>
            <p className={s.revealCardP}>
              40% dos leads somem antes da primeira resposta. Folha pesada, fila travada, plantão impossível
              na madrugada e no fim de semana.
            </p>
          </article>
          <article className={`${s.revealCard} ${s.revealCardFeat}`}>
            <div className={`${s.revealCardLabel} ${s.revealCardLabelFeat}`}>─ Com ZappIQ</div>
            <h3 className={s.revealCardH3}>A Iza atende 24/7. 1 humano cuida do que importa. R$ 197 a partir.</h3>
            <p className={s.revealCardP}>
              Resposta em 30 segundos, conversão 60% maior no mesmo volume. Setup zero. Dados no Brasil. LGPD
              resolvida. Sem fidelidade.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
