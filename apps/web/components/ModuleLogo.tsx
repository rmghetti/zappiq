'use client';

import { usePathname } from 'next/navigation';
import Image from 'next/image';

// ─────────────────────────────────────────────────────────────────────────────
// Config visual de cada secao do dashboard.
//
// V4 (2026-05-27): Brand unificado "ZappIQ" em TODAS as rotas — antes
// renderizava 6 sub-produtos ficticios (NexusCRM, EchoCopilot, etc) e
// gerava percepção de "comprei 6 produtos". Agora cada rota mantem icone
// e cor distintos (contexto visual gostoso), mas o nome e sempre "ZappIQ"
// + subtitle da secao.
// ─────────────────────────────────────────────────────────────────────────────

interface LogoConfig {
  /** Subtitle visivel ao lado do logo — descreve a secao */
  subtitle: string;
  /** Cor de destaque do icone (gradiente padrao verde-azul) */
  accentColor: string;
  /** Icone SVG interno do balao */
  innerIcon: React.ReactNode;
}

const LOGO_CONFIGS: Record<string, LogoConfig> = {
  core: {
    subtitle: 'CONVERSAS',
    accentColor: '#1B6B3A',
    innerIcon: <path d="M65 31L41 60H57L52 82L78 48H62L65 31Z" fill="white" />,
  },
  pulse: {
    subtitle: 'BASE DE CONHECIMENTO',
    accentColor: '#EF4444',
    innerIcon: (
      <>
        <polyline
          points="36,55 44,55 48,38 52,72 56,45 62,55 68,55"
          stroke="white" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round"
        />
        <line x1="68" y1="55" x2="78" y2="55" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.5" />
      </>
    ),
  },
  spark: {
    subtitle: 'CAMPANHAS',
    accentColor: '#F59E0B',
    innerIcon: (
      <>
        <path d="M44,48 L50,48 L63,38 L63,68 L50,58 L44,58 Z" fill="white" />
        <path d="M50,58 L47,70 L53,70 L56,58" fill="white" opacity="0.8" />
        <path d="M67,44 C72,49 72,57 67,62" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M71,40 C78,47 78,59 71,66" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6" />
      </>
    ),
  },
  radar: {
    subtitle: 'ANALYTICS',
    accentColor: '#7C3AED',
    innerIcon: (
      <>
        <circle cx="60" cy="52" r="14" stroke="white" strokeWidth="3" fill="none" />
        <circle cx="60" cy="52" r="7" stroke="white" strokeWidth="3" fill="none" />
        <circle cx="60" cy="52" r="2.5" fill="white" />
        <line x1="60" y1="52" x2="70" y2="42" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        <polygon points="70,42 75,40 73,46" fill="white" />
      </>
    ),
  },
  nexus: {
    subtitle: 'CRM',
    accentColor: '#0D9488',
    innerIcon: (
      <>
        <line x1="42" y1="44" x2="78" y2="44" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
        <line x1="42" y1="53" x2="78" y2="53" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
        <line x1="42" y1="62" x2="62" y2="62" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
      </>
    ),
  },
  forge: {
    subtitle: 'MAESTRO',
    accentColor: '#4F46E5',
    innerIcon: (
      <>
        <rect x="47" y="46" width="13" height="13" rx="2" fill="white" />
        <rect x="63" y="35" width="13" height="13" rx="2" fill="white" />
        <rect x="63" y="58" width="13" height="13" rx="2" fill="white" />
        <line x1="60" y1="52" x2="63" y2="41.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="60" y1="52" x2="63" y2="64.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      </>
    ),
  },
  echo: {
    subtitle: 'CONTATOS',
    accentColor: '#C026D3',
    innerIcon: (
      <>
        <circle cx="60" cy="53" r="5" fill="white" />
        <path d="M48,53 C48,40 72,40 72,53" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M41,53 C41,33 79,33 79,53" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.6" />
      </>
    ),
  },
  training: {
    subtitle: 'TREINAR IA',
    accentColor: '#0EA5E9',
    innerIcon: (
      <>
        <circle cx="60" cy="52" r="5" fill="white" />
        <path d="M60 30 L60 38 M60 66 L60 74 M44 52 L36 52 M76 52 L84 52 M48 40 L43 35 M72 64 L77 69 M48 64 L43 69 M72 40 L77 35"
              stroke="white" strokeWidth="3" strokeLinecap="round" />
      </>
    ),
  },
  quality: {
    subtitle: 'QUALIDADE DA IA',
    accentColor: '#16A34A',
    innerIcon: (
      <>
        <path d="M48 55 L57 64 L74 44" stroke="white" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Mapeamento rota → produto
// ─────────────────────────────────────────────────────────────────────────────

const ROUTE_MAP: Record<string, string | null> = {
  '/dashboard':         null,        // null = logo principal ZappIQ
  '/conversations':     'core',
  '/contacts':          'echo',
  '/crm':               'nexus',
  '/campaigns':         'spark',
  '/flows':             'forge',
  '/analytics':         'radar',
  '/ai-training':       'training',
  '/treinar/qualidade': 'quality',
  '/settings':          null,
  '/billing':           null,
};

function resolveProduct(pathname: string): string | null {
  for (const [route, product] of Object.entries(ROUTE_MAP)) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      return product;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG do contexto (altura 32px) — brand sempre "ZappIQ"
// ─────────────────────────────────────────────────────────────────────────────

function ContextLogo({ id }: { id: string }) {
  const cfg = LOGO_CONFIGS[id];
  if (!cfg) return null;
  const gid = `hdr_${id}`;
  return (
    <svg
      viewBox="0 0 200 40"
      width="180"
      height="36"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
      textRendering="optimizeLegibility"
      aria-label={`ZappIQ ${cfg.subtitle}`}
    >
      <defs>
        <linearGradient id={gid} x1="0.9" y1="0" x2="0.1" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0" stopColor="#25D366" />
          <stop offset="1" stopColor={cfg.accentColor} />
        </linearGradient>
      </defs>
      {/* Bubble com icone do contexto */}
      <g transform="translate(2,2) scale(0.37)">
        <path
          d="M60 95C82.0914 95 100 77.0914 100 55C100 32.9086 82.0914 15 60 15C37.9086 15 20 32.9086 20 55C20 63.271 22.508 70.9554 26.8407 77.2646L20 95L38.9912 89.6133C45.242 93.1171 52.4096 95 60 95Z"
          fill={`url(#${gid})`}
        />
        {cfg.innerIcon}
        <path d="M104,15 L105.5,20 L110.5,21.5 L105.5,23 L104,28 L102.5,23 L97.5,21.5 L102.5,20 Z" fill="#818CF8" />
        <path d="M91,8 L92,11.5 L95.5,12.5 L92,13.5 L91,17 L90,13.5 L86.5,12.5 L90,11.5 Z" fill="#A5B4FC" />
      </g>
      {/* ZappIQ (brand) */}
      <text
        x="46"
        y="25"
        fontFamily="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"
        letterSpacing="-0.3"
      >
        <tspan fontWeight="800" fontSize="15" fill="#1A2744">Zapp</tspan>
        <tspan fontWeight="800" fontSize="15" fill={cfg.accentColor}>IQ</tspan>
      </text>
      {/* Subtitle = secao */}
      <text
        x="47"
        y="35"
        fontFamily="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"
        fontSize="7"
        fontWeight="600"
        fill="#9CA3AF"
        letterSpacing="1.2"
      >
        {cfg.subtitle}
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente exportado — le pathname e renderiza o brand correto
// ─────────────────────────────────────────────────────────────────────────────

export function ModuleLogo() {
  const pathname = usePathname();
  const productId = resolveProduct(pathname);

  // Maestro (/flows): logo oficial em imagem (arquivo aprovado pelo CEO),
  // mantemos o png pra preservar identidade ja amadurecida.
  if (productId === 'forge') {
    return (
      <Image
        src="/zappiq-maestro.png"
        alt="ZappIQ Maestro"
        width={132}
        height={46}
        priority
        style={{ height: 38, width: 'auto' }}
      />
    );
  }

  if (productId) {
    return <ContextLogo id={productId} />;
  }

  // Dashboard / Settings / Billing → logo principal ZappIQ
  return (
    <Image
      src="/logo-positivo.svg"
      alt="ZappIQ"
      width={110}
      height={35}
      priority
    />
  );
}
