import { NextRequest, NextResponse } from 'next/server';

const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

/**
 * Forward events to PostHog for server-side tracking.
 * This captures events even if client-side is blocked by adblocker.
 */
async function forwardToPostHog(batch: any[]): Promise<void> {
  if (!POSTHOG_API_KEY || batch.length === 0) return;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_API_KEY,
        batch,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
  } catch (err) {
    console.warn('[PostHog Forward] Failed:', err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, userId, sessionId, timestamp, properties } = body;

    // Log for now; later integrate with PostHog, Segment, GA, or custom analytics
    console.info('[Analytics Event]', {
      event,
      userId,
      sessionId,
      timestamp,
      properties,
    });

    // Server-side forward to PostHog (fire-and-forget)
    if (properties?.batch && Array.isArray(properties.batch)) {
      forwardToPostHog(properties.batch);
    }

    return NextResponse.json({ success: true }, { status: 202 });
  } catch (err) {
    console.error('[Analytics Event] Error:', err);
    return NextResponse.json({ error: 'Failed to track event' }, { status: 400 });
  }
}
