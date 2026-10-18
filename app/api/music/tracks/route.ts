import { NextRequest, NextResponse } from 'next/server';
import { musicService } from '@/lib/music/music-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/music/tracks
 *
 * Returns the GLOBAL approved catalog. This endpoint is intentionally
 * unauthenticated: the player is visible on the login page (pre-auth) and the
 * payload is only track metadata + a provider-hosted stream URL — no ForgeGym
 * secrets or tenant data are exposed.
 *
 * Query params:
 *   ?category=workout|high_energy|cardio|strength|cool_down
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const context = searchParams.get('context');
    const tracks = await musicService.getApprovedTracks({
      ...(category ? { category } : {}),
      ...(context ? { context } : {}),
    });
    return NextResponse.json({ data: tracks });
  } catch (error) {
    console.error('[api/music/tracks] error:', error);
    return NextResponse.json({ error: 'Music catalog unavailable' }, { status: 503 });
  }
}
