import { createUserServerClient } from '@/lib/supabase/server';
import { homePathForRole, type AppRole } from '@/lib/roles';

export interface SessionUser {
  userId: string;
  username: string;
  role: AppRole;
  gymId: string | null;
  homeBranchId: string | null;
  name: string;
  redirect: string;
}

export async function getSession(): Promise<SessionUser | null> {
  const supabase = createUserServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, full_name, role, gym_id, home_branch_id, status')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.status !== 'active') {
    return null;
  }

  return {
    userId: profile.id,
    username: profile.username,
    role: profile.role,
    gymId: profile.gym_id,
    homeBranchId: profile.home_branch_id,
    name: profile.full_name,
    redirect: homePathForRole(profile.role),
  };
}
