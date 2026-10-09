import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { canManageGymForms } from '@/lib/roles';

export default async function GymFormsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || !canManageGymForms(session.role)) redirect('/gym/dashboard');
  return <>{children}</>;
}
