'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * SocialProof — Design V4 (strip animado de parceiros tecnológicos)
 * --------------------------------------------------------------------------
 * Strip infinito horizontal com 8 marcas oficiais (2 sets duplicados p/
 * seamless loop). Assets em /public/partners/*.svg (wordmarks oficiais,
 * Wikimedia Commons + brand portals das marcas).
 *
 * Composição: Meta · Anthropic · OpenAI · AWS · Cloudflare · Salesforce ·
 * Stripe · RD Station. Mantém cumprimento V2-011/017/018 (parceiro via
 * Cloud API direto Meta, LLMs classe mundial, infra global).
 *
 * Tratamento visual (canon V4 Chatbase-style):
 *   - default: grayscale + opacity 0.65 (monocromático sóbrio)
 *   - hover:   full color + opacity 1 (reativo, destaque da marca)
 * ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react';

type Brand = {
  name: string;
  src: string;
  /* altura renderizada (px) · calibrada por aspect ratio do wordmark */
  h: number;
  /* largura intrínseca pro hint do Next/Image (aspect ratio × h) */
  w: number;
};

/* Alturas harmonizadas na banda 24-28px (variação ~17%).
 * Logos com ícone+wordmark (AWS, Salesforce) ficam no topo da banda
 * porque parte da altura é ocupada pelo glifo e a parte textual precisa
 * casar visualmente com os wordmarks line-only (Meta, Anthropic, etc).
 * Widths recalculados mantendo o aspect ratio original de cada SVG. */
const BRANDS: Brand[] = [
  { name: 'Meta',       src: '/partners/meta.svg',       h: 26, w: 129 },
  { name: 'Anthropic',  src: '/partners/anthropic.svg',  h: 24, w: 214 },
  { name: 'OpenAI',     src: '/partners/openai.svg',     h: 24, w: 88  },
  { name: 'AWS',        src: '/partners/aws.svg',        h: 28, w: 47  },
  { name: 'Cloudflare', src: '/partners/cloudflare.svg', h: 26, w: 79  },
  { name: 'Salesforce', src: '/partners/salesforce.svg', h: 28, w: 40  },
  { name: 'Stripe',     src: '/partners/stripe.svg',     h: 26, w: 62  },
  { name: 'RD Station', src: '/partners/rd-station.svg', h: 24, w: 107 },
];

export function SocialProof() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  /* respeita prefers-reduced-motion */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) setPaused(true);
  }, []);

  return (
    <section className="py-16 lg:py-20 border-y border-line bg-bg">
      <div className="zappiq-wrap">
        <div className="text-center mb-10">
          <h3 className="text-[17px] lg:text-[19px] font-medium text-ink mb-2 tracking-tight">
            Integrado com as ferramentas que sua empresa já usa.
          </h3>
          <p className="text-[13.5px] text-muted">
            Parceiro oficial Meta · IA da Anthropic e OpenAI · dados no Brasil.
          </p>
        </div>

        {/* Slider com fade nas bordas */}
        <div
          className="relative overflow-hidden"
          style={{
            maskImage:
              'linear-gradient(to right, transparent 0, black 80px, black calc(100% - 80px), transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to right, transparent 0, black 80px, black calc(100% - 80px), transparent 100%)',
          }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div
            ref={trackRef}
            className="flex items-center gap-12 lg:gap-16 whitespace-nowrap will-change-transform"
            style={{
              animation: 'sliderLoop 45s linear infinite',
              animationPlayState: paused ? 'paused' : 'running',
              width: 'max-content',
            }}
          >
            {[...BRANDS, ...BRANDS].map((b, i) => (
              <div
                key={`${b.name}-${i}`}
                className="flex-shrink-0 flex items-center justify-center"
                aria-hidden={i >= BRANDS.length}
                style={{ height: 40 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.src}
                  alt={b.name}
                  width={b.w}
                  height={b.h}
                  className="opacity-65 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-300"
                  style={{ height: b.h, width: 'auto' }}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
