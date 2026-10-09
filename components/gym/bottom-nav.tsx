'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, CreditCard, LayoutDashboard, QrCode, Users, Wallet } from 'lucide-react';
import { canManageGymForms, canManagePlans, canRecordPayments } from '@/lib/roles';
import { useGymPortal } from '@/components/gym/portal-context';

const items = [
  { href: '/gym/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/gym/members', label: 'Members', icon: Users },
  { href: '/gym/attendance', label: 'Scan', icon: QrCode, center: true },
  { href: '/gym/plans', label: 'Plans', icon: CreditCard },
  { href: '/gym/payments', label: 'Pay', icon: Wallet },
  { href: '/gym/forms', label: 'Forms', icon: ClipboardList },
];

export function GymBottomNav() {
  const pathname = usePathname();
  const { role } = useGymPortal();
  const visible = items.filter((item) => {
    if (item.href === '/gym/plans') return canManagePlans(role);
    if (item.href === '/gym/payments') return canRecordPayments(role);
    if (item.href === '/gym/forms') return canManageGymForms(role);
    return true;
  });
  const columns =
    visible.length >= 6 ? 'grid-cols-6' : visible.length === 5 ? 'grid-cols-5' : 'grid-cols-3';

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#DAE1E7] bg-white/95 px-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur lg:hidden">
      <div className={`mx-auto grid max-w-lg items-end ${columns}`}>
        {visible.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || (item.href !== '/gym/dashboard' && pathname.startsWith(item.href));

          if (item.center) {
            return (
              <Link key={item.href} href={item.href} className="-mt-4 flex flex-col items-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2064B6] text-white shadow-[0_8px_20px_rgba(32,100,182,0.28)] ring-4 ring-white">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="mt-0.5 text-[10px] font-semibold text-[#2064B6]">{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-1 text-[10px] font-medium ${
                active ? 'text-slate-800' : 'text-slate-400'
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? 'text-[#2064B6]' : 'text-slate-400'}`} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
