'use client';

import { useState, useEffect, useCallback } from 'react';

const COOKIE_CONSENT_KEY = 'zq_cookie_consent';

type ConsentLevel = 'all' | 'essential' | null;

/**
 * LGPD-compliant cookie consent banner.
 *
 * - Blocks PostHog/analytics tracking until user explicitly consents.
 * - Stores consent in localStorage (not cookies, to avoid circular dependency).
 * - Re-renders on mount to avoid hydration mismatch (SSR always returns null).
 */
export function CookieBanner() {
  const [consent, setConsent] = useState<ConsentLevel>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (stored === 'all' || stored === 'essential') {
      setConsent(stored);
    }
  }, []);

  const handleAcceptAll = useCallback(() => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'all');
    setConsent('all');
  }, []);

  const handleEssentialOnly = useCallback(() => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'essential');
    setConsent('essential');
  }, []);

  // SSR: render nothing. Client: render nothing if consent already given.
  if (!mounted || consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Consentimento de cookies"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg px-4 py-4 sm:px-6 sm:py-5"
    >
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1 text-sm text-gray-700 leading-relaxed">
          <p>
            Usamos cookies essenciais para o funcionamento do site e cookies de
            analytics para entender como voce usa a plataforma. Voce pode aceitar
            todos ou apenas os essenciais. Saiba mais na nossa{' '}
            <a
              href="/legal/privacidade"
              className="underline text-indigo-600 hover:text-indigo-800"
            >
              Politica de Privacidade
            </a>
            .
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={handleEssentialOnly}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Apenas essenciais
          </button>
          <button
            onClick={handleAcceptAll}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Aceitar todos
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper: check if user has consented to analytics cookies.
 * Use this before firing PostHog/GA events.
 */
export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(COOKIE_CONSENT_KEY) === 'all';
}
