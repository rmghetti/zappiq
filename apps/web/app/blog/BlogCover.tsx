/* ══════════════════════════════════════════════════════════════════════════
 * BlogCover — capas temáticas dos artigos do blog (V1 · 11/06/2026)
 * --------------------------------------------------------------------------
 * Substitui o placeholder verde "ZappIQ" por composições visuais por tema:
 * gradiente próprio + logos de marca (Meta via /partners/meta.svg, WhatsApp
 * via glyph SVG inline, Instagram via lucide) + ícone temático em marca
 * d'água + padrão decorativo de bolhas de chat.
 *
 * Temas: meta-agent · meta-ads · whatsapp-leads · saude · api-tech ·
 *        ecommerce · roi  (fallback: zappiq)
 * Variantes: 'card' (grid), 'featured' (destaque) e 'hero' (topo do artigo).
 * ══════════════════════════════════════════════════════════════════════════ */

import Image from 'next/image';
import {
  Bot, Sparkles, RefreshCcw, Stethoscope, Layers, ShoppingBag, Calculator,
  Instagram, TrendingUp, Zap, CalendarCheck, MessageCircle,
} from 'lucide-react';

export type CoverTheme =
  | 'meta-agent'
  | 'meta-ads'
  | 'whatsapp-leads'
  | 'saude'
  | 'api-tech'
  | 'ecommerce'
  | 'roi'
  | 'zappiq';

