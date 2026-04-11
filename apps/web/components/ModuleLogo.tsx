'use client';

import { usePathname } from 'next/navigation';
import Image from 'next/image';

// ─────────────────────────────────────────────────────────────────────────────
// Config visual de cada logo de produto
// ─────────────────────────────────────────────────────────────────────────────

interface LogoConfig {
  name1: string;
  name2: string;
  color2: string;
  subtitle: string;
  innerIcon: React.ReactNode;
}

const LOGO_CONFIGS: Record<string, LogoConfig> = {
  core: {
    name1: 'ZappIQ',
    name2: 'Core',
    color2: '#1B6B3A',
    subtitle: 'CENTRAL DE CONVERSAS',
    innerIcon: <path d="M65 31L41 60H57L52 82L78 48H62L65 31Z" fill="white" />,
  },
  pulse: {
    name1: 'Pulse',
    name2: 'AI',
    color2: '#EF4444',
    subtitle: 'AGENTE DE IA 24/7',
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
    name1: 'Spark',
    name2: 'Campaigns',
    color2: '#F59E0B',
    subtitle: 'MOTOR DE CAMPANHAS',
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
    name1: 'Radar',
    name2: 'Insights',
    color2: '#7C3AED',
    subtitle: 'ANALYTICS EM TEMPO REAL',
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
    name1: 'Nexus',
    name2: 'CRM',
    color2: '#0D9488',
    subtitle: 'CRM NATIVO PARA WHATSAPP',
    innerIcon: (
      <>
        <line x1="42" y1="44" x2="78" y2="44" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
        <line x1="42" y1="53" x2="78" y2="53" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
        <line x1="42" y1="62" x2="62" y2="62" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
      </>
    ),
  },
  forge: {
    name1: 'Forge',
    name2: 'Studio',
    color2: '#F59E0B',
    subtitle: 'CONSTRUTOR DE FLUXOS',
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
    name1: 'Echo',
    name2: 'Copilot',
    color2: '#C026D3',
    subtitle: 'COPILOTO INTELIGENTE',
    innerIcon: (
      <>
        <circle cx="60" cy="53" r="5" fill="white" />
        <path d="M48,53 C48,40 72,40 72,53" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M41,53 C41,33 79,33 79,53" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.6" />
      </>
    ),
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Mapeamento rota → produto
// ─────────────────────────────────────────────────────────────────────────────

const ROUTE_MAP: Record<string, string | null> = {
  '/dashboard':      null,        // null = logo principal ZappIQ
  '/conversations':  'core',
  '/contacts':       'echo',
  '/crm':            'nexus',
  '/campaigns':      'spark',
  '/flows':          'forge',
  '/analytics':      'radar',
  '/knowledge-base': 'pulse',
  '/settings':       null,
  '/billing':        null,
};

function resolveProduct(pathname: string): string | null {
  // Tenta match exato, depois prefixo
  for (const [route, product] of Object.entries(ROUTE_MAP)) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      return product;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG do produto (compact — altura 32px)
// ─────────────────────────────────────────────────────────────────────────────

function ProductLogo({ id }: { id: string }) {
  const cfg = LOGO_CONFIGS[id];
  if (!cfg) return null;
  const gid = `hdr_${id}`;
  return (
    <svg
      viewBox="0 0 162 40"
      width="148"
      height="36"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
      textRendering="optimizeLegibility"
      aria-label={`${cfg.name1}${cfg.name2}`}
    >
      <defs>
        <linearGradient id={gid} x1="0.9" y1="0" x2="0.1" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0" stopColor="#25D366" />
          <stop offset="1" stopColor="#4361EE" />
        </linearGradient>
      </defs>
      {/* Bubble + ícone + sparkles */}
      <g transform="translate(2,2) scale(0.37)">
        <path
          d="M60 95C82.0914 95 100 77.0914 100 55C100 32.9086 82.0914 15 60 15C37.9086 15 20 32.9086 20 55C20 63.271 22.508 70.9554 26.8407 77.2646L20 95L38.9912 89.6133C45.242 93.1171 52.4096 95 60 95Z"
          fill={`url(#${gid})`}
        />
        {cfg.innerIcon}
        <path d="M104,15 L105.5,20 L110.5,21.5 L105.5,23 L104,28 L102.5,23 L97.5,21.5 L102.5,20 Z" fill="#818CF8" />
        <path d="M91,8 L92,11.5 L95.5,12.5 L92,13.5 L91,17 L90,13.5 L86.5,12.5 L90,11.5 Z" fill="#A5B4FC" />
      </g>
      {/* Nome */}
      <text
        x="46"
        y="25"
        fontFamily="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"
        letterSpacing="-0.3"
      >
        <tspan fontWeight="800" fontSize="14" fill="#1A2744">{cfg.name1}</tspan>
        <tspan fontWeight="700" fontSize="14" fill={cfg.color2}>{cfg.name2}</tspan>
      </text>
      {/* Subtitle */}
      <text
        x="47"
        y="35"
        fontFamily="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"
        fontSize="6.5"
        fontWeight="600"
        fill="#9CA3AF"
        letterSpacing="0.8"
      >
        {cfg.subtitle}
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente exportado — lê pathname e renderiza o logo correto
// ─────────────────────────────────────────────────────────────────────────────

export function ModuleLogo() {
  const pathname = usePathname();
  const productId = resolveProduct(pathname);

  if (productId) {
    return <ProductLogo id={productId} />;
  }

  // Dashboard / Settings / Billing → logo principal
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
