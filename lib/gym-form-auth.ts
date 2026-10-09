import { NextResponse } from 'next/server';
import { getSession, type SessionUser } from '@/lib/session';
import { canManageGymForms } from '@/lib/roles';

export async function requireGymFormsSession(): Promise<
  { error: NextResponse } | { session: SessionUser & { gymId: string } }
> {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!canManageGymForms(session.role) || !session.gymId) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session: { ...session, gymId: session.gymId } };
}
