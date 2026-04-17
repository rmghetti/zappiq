'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Cookie, ChevronDown, ChevronUp, Shield } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════
 * CookieBanner — LGPD Art. 7, I (consentimento granular)
 *
 * Categorias:
 *   • essential  — sempre ativo, não desligável (sessão, CSRF, consent)
 *   • analytics  — PostHog, métricas de uso (Art. 7, IX leg. interest → consent)
 *   • marketing  — remarketing, campanhas, pixels (requer consent explícito)
 *
 * Armazena em localStorage como JSON: { analytics: bool, marketing: bool, ts: ISO }
 * Migra automaticamente o formato antigo ('all' | 'essential') para o novo.
 *
 * Exporta helpers:
 *   hasAnalyticsConsent()  — usado por track.ts
 *   hasMarketingConsent()  — usado por pixels/tag manager
 *   getConsentState()      — estado completo
 *   revokeConsent()        — LGPD Art. 18, IX (revogação)
 * ═══════════════════════════════════════════════════════════════════════ */

const CONSENT_KEY = 'zq_cookie_consent';

export interface ConsentState {
  analytics: boolean;
  marketing: boolean;
  ts: string; // ISO date do consentimento
}

/* ------------------------------------------------------------------ */
/* Helpers públicos                                                     */
/* ------------------------------------------------------------------ */

function readConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(CONSENT_KEY);
  if (!raw) return null;

  // Migração do formato antigo (v1: 'all' | 'essential')
  if (raw === 'all') {
    const migrated: ConsentState = { analytics: true, marketing: true, ts: new Date().toISOString() };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(migrated));
    return migrated;
  }
  if (raw === 'essential') {
    const migrated: ConsentState = { analytics: false, marketing: false, ts: new Date().toISOString() };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(migrated));
    return migrated;
  }

  try {
    return JSON.parse(raw) as ConsentState;
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent(): boolean {
  return readConsent()?.analytics === true;
}

export function hasMarketingConsent(): boolean {
  return readConsent()?.marketing === true;
}

export function getConsentState(): ConsentState | null {
  return readConsent();
}

/** LGPD Art. 18, IX — revogação total de consentimento */
export function revokeConsent(): void {
  if (typeof window === 'undefined') return;
  const revoked: ConsentState = { analytics: false, marketing: false, ts: new Date().toISOString() };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(revoked));
}

/* ------------------------------------------------------------------ */
/* Componente                                                          */
/* ------------------------------------------------------------------ */

export function CookieBanner() {
  const [mounted, setMounted] = useState(false);
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Granular toggles (default off per LGPD — consent must be opt-in)
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = readConsent();
    if (stored) setConsent(stored);
  }, []);

  const save = useCallback((state: ConsentState) => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(state));
    setConsent(state);
  }, []);

  const handleAcceptAll = useCallback(() => {
    save({ analytics: true, marketing: true, ts: new Date().toISOString() });
  }, [save]);

  const handleRejectAll = useCallback(() => {
    save({ analytics: false, marketing: false, ts: new Date().toISOString() });
  }, [save]);

  const handleSavePreferences = useCallback(() => {
    save({ analytics, marketing, ts: new Date().toISOString() });
  }, [analytics, marketing, save]);

  // SSR: null. Already consented: null.
  if (!mounted || consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Consentimento de cookies"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-2xl"
    >
      <div className="max-w-5xl mx-auto px-4 py-5 sm:px-6">
        {/* Linha principal */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <Cookie size={18} className="text-primary-600" />
            </div>
            <div className="text-sm text-gray-700 leading-relaxed">
              <p>
                Usamos cookies essenciais para o funcionamento do site. Cookies de
                analytics e marketing são <strong>opcionais</strong> e só ativados com
                seu consentimento explícito (LGPD Art. 7, I).{' '}
                <Link href="/legal/cookies" className="underline text-primary-600 hover:text-primary-800">
                  Política de Cookies
                </Link>
                {' · '}
                <Link href="/legal/privacidade" className="underline text-primary-600 hover:text-primary-800">
                  Privacidade
                </Link>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowDetails((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Personalizar
              {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button
              onClick={handleRejectAll}
              className="px-3.5 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Rejeitar opcionais
            </button>
            <button
              onClick={handleAcceptAll}
              className="px-3.5 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
            >
              Aceitar todos
            </button>
          </div>
        </div>

        {/* Painel de detalhes granulares */}
        {showDetails && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="grid sm:grid-cols-3 gap-4">
              {/* Essential — sempre on */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Shield size={14} className="text-gray-500" />
                    <span className="text-sm font-semibold text-gray-900">Essenciais</span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Sempre ativo</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Sessão, autenticação, CSRF, preferências de consentimento. Necessários
                  para o funcionamento do site.
                </p>
              </div>

              {/* Analytics */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-900">Analytics</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={analytics}
                      onChange={(e) => setAnalytics(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-300 peer-checked:bg-primary-500 rounded-full transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                  </label>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  PostHog e métricas de uso. Nos ajudam a entender como você navega para
                  melhorar a experiência. Sem identificação pessoal.
                </p>
              </div>

              {/* Marketing */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-900">Marketing</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={marketing}
                      onChange={(e) => setMarketing(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-300 peer-checked:bg-primary-500 rounded-full transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                  </label>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Pixels de remarketing e campanhas. Permitem mostrar anúncios relevantes
                  em outras plataformas.
                </p>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={handleSavePreferences}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
              >
                Salvar preferências
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
