import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { canManagePlans } from '@/lib/roles';

export default async function PlansLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!canManagePlans(session.role)) redirect('/gym/dashboard');
  return <>{children}</>;
}
