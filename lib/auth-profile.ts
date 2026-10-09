import type { User } from '@supabase/supabase-js';
import type { AppRole } from '@/lib/roles';
import { createAdminClient } from '@/lib/supabase-server';

const TENANT_ROLES: AppRole[] = [
  'gym_owner',
  'gym_admin',
  'manager',
  'staff',
  'trainer',
  'member',
];

export class ProfileClaimError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ProfileClaimError';
    this.status = status;
  }
}

type AdminClient = ReturnType<typeof createAdminClient>;

export function validateProfileClaims(input: {
  role: string;
  gymId?: string | null;
  homeBranchId?: string | null;
}) {
  if (input.role === 'super_admin') {
    if (input.gymId) {
      throw new ProfileClaimError('super_admin must not have a gym_id');
    }
    return;
  }

  if (!TENANT_ROLES.includes(input.role as AppRole)) {
    throw new ProfileClaimError('Invalid role');
  }

  if (!input.gymId) {
    throw new ProfileClaimError('gym_id is required for tenant users');
  }
}

export async function ensureProfileForAuthUser(
  admin: AdminClient,
  profile: {
    id: string;
    username: string;
    fullName: string;
    role: AppRole;
    gymId: string | null;
    homeBranchId?: string | null;
  }
) {
  validateProfileClaims({
    role: profile.role,
    gymId: profile.gymId,
    homeBranchId: profile.homeBranchId,
  });

  const row = {
    id: profile.id,
    username: profile.username,
    full_name: profile.fullName,
    role: profile.role,
    gym_id: profile.role === 'super_admin' ? null : profile.gymId,
    home_branch_id: profile.role === 'super_admin' ? null : profile.homeBranchId ?? null,
    status: 'active' as const,
  };

  const { error: insertError } = await admin.from('profiles').insert(row);

  if (insertError && insertError.code !== '23505') {
    throw insertError;
  }

  const { data: resolved, error: selectError } = await admin
    .from('profiles')
    .select('id, username, role, gym_id, home_branch_id, status')
    .eq('id', profile.id)
    .maybeSingle();

  if (selectError) throw selectError;

  if (!resolved) {
    throw new ProfileClaimError(
      insertError?.code === '23505' ? 'Username already exists' : 'Profile could not be resolved after user creation',
      insertError?.code === '23505' ? 409 : 500
    );
  }

  if (resolved.role !== profile.role) {
    throw new ProfileClaimError('Profile role mismatch', 500);
  }

  if (profile.role === 'super_admin') {
    if (resolved.gym_id !== null || resolved.home_branch_id !== null) {
      throw new ProfileClaimError('super_admin profile must have null gym and branch', 500);
    }
  } else if (resolved.gym_id !== profile.gymId) {
    throw new ProfileClaimError('Profile gym_id mismatch', 500);
  }

  return resolved;
}

export async function createTenantAuthUser(
  admin: AdminClient,
  input: {
    email: string;
    password: string;
    username: string;
    fullName: string;
    role: Exclude<AppRole, 'super_admin'>;
    gymId: string;
    homeBranchId?: string | null;
  }
) {
  validateProfileClaims({
    role: input.role,
    gymId: input.gymId,
    homeBranchId: input.homeBranchId,
  });

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    app_metadata: {
      role: input.role,
      gym_id: input.gymId,
      username: input.username,
      ...(input.homeBranchId ? { home_branch_id: input.homeBranchId } : {}),
    },
    user_metadata: { full_name: input.fullName },
  });

  if (createError || !created.user) {
    const duplicate =
      createError?.status === 422 ||
      /already|registered|exists/i.test(createError?.message || '');
    throw new ProfileClaimError(
      duplicate ? 'User already exists' : 'Failed to create auth user',
      duplicate ? 409 : 500
    );
  }

  try {
    const profile = await ensureProfileForAuthUser(admin, {
      id: created.user.id,
      username: input.username,
      fullName: input.fullName,
      role: input.role,
      gymId: input.gymId,
      homeBranchId: input.homeBranchId ?? null,
    });
    return { user: created.user as User, profile };
  } catch (error) {
    await admin.auth.admin.deleteUser(created.user.id);
    throw error;
  }
}
