'use client';

import { hasAnalyticsConsent } from '@/components/shared/CookieBanner';

/**
 * Track analytics events to the backend.
 * Supported events:
 * - hero_cta_clicked: User clicked CTA on hero section
 * - roi_calc_submitted: User submitted ROI calculator
 * - register_started: User started registration process
 * - register_completed: User completed registration
 * - onboarding_step_completed: User completed a step in wizard
 * - onboarding_completed: User finished entire onboarding
 * - onboarding_skipped: User skipped onboarding
 * - ai_training_doc_uploaded: Document uploaded for training
 * - readiness_milestone_60: AI readiness score reached 60%
 * - trial_savings_banner_expanded: Trial savings banner was expanded
 * - trial_savings_banner_cta_clicked: User clicked CTA in trial savings banner
 */
export interface TrackEvent {
  event: string;
  userId?: string;
  sessionId?: string;
  timestamp?: string;
  properties?: Record<string, any>;
  [key: string]: any;
}

// ─────────────────────────────────────────
// PostHog Configuration & Helpers
// ─────────────────────────────────────────

const POSTHOG_API_KEY = process.env.NEXT_PUBLIC_POSTHOG_API_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let eventQueue: Array<{ event: string; props?: Record<string, any> }> = [];
let debounceTimer: NodeJS.Timeout | null = null;

/**
 * Get or generate distinct_id from localStorage (UUID v4).
 * If user is logged in, use user.id as distinct_id.
 */
function getDistinctId(): string {
  if (typeof window === 'undefined') return 'unknown';

  // Check if user is logged in
  const userStr = localStorage.getItem('zappiq_user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user?.id) return user.id;
    } catch {
      // Invalid JSON, fall through
    }
  }

  // Generate or retrieve anonymous distinct_id
  let distinctId = localStorage.getItem('zq_distinct_id');
  if (!distinctId) {
    distinctId = crypto.randomUUID?.() || `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('zq_distinct_id', distinctId);
  }
  return distinctId;
}

/**
 * Enrich event with context (URL, referrer, user agent, variant, timestamp).
 */
function enrichEvent(event: string, props?: Record<string, any>): Record<string, any> {
  const enriched: Record<string, any> = {
    event,
    distinct_id: getDistinctId(),
    timestamp: new Date().toISOString(),
    properties: {
      ...props,
    },
  };

  if (typeof window !== 'undefined') {
    enriched.properties.$current_url = window.location.href;
    enriched.properties.$referrer = document.referrer || '';
    enriched.properties.$user_agent = navigator.userAgent;

    // A/B variant from cookie if present
    const variantCookie = document.cookie
      .split('; ')
      .find((c) => c.startsWith('ab_variant='));
    if (variantCookie) {
      enriched.properties.variant = variantCookie.split('=')[1];
    }
  }

  return enriched;
}

/**
 * Send batch of events to PostHog via /capture/ endpoint.
 */
async function flushPostHogBatch(batch: Array<Record<string, any>>): Promise<void> {
  if (!POSTHOG_API_KEY || batch.length === 0) return;

  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_API_KEY,
        batch: batch,
      }),
      // Fire-and-forget: no await on response, timeout 2s
      signal: AbortSignal.timeout(2000),
    });
  } catch (err) {
    console.warn('[PostHog] Batch send failed:', err);
  }
}

/**
 * Debounced flush of queued events (200ms).
 */
function scheduleFlush(): void {
  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(async () => {
    if (eventQueue.length === 0) return;

    const batch = eventQueue.map(({ event, props }) => enrichEvent(event, props));
    eventQueue = [];

    // Send to PostHog (fire-and-forget)
    flushPostHogBatch(batch);

    // Also send to internal API
    if (typeof fetch !== 'undefined') {
      try {
        await fetch('/api/analytics/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: batch.length > 1 ? 'batch' : batch[0]?.event,
            timestamp: new Date().toISOString(),
            properties: { batch },
          }),
        });
      } catch (err) {
        console.warn('[Analytics] Failed to track batch:', err);
      }
    }
  }, 200);
}

export async function track(event: string, props?: Record<string, any>): Promise<void> {
  // Respect LGPD cookie consent — only track if user accepted analytics
  if (!hasAnalyticsConsent()) {
    console.debug('[Analytics] Skipped (no consent):', event);
    return;
  }

  console.info('[Analytics] Track event:', event, props);

  // Queue event for batching
  eventQueue.push({ event, props });
  scheduleFlush();
}

/**
 * Identify user with traits (call after login).
 * Sends $identify event to PostHog.
 */
export async function identify(userId: string, traits?: Record<string, any>): Promise<void> {
  if (typeof window === 'undefined') return;

  // Respect LGPD cookie consent
  if (!hasAnalyticsConsent()) {
    console.debug('[Analytics] Identify skipped (no consent):', userId);
    return;
  }

  // Update localStorage distinct_id to user id
  localStorage.setItem('zq_distinct_id', userId);

  console.info('[Analytics] Identify user:', userId, traits);

  const payload = {
    api_key: POSTHOG_API_KEY,
    batch: [
      {
        event: '$identify',
        distinct_id: userId,
        properties: {
          $set: traits || {},
          $set_once: {
            email: traits?.email,
            organizationId: traits?.organizationId,
          },
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  if (POSTHOG_API_KEY) {
    try {
      await fetch(`${POSTHOG_HOST}/capture/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(2000),
      });
    } catch (err) {
      console.warn('[PostHog] Identify failed:', err);
    }
  }
}

/**
 * Reset tracking (call on logout).
 * Clears distinct_id and anonymous session.
 */
export function reset(): void {
  if (typeof window === 'undefined') return;

  console.info('[Analytics] Reset tracking');
  localStorage.removeItem('zq_distinct_id');

  // Generate fresh anonymous ID for new session
  const newDistinctId = crypto.randomUUID?.() || `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem('zq_distinct_id', newDistinctId);
}
