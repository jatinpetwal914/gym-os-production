import { NextResponse } from 'next/server';
import { getSession, type SessionUser } from '@/lib/session';
import { canAccessGymPortal, isSuperAdminRole } from '@/lib/roles';

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    return { session: null as SessionUser | null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { session, error: null };
}

export function requireSuperAdmin(session: SessionUser) {
  if (!isSuperAdminRole(session.role)) {
    return NextResponse.json({ error: 'Forbidden — Super Admin only' }, { status: 403 });
  }
  return null;
}

export function requirePortalOrSuperAdmin(session: SessionUser) {
  if (!canAccessGymPortal(session.role) && !isSuperAdminRole(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export function tenantGymId(session: SessionUser, fallback?: string | null) {
  if (canAccessGymPortal(session.role)) return session.gymId;
  return fallback || null;
}
