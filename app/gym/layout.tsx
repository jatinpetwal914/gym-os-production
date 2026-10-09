import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { createUserServerClient } from '@/lib/supabase/server';
import { canAccessGymPortal } from '@/lib/roles';
import { Sidebar } from '@/components/sidebar';
import { GymBottomNav } from '@/components/gym/bottom-nav';
import { GymPortalProvider } from '@/components/gym/portal-context';
import { AmbientBackground } from '@/components/visual/ambient-background';

export default async function GymAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) redirect('/login');
  if (!canAccessGymPortal(session.role)) redirect('/login');

  let gymName = '';
  if (session.gymId) {
    const supabase = createUserServerClient();
    const { data } = await supabase
      .from('gyms')
      .select('name')
      .eq('id', session.gymId)
      .maybeSingle();
    gymName = data?.name || session.gymId;
  }

  return (
    <GymPortalProvider role={session.role}>
      <div className="relative flex min-h-screen bg-[#F4F7FA] text-slate-800">
        <AmbientBackground />
        <Sidebar role={session.role} gymName={gymName} />
        <main className="relative flex-1 overflow-x-hidden pb-[11.5rem] pt-4 lg:pb-8 lg:pt-20">
          <div className="relative">{children}</div>
        </main>
        <GymBottomNav />
      </div>
    </GymPortalProvider>
  );
}
