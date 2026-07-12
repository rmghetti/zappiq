'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * PrelaunchHero: V5.3
 * --------------------------------------------------------------------------
 * Hero da página de pré-lançamento. Lado esquerdo: copy + countdown + CTAs.
 * Lado direito: mockup iPhone com chat animado da Iza + 3 insight cards
 * flutuantes posicionados ao redor do phone.
 * ══════════════════════════════════════════════════════════════════════════ */

import { Countdown } from './Countdown';
import { IzaChatStream } from './IzaChatStream';
import s from './prelaunch.module.css';

export function PrelaunchHero() {
  return (
    <section className={s.hero}>
      <div className={`${s.atmos} ${s.heroAtmos}`} />
      <div className={s.shell}>
        <div className={s.heroGrid}>
          {/* ─── Lado esquerdo: copy + countdown ─── */}
          <div className={s.heroLeft}>
            <div className={s.eyebrow}>
              <svg className={s.eyebrowIc} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 1v3M7 10v3M1 7h3M10 7h3M3 3l2 2M9 9l2 2M3 11l2-2M9 5l2-2" />
              </svg>
              <span>v5 · Iza · Voz nativa · Radar 360°</span>
            </div>

            <h1 className={s.heroTitle}>
              <span className={`${s.revealWord} ${s.d1}`}>A&nbsp;inteligência</span>{' '}
              <span className={`${s.revealWord} ${s.d2}`}>conversacional</span>
              <br />
              <span className={`${s.revealWord} ${s.d3}`}>do Brasil</span>{' '}
              <span className={`${s.revealWord} ${s.d4}`}>está</span>{' '}
              <span className={`${s.revealWord} ${s.d5}`}>
                <em className={s.heroEm}>prestes a falar.</em>
              </span>
            </h1>

            <p className={s.heroLead}>
              No dia <strong>04 de maio</strong>, a <strong>ZappIQ</strong> ativa uma nova camada de inteligência
              sobre o WhatsApp das empresas brasileiras. Atendimento autônomo 24/7, voz nativa em português e
              dashboards que viram decisão, tudo em uma só plataforma.
            </p>

            <Countdown />

            <div className={s.ctaRow}>
              <a href="#notify" className={`${s.btn} ${s.btnPrimary}`}>
                Quero ser avisado no lançamento
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 7h8M7 3l4 4-4 4" />
                </svg>
              </a>
              <a href="#preview" className={`${s.btn} ${s.btnGhost}`}>
                Ver prévia da plataforma
              </a>
            </div>

            <div className={s.heroMicro}>
              <span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 7l3 3 7-7" />
                </svg>
                Vagas Fundadores limitadas
              </span>
              <span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 7l3 3 7-7" />
                </svg>
                50% off no primeiro ano
              </span>
              <span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 7l3 3 7-7" />
                </svg>
                Dados 100% no Brasil
              </span>
            </div>
          </div>

          {/* ─── Lado direito: mockup iPhone + insights flutuantes ─── */}
          <div className={s.heroStage}>
            <div className={s.stageGlow} />

            <div className={`${s.insight} ${s.insight1}`}>
              <div className={s.insightIcn}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 11l4-4 3 3 5-6" />
                </svg>
              </div>
              <div>
                <strong>+62%</strong>
                <em>resolvidas pela IA</em>
              </div>
            </div>

            <div className={`${s.insight} ${s.insight2}`}>
              <div className={s.insightIcn}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 4v4l3 2" />
                </svg>
              </div>
              <div>
                <strong>resp · 1.2s</strong>
                <em>tempo médio</em>
              </div>
            </div>

            <div className={`${s.insight} ${s.insight3}`}>
              <div className={s.insightIcn}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 11.5a4 4 0 014-4h4a4 4 0 014 4M5 5a3 3 0 116 0 3 3 0 01-6 0z" />
                </svg>
              </div>
              <div>
                <strong>voz nativa</strong>
                <em>pt-br · áudio bidirecional</em>
              </div>
            </div>

            {/* Phone mockup */}
            <div className={s.phone}>
              <div className={s.phoneNotch} />
              <div className={s.phoneScreen}>
                {/* WhatsApp header */}
                <div className={s.waHead}>
                  <div className={s.waBack}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4l-5 5 5 5" />
                    </svg>
                  </div>
                  <div className={s.waAvatar}>
                    <svg viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 3l-7 4v5c0 4 3 7 7 8 4-1 7-4 7-8V7l-7-4z"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9 10l3 3 4-5"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className={s.waMeta}>
                    <div className={s.waName}>
                      Iza · ZappIQ <span className={s.waBadge}>IA</span>
                    </div>
                    <div className={s.waStatus}>
                      <span className={s.waDotMini} /> respondendo agora
                    </div>
                  </div>
                  <div className={s.waActions}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6a3 3 0 013-3h4a3 3 0 013 3v4a3 3 0 01-3 3H6a3 3 0 01-3-3V6zM13 7l3-2v8l-3-2" />
                    </svg>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="9" cy="4" r="1" />
                      <circle cx="9" cy="9" r="1" />
                      <circle cx="9" cy="14" r="1" />
                    </svg>
                  </div>
                </div>

                {/* Chat stream auto-cycling */}
                <div className={s.chatMount}>
                  <IzaChatStream />
                </div>

                {/* Footer fixo */}
                <div className={s.waFoot}>
                  <div className={s.waInput}>Mensagem</div>
                  <div className={s.waMic}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M7 2v6M4 5v3a3 3 0 006 0V5M2 11h10" />
                    </svg>
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
