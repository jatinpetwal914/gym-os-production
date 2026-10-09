export type AppRole = 'super_admin' | 'gym_owner' | 'gym_admin' | 'manager' | 'staff' | 'trainer' | 'member';

export const gymPortalRoles: AppRole[] = ['gym_owner', 'gym_admin', 'manager', 'staff', 'trainer'];
export const deskRoles: AppRole[] = ['gym_owner', 'gym_admin', 'manager', 'staff'];
export const planRoles: AppRole[] = ['gym_owner', 'gym_admin', 'manager'];
export const elevatedGymRoles: AppRole[] = ['gym_owner', 'gym_admin'];

export function isSuperAdminRole(role: string) {
  return role === 'super_admin';
}

export function canAccessGymPortal(role: string) {
  return gymPortalRoles.includes(role as AppRole);
}

export function canManagePlans(role: string) {
  return planRoles.includes(role as AppRole) || role === 'super_admin';
}

export function canRecordPayments(role: string) {
  return deskRoles.includes(role as AppRole);
}

export function canManageMembers(role: string) {
  return deskRoles.includes(role as AppRole);
}

export function canDeleteMembers(role: string) {
  return elevatedGymRoles.includes(role as AppRole);
}

export function canCheckIn(role: string) {
  return deskRoles.includes(role as AppRole) || role === 'trainer';
}

export function canManageGymSettings(role: string) {
  return role === 'gym_owner' || role === 'super_admin';
}

export function canManageStaff(role: string) {
  return elevatedGymRoles.includes(role as AppRole);
}

export function canAccessStaffApi(role: string) {
  return canAccessGymPortal(role) || isSuperAdminRole(role);
}

export function homePathForRole(role: string) {
  if (role === 'super_admin') return '/super-admin/dashboard';
  if (canAccessGymPortal(role)) return '/gym/dashboard';
  return '/login';
}