/* Glyph oficial do WhatsApp (path simple-icons, 24x24) */
export function WhatsAppGlyph({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

interface ThemeConfig {
  gradient: string;          /* classes de fundo */
  glow: string;              /* radial decorativo */
  Watermark: typeof Bot;     /* ícone gigante translúcido */
  chips: ('meta' | 'whatsapp' | 'instagram' | 'bot' | 'spark' | 'chart' | 'cart' | 'health' | 'calc' | 'layers' | 'calendar')[];
  label: string;             /* micro-rótulo da capa */
}

const THEMES: Record<CoverTheme, ThemeConfig> = {
  'meta-agent': {
    gradient: 'bg-gradient-to-br from-[#0B1530] via-[#16264a] to-[#1d3a8a]',
    glow: 'radial-gradient(60% 70% at 75% 25%, rgba(47,181,122,.35), transparent 70%)',
    Watermark: Bot,
    chips: ['meta', 'whatsapp', 'instagram'],
    label: 'Meta Business Agent',
  },
  'meta-ads': {
    gradient: 'bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#4C1D95]',
    glow: 'radial-gradient(60% 70% at 70% 30%, rgba(37,211,102,.30), transparent 70%)',
    Watermark: TrendingUp,
    chips: ['meta', 'spark', 'whatsapp'],
    label: 'Meta Ads + IA',
  },
  'whatsapp-leads': {
    gradient: 'bg-gradient-to-br from-[#064E3B] via-[#0B7A55] to-[#25D366]',
    glow: 'radial-gradient(60% 70% at 75% 25%, rgba(255,255,255,.22), transparent 70%)',
    Watermark: RefreshCcw,
    chips: ['whatsapp', 'chart'],
    label: 'Vendas no WhatsApp',
  },
  saude: {
    gradient: 'bg-gradient-to-br from-[#0C4A6E] via-[#0E7490] to-[#22D3EE]',
    glow: 'radial-gradient(60% 70% at 70% 30%, rgba(255,255,255,.20), transparent 70%)',
    Watermark: Stethoscope,
    chips: ['health', 'whatsapp', 'calendar'],
    label: 'Saúde + WhatsApp',
  },
  'api-tech': {
    gradient: 'bg-gradient-to-br from-[#111827] via-[#1F2937] to-[#374151]',
    glow: 'radial-gradient(60% 70% at 75% 25%, rgba(37,211,102,.28), transparent 70%)',
    Watermark: Layers,
    chips: ['whatsapp', 'layers'],
    label: 'WhatsApp Business API',
  },
  ecommerce: {
    gradient: 'bg-gradient-to-br from-[#7C2D12] via-[#C2410C] to-[#F59E0B]',
    glow: 'radial-gradient(60% 70% at 70% 30%, rgba(255,255,255,.22), transparent 70%)',
    Watermark: ShoppingBag,
    chips: ['cart', 'whatsapp', 'spark'],
    label: 'E-commerce conversacional',
  },
  roi: {
    gradient: 'bg-gradient-to-br from-[#312E81] via-[#4338CA] to-[#7C3AED]',
    glow: 'radial-gradient(60% 70% at 75% 25%, rgba(47,181,122,.30), transparent 70%)',
    Watermark: Calculator,
    chips: ['calc', 'bot', 'chart'],
    label: 'ROI de IA',
  },
  zappiq: {
    gradient: 'bg-gradient-to-br from-[#0E1A33] via-[#16264a] to-[#2FB57A]',
    glow: 'radial-gradient(60% 70% at 70% 30%, rgba(255,255,255,.18), transparent 70%)',
    Watermark: MessageCircle,
    chips: ['bot', 'whatsapp'],
    label: 'ZappIQ',
  },
};

function Chip({ kind, size }: { kind: ThemeConfig['chips'][number]; size: number }) {
  const inner = size - 14;
  const cls = 'flex items-center justify-center rounded-xl bg-white/95 shadow-lg shadow-black/20 backdrop-blur';
  switch (kind) {
    case 'meta':
      return (
        <span className={cls} style={{ width: size * 1.7, height: size, padding: 6 }}>
          <Image src="/partners/meta.svg" alt="Meta" width={size * 1.5} height={inner} style={{ width: '100%', height: 'auto' }} />
        </span>
      );
    case 'whatsapp':
      return (
        <span className={cls} style={{ width: size, height: size }}>
          <WhatsAppGlyph size={inner} className="text-[#25D366]" />
        </span>
      );
    case 'instagram':
      return (
        <span className={cls} style={{ width: size, height: size }}>
          <Instagram size={inner} className="text-[#E1306C]" />
        </span>
      );
    case 'bot':
      return (
        <span className={cls} style={{ width: size, height: size }}>
          <Bot size={inner} className="text-[#4A52D0]" />
        </span>
      );
    case 'spark':
      return (
        <span className={cls} style={{ width: size, height: size }}>
          <Sparkles size={inner} className="text-[#7C3AED]" />
        </span>
      );
    case 'chart':
      return (
        <span className={cls} style={{ width: size, height: size }}>
          <TrendingUp size={inner} className="text-[#2FB57A]" />
        </span>
      );
    case 'cart':
      return (
        <span className={cls} style={{ width: size, height: size }}>
          <ShoppingBag size={inner} className="text-[#C2410C]" />
        </span>
      );
    case 'health':
      return (
        <span className={cls} style={{ width: size, height: size }}>
          <Stethoscope size={inner} className="text-[#0E7490]" />
        </span>
      );
    case 'calc':
      return (
        <span className={cls} style={{ width: size, height: size }}>
          <Calculator size={inner} className="text-[#4338CA]" />
        </span>
      );
    case 'layers':
      return (
        <span className={cls} style={{ width: size, height: size }}>
          <Layers size={inner} className="text-[#374151]" />
        </span>
      );
    case 'calendar':
      return (
        <span className={cls} style={{ width: size, height: size }}>
          <CalendarCheck size={inner} className="text-[#0E7490]" />
        </span>
      );
    default:
      return null;
  }
}

export function BlogCover({
  theme,
  variant = 'card',
  className = '',
}: {
  theme?: string;
  variant?: 'card' | 'featured' | 'hero';
  className?: string;
}) {
  const cfg = THEMES[(theme as CoverTheme) in THEMES ? (theme as CoverTheme) : 'zappiq'];
  const { Watermark } = cfg;
  const chipSize = variant === 'card' ? 40 : variant === 'featured' ? 48 : 54;
  const wmSize = variant === 'card' ? 150 : variant === 'featured' ? 210 : 280;

  return (
    <div className={`relative overflow-hidden ${cfg.gradient} ${className}`} aria-hidden="true">
      {/* glow */}
      <div className="absolute inset-0" style={{ background: cfg.glow }} />
      {/* padrão de bolhas de chat */}
      <div className="absolute -left-4 top-6 w-24 h-14 rounded-2xl rounded-bl-sm bg-white/[0.07]" />
      <div className="absolute left-10 bottom-8 w-32 h-16 rounded-2xl rounded-bl-sm bg-white/[0.05]" />
      <div className="absolute right-16 -bottom-4 w-28 h-16 rounded-2xl rounded-br-sm bg-white/[0.06]" />
      {/* marca d'água temática */}
      <Watermark
        size={wmSize}
        strokeWidth={1}
        className="absolute -right-8 -bottom-10 text-white/[0.10] rotate-[-8deg]"
      />
      {/* composição central: chips de marca */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <div className="flex items-center gap-3">
          {cfg.chips.map((c, i) => (
            <Chip key={`${c}-${i}`} kind={c} size={chipSize} />
          ))}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
          {cfg.label}
        </span>
      </div>
    </div>
  );
}
