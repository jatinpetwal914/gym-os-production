import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';
import { sendGymOsPasswordSetupEmail } from '@/lib/gym-os-auth-email';
import { sanitizeMailError } from '@/lib/smtp';

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
  message: 'If that account is registered, a password setup link will be sent. Check Spam/Junk as well.',
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

    const admin = createAdminClient();
    let authEmail = login.includes('@') ? login.toLowerCase() : '';
    let deliveryEmail = authEmail;
    let fullName = '';

    if (!authEmail) {
      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('id, gym_id, full_name')
        .ilike('username', login)
        .maybeSingle();
      if (profileError) {
        console.error('forgot-password profile lookup:', profileError.message);
        return NextResponse.json(generic);
      }
      if (!profile) {
        return NextResponse.json(generic);
      }
      const { data: authUser, error: userError } = await admin.auth.admin.getUserById(profile.id);
      if (userError || !authUser.user?.email) {
        if (userError) console.error('forgot-password user lookup:', userError.message);
        return NextResponse.json(generic);
      }
      authEmail = authUser.user.email;
      deliveryEmail = authEmail;
      fullName = profile.full_name || '';

      if (authEmail.endsWith('.users.forgegym.local') && profile.gym_id) {
        const { data: gym, error: gymError } = await admin
          .from('gyms')
          .select('email, owner_name')
          .eq('id', profile.gym_id)
          .maybeSingle();
        if (gymError) {
          console.error('forgot-password gym lookup:', gymError.message);
        } else if (gym?.email) {
          deliveryEmail = gym.email;
          fullName = gym.owner_name || fullName;
        } else {
          console.error('forgot-password email skipped: gym has no owner email address');
          return NextResponse.json(generic);
        }
      }
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
    try {
      await sendGymOsPasswordSetupEmail({
        authEmail,
        recipient: deliveryEmail,
        fullName,
        firstLogin: false,
        redirectTo: new URL('/auth/reset', origin).toString(),
      });
    } catch (error) {
      console.error('forgot-password email failed:', sanitizeMailError(error));
    }

    return NextResponse.json(generic);
  } catch (error) {
    console.error('forgot-password request failed:', sanitizeMailError(error));
    return NextResponse.json({ error: 'Could not process reset request' }, { status: 500 });
  }
}
