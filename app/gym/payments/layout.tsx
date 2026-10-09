import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { canRecordPayments } from '@/lib/roles';

export default async function PaymentsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!canRecordPayments(session.role)) redirect('/gym/dashboard');
  return <>{children}</>;
}
