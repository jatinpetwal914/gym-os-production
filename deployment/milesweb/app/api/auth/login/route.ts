import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';
import { createUserServerClient } from '@/lib/supabase/server';
import { homePathForRole } from '@/lib/roles';

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;

function clientKey(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

function tooManyAttempts(key: string) {
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || current.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > LOGIN_MAX_ATTEMPTS;
}

export async function POST(request: NextRequest) {
  try {
    if (tooManyAttempts(clientKey(request))) {
      return NextResponse.json({ error: 'Too many login attempts. Try again in a few minutes.' }, { status: 429 });
    }

    const body = await request.json();
    const login = String(body.username || body.email || '').trim();
    const password = String(body.password || '');

    if (!login || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const admin = createAdminClient();
    let email = login.includes('@') ? login : '';

    if (!email) {
      const { data: profile } = await admin
        .from('profiles')
        .select('id')
        .ilike('username', login)
        .maybeSingle();

      if (!profile) {
        return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
      }

      const { data: authUser, error: userError } = await admin.auth.admin.getUserById(profile.id);
      if (userError || !authUser.user?.email) {
        return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
      }
      email = authUser.user.email;
    }

    const supabase = createUserServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status, gym_id')
      .eq('id', data.user.id)
      .maybeSingle();

    if (!profile || profile.status !== 'active') {
      await supabase.auth.signOut();
      return NextResponse.json({ error: 'This account has been disabled. Contact your administrator.' }, { status: 403 });
    }

    if (profile.role === 'member') {
      await supabase.auth.signOut();
      return NextResponse.json({ error: 'Member accounts cannot sign in to staff portals.' }, { status: 403 });
    }

    if (profile.gym_id) {
      const { data: gym } = await supabase
        .from('gyms')
        .select('status')
        .eq('id', profile.gym_id)
        .maybeSingle();
      if (gym?.status === 'suspended') {
        await supabase.auth.signOut();
        return NextResponse.json({ error: 'This gym is suspended. Contact support.' }, { status: 403 });
      }
    }

    return NextResponse.json({
      role: profile.role,
      redirect: homePathForRole(profile.role),
    });
  } catch {
    return NextResponse.json({ error: 'An error occurred during login. Please try again.' }, { status: 500 });
  }
}
