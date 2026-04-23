/** @type {import('tailwindcss').Config} */
const path = require('path');

/* ═══════════════════════════════════════════════════════════════════
 * ZappIQ · Design System V4 (Chatbase-style · Geist + gradiente g→b→p)
 * --------------------------------------------------------------------
 * Tokens espelham o design definido em LANDING_NEW_DESIGN.html.
 * Cores base entram como CSS variables em globals.css (--ink, --muted,
 * --line, --bg, --bg-soft, --g1/g2/g3, --accent). Aqui expomos utilitárias
 * Tailwind que consomem essas vars (bg-ink, text-muted, border-line...).
 * ═══════════════════════════════════════════════════════════════════ */

module.exports = {
  content: [
    path.join(__dirname, './app/**/*.{js,ts,jsx,tsx}'),
    path.join(__dirname, './components/**/*.{js,ts,jsx,tsx}'),
    path.join(__dirname, './lib/**/*.{js,ts,jsx,tsx}'),
    path.join(__dirname, '../../packages/ui/src/**/*.{js,ts,jsx,tsx}'),
  ],
  theme: {
    extend: {
      colors: {
        /* Core neutros (via CSS vars — ver globals.css) */
        bg: 'var(--bg)',
        'bg-soft': 'var(--bg-soft)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        line: 'var(--line)',

        /* Gradiente canônico da marca · g→b→p */
        g1: 'var(--g1)',         // verde-marca     #2FB57A
        g2: 'var(--g2)',         // azul-transição  #2F7FB5
        g3: 'var(--g3)',         // roxo-fecho      #4A52D0
        accent: 'var(--accent)', // alias === g3    #4A52D0

        /* WhatsApp specs (phone demo) */
        wa: {
          bg: '#F5F3EE',
          header: '#075E54',
          me: '#DCF8C6',
          ia: '#FFFFFF',
        },

        /* Security dark section */
        'sec-dark': '#0A0B12',

        /* Legado (manter temporariamente pra compat — remover ao fim) */
        primary: {
          DEFAULT: '#2FB57A',
          500: '#2FB57A',
          600: '#26946A',
        },
        secondary: {
          DEFAULT: '#25D366',
          500: '#25D366',
        },
        surface: '#FFFFFF',
        background: 'var(--bg)',
        'text-primary': 'var(--ink)',
        'text-secondary': 'var(--muted)',
      },
      fontFamily: {
        sans: ['var(--font-geist)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-geist)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'Menlo', 'monospace'],
      },
      fontSize: {
        /* Escala expressiva do novo hero (h1 hero = 72px) */
        'hero': ['72px', { lineHeight: '1.02', letterSpacing: '-0.04em', fontWeight: '500' }],
        'h2': ['48px', { lineHeight: '1.08', letterSpacing: '-0.03em', fontWeight: '500' }],
        'h3': ['28px', { lineHeight: '1.25', letterSpacing: '-0.025em', fontWeight: '600' }],
      },
      borderRadius: {
        'sm2': '10px',
        'md2': '14px',
        'lg2': '20px',
        'xl2': '28px',
      },
      backgroundImage: {
        /* Gradient canônico — usado em botões, badges, CTA final */
        'grad': 'linear-gradient(135deg, var(--g1) 0%, var(--g2) 45%, var(--g3) 100%)',
        'grad-text': 'linear-gradient(135deg, var(--g1), var(--g2), var(--g3))',
        'grad-soft': 'linear-gradient(135deg, rgba(47,181,122,.08), rgba(74,82,208,.08))',
      },
      boxShadow: {
        /* Shadows do design novo — soft + card hover */
        'soft': '0 1px 2px rgba(17,17,17,.04), 0 8px 24px -12px rgba(17,17,17,.08)',
        'card-hover': '0 20px 40px -20px rgba(17,17,17,.15)',
        'tier-feat': '0 0 0 2px var(--accent), 0 30px 50px -20px rgba(74,82,208,.25)',
        'glow-accent': '0 20px 60px -30px rgba(74,82,208,.5)',
      },
      animation: {
        'geo-float': 'geoFloat 12s ease-in-out infinite',
        'geo-float-slow': 'geoFloat 18s ease-in-out infinite',
        'slider-loop': 'sliderLoop 40s linear infinite',
        'typing': 'typing 1.2s ease-in-out infinite',
        'tail-tick': 'tailTick 2s linear infinite',
        'fade-in': 'fadeIn .6s ease-out',
        'slide-up': 'slideUp .6s ease-out',
      },
      keyframes: {
        geoFloat: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-12px) rotate(3deg)' },
        },
        sliderLoop: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        typing: {
          '0%, 60%, 100%': { opacity: '0.3', transform: 'translateY(0)' },
          '30%': { opacity: '1', transform: 'translateY(-4px)' },
        },
        tailTick: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
