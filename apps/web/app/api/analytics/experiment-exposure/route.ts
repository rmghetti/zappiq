import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, variant, userId, fingerprint } = body;

    // Log for now; later integrate with PostHog, GA, or custom analytics
    console.info('[Experiment Exposure] Key:', key, 'Variant:', variant, 'UserId:', userId, 'Fingerprint:', fingerprint);

    return NextResponse.json({ success: true }, { status: 202 });
  } catch (err) {
    console.error('[Experiment Exposure] Error:', err);
    return NextResponse.json({ error: 'Failed to track exposure' }, { status: 400 });
  }
}
