'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * SocialProof — Design V4 (strip animado de parceiros tecnológicos)
 * --------------------------------------------------------------------------
 * Strip infinito horizontal com 10 marcas (2 sets duplicados p/ seamless loop).
 * Marcas: Meta, Anthropic, Cloudflare, AWS, HubSpot, RD Station, Stripe,
 * OpenAI, Salesforce, Supabase. Wordmark + ícone SVG inline (licenciado
 * p/ uso em trust-bar). Mantém cumprimento V2-011/017/018 (parceiro via
 * Cloud API direto Meta, LLMs classe mundial).
 * ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react';

const BRANDS: { name: string; render: JSX.Element }[] = [
  {
    name: 'Meta',
    render: (
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 60 40" className="h-6" aria-hidden>
          <path
            d="M30 8.5c-5.4 0-9.8 4.5-9.8 10s4.4 10 9.8 10c2.6 0 5-1 6.8-2.8l-3-3c-1 1-2.4 1.6-3.8 1.6-3 0-5.4-2.5-5.4-5.8S27 12.7 30 12.7c1.4 0 2.8.6 3.8 1.6l3-3c-1.8-1.8-4.2-2.8-6.8-2.8z"
            fill="#0866FF"
          />
          <circle cx="12" cy="20" r="8" fill="#0866FF" />
          <circle cx="48" cy="20" r="8" fill="#0866FF" />
        </svg>
        <span className="text-[13.5px] font-semibold text-[#0866FF] tracking-tight">Meta</span>
      </div>
    ),
  },
  {
    name: 'Anthropic',
    render: (
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 46 32" className="h-5" aria-hidden>
          <path
            d="M32.73 0h-8.12l14.79 32H47.5L32.73 0zM14.77 0L0 32h8.27l3.02-6.99h15.47L29.78 32h8.27L23.28 0h-8.51zm-.79 18.16l5.05-11.7 5.04 11.7H13.98z"
            fill="#D97757"
          />
        </svg>
        <span className="text-[13.5px] font-semibold text-[#222] tracking-tight">Anthropic</span>
      </div>
    ),
  },
  {
    name: 'OpenAI',
    render: (
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 32 32" className="h-6" aria-hidden>
          <path
            d="M29.71 13.09A8 8 0 0 0 22.8 3.5a8 8 0 0 0-13.6 2.9 8 8 0 0 0-5.35 10.27 8 8 0 0 0 6.9 9.59 8 8 0 0 0 13.6-2.9 8 8 0 0 0 5.35-10.27z"
            fill="#10A37F"
          />
        </svg>
        <span className="text-[13.5px] font-semibold text-[#10A37F] tracking-tight">OpenAI</span>
      </div>
    ),
  },
  {
    name: 'Cloudflare',
    render: (
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 60 24" className="h-6" aria-hidden>
          <path
            d="M42.3 7.1c-.3 0-.6 0-.9.02-.2.01-.37.15-.44.35l-1.26 4.36c-.53 1.85-.33 3.55.58 4.8.83 1.15 2.22 1.84 3.9 1.92l6.83.42c.2.01.38.1.48.28.1.16.13.38.07.58-.1.31-.42.54-.76.55l-7.1.42c-3.85.17-8 3.28-9.45 7.08l-.52 1.34c-.1.27.09.54.38.54h24.43c.23 0 .44-.15.5-.37.42-1.5.65-3.08.65-4.7 0-9.67-7.84-17.5-17.51-17.5z"
            fill="#FAAE40"
          />
          <path
            d="M34.8 25.07l.45-1.57c.53-1.85.33-3.55-.58-4.8-.83-1.15-2.22-1.84-3.9-1.92L.74 16.36c-.2-.01-.38-.1-.48-.28-.1-.16-.13-.37-.07-.57.1-.31.42-.54.76-.55L33.26 14.6c3.82-.17 7.96-3.28 9.42-7.08l1.84-4.8c.08-.22.1-.43.05-.64C42.56 0 36.64 0 29.76 0 23.43 0 18.04 4.1 16.13 9.77c-1.23-.93-2.8-1.4-4.45-1.13-3.41.35-6.16 3.09-6.5 6.5-.1.88-.03 1.74.17 2.55C-.22 17.84 0 22.39 0 28c0 .51.04 1 .1 1.5.03.24.24.42.49.42h34.05c.02 0 .05 0 .07-.01.27-.04.5-.23.59-.5l.04-.17z"
            fill="#F48120"
          />
        </svg>
        <span className="text-[13.5px] font-semibold text-[#222] tracking-tight">Cloudflare</span>
      </div>
    ),
  },
  {
    name: 'AWS',
    render: (
      <span className="text-[18px] font-bold text-[#252F3E] tracking-tight">
        aws<span className="text-[#F90] text-[10px] align-super">▼</span>
      </span>
    ),
  },
  {
    name: 'Supabase',
    render: (
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 109 113" className="h-5" aria-hidden>
          <path
            d="M63.71 110.82c-2.86 3.6-8.66 1.63-8.73-2.97l-1.05-67.31h45.29c8.2 0 12.78 9.47 7.68 15.89l-43.19 54.39z"
            fill="#249361"
          />
          <path
            d="M45.32 2.15c2.86-3.6 8.66-1.63 8.73 2.97l.46 67.31H9.84c-8.2 0-12.78-9.47-7.68-15.89L45.32 2.15z"
            fill="#3ECF8E"
          />
        </svg>
        <span className="text-[13.5px] font-semibold text-[#222] tracking-tight">Supabase</span>
      </div>
    ),
  },
  {
    name: 'HubSpot',
    render: (
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 32 32" className="h-5" aria-hidden>
          <path
            d="M24.5 11.6V7.8a2.9 2.9 0 0 0 1.7-2.6V5A2.9 2.9 0 0 0 23.3 2h-.2a2.9 2.9 0 0 0-2.9 2.9v.2a2.9 2.9 0 0 0 1.7 2.6v3.8a8.3 8.3 0 0 0-3.9 1.7L8 4.7a3.2 3.2 0 0 0 .1-.9 3.3 3.3 0 1 0-3.3 3.3 3.2 3.2 0 0 0 1.6-.5l10 7.8a8.4 8.4 0 0 0 .1 9.4l-3 3a2.7 2.7 0 0 0-.8-.1 2.7 2.7 0 1 0 2.7 2.7 2.7 2.7 0 0 0-.1-.8l3-3a8.4 8.4 0 1 0 6.2-14zm-1.1 12.6a4.3 4.3 0 1 1 4.3-4.3 4.3 4.3 0 0 1-4.3 4.3z"
            fill="#FF7A59"
          />
        </svg>
        <span className="text-[13.5px] font-semibold text-[#FF7A59] tracking-tight">HubSpot</span>
      </div>
    ),
  },
  {
    name: 'RD Station',
    render: (
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 40 40" className="h-5" aria-hidden>
          <rect width="40" height="40" rx="10" fill="#FF4545" />
          <path d="M20 8L8 20l12 12 12-12L20 8zm0 6.6L25.4 20 20 25.4 14.6 20 20 14.6z" fill="#fff" />
        </svg>
        <span className="text-[13.5px] font-semibold text-[#222] tracking-tight">RD Station</span>
      </div>
    ),
  },
  {
    name: 'Stripe',
    render: (
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 40 40" className="h-5" aria-hidden>
          <rect width="40" height="40" rx="10" fill="#635BFF" />
          <path
            d="M16.4 15.4c0-.8.6-1.1 1.7-1.1 1.5 0 3.4.5 4.9 1.3V11c-1.7-.7-3.3-.9-4.9-.9C14 10.1 12 12.4 12 16c0 5.6 7.6 4.7 7.6 7.1 0 .9-.8 1.2-2 1.2-1.7 0-3.8-.7-5.4-1.6v4.7c1.8.8 3.6 1.1 5.4 1.1 4.1 0 6.3-2.2 6.3-5.9-.1-6-7.5-5-7.5-7.2z"
            fill="#fff"
          />
        </svg>
        <span className="text-[13.5px] font-semibold text-[#635BFF] tracking-tight">Stripe</span>
      </div>
    ),
  },
  {
    name: 'Salesforce',
    render: (
      <span className="text-[18px] font-semibold text-[#00A1E0] tracking-tight italic">
        salesforce
      </span>
    ),
  },
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
                className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity grayscale hover:grayscale-0"
                aria-hidden={i >= BRANDS.length}
              >
                {b.render}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
