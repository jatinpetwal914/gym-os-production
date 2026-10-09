import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase-server';
import { requirePortalOrSuperAdmin } from '@/lib/api-auth';
import crypto from 'crypto';

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const forbidden = requirePortalOrSuperAdmin(session);
  if (forbidden) return forbidden;

  const password = crypto.randomBytes(12).toString('base64url');
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(session.userId, { password });
  if (error) {
    return NextResponse.json({ error: 'Could not reset password' }, { status: 500 });
  }

  return NextResponse.json({ password });
}
