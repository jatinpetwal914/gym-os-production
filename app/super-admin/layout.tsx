import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { Sidebar } from '@/components/sidebar';
import { AmbientBackground } from '@/components/visual/ambient-background';

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) redirect('/login');
  if (session.role !== 'super_admin') redirect('/gym/dashboard');

  return (
    <div className="relative flex min-h-screen bg-[#F4F7FA] text-slate-800">
      <AmbientBackground />
      <Sidebar role={session.role} />
      <main className="relative flex-1 overflow-x-hidden pb-24 pt-16 lg:pb-8 lg:pt-20">
        <div className="relative">{children}</div>
      </main>
    </div>
  );
}
