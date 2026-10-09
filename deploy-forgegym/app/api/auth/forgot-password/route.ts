import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';
import { createUserServerClient } from '@/lib/supabase/server';

const forgotAttempts = new Map<string, { count: number; resetAt: number }>();

function tooMany(key: string) {
  const now = Date.now();
  const current = forgotAttempts.get(key);
  if (!current || current.resetAt < now) {
    forgotAttempts.set(key, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return false;
  }
  current.count += 1;
  return current.count > 5;
}

const generic = {
  ok: true,
  message: 'If that account is registered, a reset link has been sent.',
};

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (tooMany(ip)) {
      return NextResponse.json({ error: 'Too many reset requests. Try again later.' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const login = String(body.email || body.username || '').trim();
    if (!login) {
      return NextResponse.json({ error: 'Username or email is required' }, { status: 400 });
    }

    let email = login.includes('@') ? login.toLowerCase() : '';
    if (!email) {
      const admin = createAdminClient();
      const { data: profile } = await admin
        .from('profiles')
        .select('id')
        .ilike('username', login)
        .maybeSingle();
      if (!profile) {
        return NextResponse.json(generic);
      }
      const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
      email = authUser.user?.email || '';
      if (!email) {
        return NextResponse.json(generic);
      }
    }

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const supabase = createUserServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/auth/reset`,
    });

    if (error) {
      console.error('forgot-password error:', error.message);
    }

    return NextResponse.json(generic);
  } catch {
    return NextResponse.json({ error: 'Could not process reset request' }, { status: 500 });
  }
}
