'use client';

import Link from 'next/link';
import { ArrowRight, Star, Award, BarChart3, BadgeCheck } from 'lucide-react';
import { PublicLayout } from '../../components/landing/PublicLayout';

/* ------------------------------------------------------------------ */
/* Badge SVG inline                                                    */
/* ------------------------------------------------------------------ */

function ZappIQBadge({ size = 200 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size * 1.15}
      viewBox="0 0 200 230"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Selo ZappIQ de Atendimento 5 Estrelas"
    >
      {/* Shield shape */}
      <path
        d="M100 10 L185 50 L185 130 Q185 190 100 220 Q15 190 15 130 L15 50 Z"
        fill="url(#badge-gradient)"
        stroke="#0F5132"
        strokeWidth="3"
      />
      {/* Inner shield */}
      <path
        d="M100 25 L172 58 L172 128 Q172 180 100 207 Q28 180 28 128 L28 58 Z"
        fill="white"
        fillOpacity="0.15"
      />
      {/* 5 Stars */}
      {[-40, -20, 0, 20, 40].map((offset, i) => (
        <g key={i} transform={`translate(${100 + offset}, 80)`}>
          <polygon
            points="0,-10 3,-3 10,-3 5,2 7,10 0,6 -7,10 -5,2 -10,-3 -3,-3"
            fill="#FFD700"
            stroke="#DAA520"
            strokeWidth="0.5"
          />
        </g>
      ))}
      {/* ZappIQ text */}
      <text
        x="100"
        y="118"
        textAnchor="middle"
        fontFamily="Inter, sans-serif"
        fontWeight="800"
        fontSize="24"
        fill="white"
      >
        ZappIQ
      </text>
      {/* Subtitle */}
      <text
        x="100"
        y="142"
        textAnchor="middle"
        fontFamily="Inter, sans-serif"
        fontWeight="600"
        fontSize="10"
        fill="rgba(255,255,255,0.85)"
      >
        ATENDIMENTO 5 ESTRELAS
      </text>
      {/* Year */}
      <text
        x="100"
        y="170"
        textAnchor="middle"
        fontFamily="Inter, sans-serif"
        fontWeight="700"
        fontSize="14"
        fill="rgba(255,255,255,0.7)"
      >
        2026
      </text>
      {/* Gradient definition */}
      <defs>
        <linearGradient id="badge-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1B6B3A" />
          <stop offset="100%" stopColor="#25D366" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Empresas certificadas (placeholder)                                 */
/* ------------------------------------------------------------------ */

/* PLACEHOLDER: substituir por dado real — logos e nomes de clientes */
const CERTIFIED_COMPANIES = [
  { name: 'Clinica Vida Plena', segment: 'Saude', initials: 'VP' },
  { name: 'TrendMix Moda', segment: 'Varejo', initials: 'TM' },
  { name: 'AutoTech Oficina', segment: 'Automotivo', initials: 'AT' },
  { name: 'Escola Nova Era', segment: 'Educacao', initials: 'NE' },
];

/* ------------------------------------------------------------------ */
/* Steps                                                               */
/* ------------------------------------------------------------------ */

const STEPS = [
  {
    icon: <BarChart3 size={28} />,
    title: 'Ative o ZappIQ',
    description: 'Crie sua conta, configure o Pulse AI e comece a atender seus clientes pelo WhatsApp.',
  },
  {
    icon: <Star size={28} />,
    title: 'Alcance CSAT acima de 4.5',
    description: 'Mantenha uma nota media de satisfacao acima de 4.5 por pelo menos 30 dias consecutivos.',
  },
  {
    icon: <BadgeCheck size={28} />,
    title: 'Receba o selo',
    description: 'O selo digital e gerado automaticamente. Use no seu site, Instagram e perfil do WhatsApp.',
  },
];

/* ------------------------------------------------------------------ */
/* Componente principal                                                */
/* ------------------------------------------------------------------ */

export function SeloPage() {
  return (
    <PublicLayout>
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 mb-16">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Certificacao</p>
          <h1 className="font-display text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-5">
            Selo ZappIQ de Atendimento 5 Estrelas
          </h1>
          <p className="text-lg text-gray-500">
            Empresas que mantem CSAT acima de 4.5 recebem nosso selo digital de excelencia — uma prova social poderosa para site, Instagram e WhatsApp.
          </p>
        </div>
      </div>

      {/* Badge showcase */}
      <div className="max-w-5xl mx-auto px-6 mb-20">
        <div className="bg-gradient-to-br from-[#F8FAF9] to-white rounded-2xl border border-gray-200 p-12 flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-shrink-0">
            <ZappIQBadge size={180} />
          </div>
          <div className="flex-1 text-center lg:text-left">
            <h2 className="font-display text-2xl font-bold text-gray-900 mb-4">
              Uma marca de confianca para seu negocio
            </h2>
            <p className="text-gray-500 leading-relaxed mb-4">
              O Selo ZappIQ certifica que sua empresa oferece atendimento de excelencia via WhatsApp.
              Clientes que veem o selo tem 3x mais confianca na hora de comprar ou agendar.
            </p>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold">✓</span>
                Exiba no site, redes sociais e WhatsApp
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold">✓</span>
                Renovacao automatica enquanto manter CSAT acima de 4.5
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold">✓</span>
                Destaque no diretorio de empresas certificadas ZappIQ
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Como participar */}
      <div className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="font-display text-3xl font-extrabold text-gray-900 text-center mb-12">Como participar</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map((step, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-8 text-center hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-primary-100 text-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-5">
                {step.icon}
              </div>
              <div className="w-8 h-8 rounded-full bg-primary-500 text-white text-sm font-bold flex items-center justify-center mx-auto mb-4">
                {i + 1}
              </div>
              <h3 className="font-display text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Empresas certificadas */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        <h2 className="font-display text-3xl font-extrabold text-gray-900 text-center mb-4">Empresas certificadas</h2>
        <p className="text-center text-gray-500 mb-12">Essas empresas ja conquistaram o Selo ZappIQ de Atendimento 5 Estrelas.</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {CERTIFIED_COMPANIES.map((company) => (
            <div key={company.name} className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col items-center text-center hover:shadow-lg transition-shadow">
              {/* PLACEHOLDER: substituir por dado real — logo da empresa */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white text-xl font-bold mb-4">
                {company.initials}
              </div>
              <p className="font-semibold text-gray-900 text-sm">{company.name}</p>
              <p className="text-xs text-gray-400 mt-1">{company.segment}</p>
              <div className="flex items-center gap-0.5 mt-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={14} className="text-yellow-400 fill-yellow-400" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <section className="py-20 bg-[#1A1A2E]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-5">
            <Award size={32} className="text-yellow-400" />
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-white">
              Conquiste seu selo
            </h2>
          </div>
          <p className="text-gray-400 mb-8">
            Comece a usar ZappIQ e conquiste o Selo de Atendimento 5 Estrelas para sua empresa.
          </p>
          {/* PLACEHOLDER: substituir por dado real */}
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-secondary-500 hover:bg-secondary-600 text-white font-semibold px-8 py-4 rounded-xl transition-colors shadow-lg shadow-secondary-500/30 text-base"
          >
            Comecar Gratis e Conquistar o Selo <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
