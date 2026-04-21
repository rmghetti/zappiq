'use client';

import { useEffect, useState } from 'react';

const COOKIE_TTL = 90 * 24 * 60 * 60 * 1000; // 90 days in ms

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

function setCookie(name: string, value: string, ttl: number = COOKIE_TTL): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + ttl).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

export function getVariant(experimentKey: string, variants: string[]): string {
  if (variants.length === 0) return '';

  // Server-side: only read, don't set
  if (typeof document === 'undefined') {
    const cookie = getCookie(`zq_ab_${experimentKey}`);
    return cookie && variants.includes(cookie) ? cookie : variants[0];
  }

  // Client-side: read or set
  const cookie = getCookie(`zq_ab_${experimentKey}`);
  if (cookie && variants.includes(cookie)) {
    return cookie;
  }

  const selected = variants[Math.floor(Math.random() * variants.length)];
  setCookie(`zq_ab_${experimentKey}`, selected);
  return selected;
}

let debounceTimers: Record<string, NodeJS.Timeout> = {};

export function trackVariantExposure(key: string, variant: string, userId?: string, fingerprint?: string): void {
  // Debounce: only track once per minute per experiment key
  if (debounceTimers[key]) {
    clearTimeout(debounceTimers[key]);
  }

  debounceTimers[key] = setTimeout(() => {
    const payload = { key, variant, userId, fingerprint };
    console.info('[AB Test] Variant exposure:', payload);

    if (typeof fetch !== 'undefined') {
      fetch('/api/analytics/experiment-exposure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(err => console.warn('[AB Test] Failed to track exposure:', err));
    }

    delete debounceTimers[key];
  }, 100);
}

export function useExperiment(experimentKey: string, variants: string[]): string {
  const [variant, setVariant] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const selected = getVariant(experimentKey, variants);
    setVariant(selected);
    setMounted(true);
  }, [experimentKey, variants]);

  return mounted ? variant : variants[0];
}
