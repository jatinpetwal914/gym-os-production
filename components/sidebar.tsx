'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  QrCode,
  Dumbbell,
  Music2,
  LogOut,
  Menu,
  X,
  Wallet,
  ClipboardList,
} from 'lucide-react';

import { isSuperAdminRole, canManagePlans, canRecordPayments, canManageGymForms } from '@/lib/roles';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const gymAdminNav: NavItem[] = [
  { label: 'Dashboard', href: '/gym/dashboard', icon: LayoutDashboard },
  { label: 'Members', href: '/gym/members', icon: Users },
  { label: 'Attendance', href: '/gym/attendance', icon: QrCode },
  { label: 'Plans', href: '/gym/plans', icon: CreditCard },
  { label: 'Payments', href: '/gym/payments', icon: Wallet },
  { label: 'Forms', href: '/gym/forms', icon: ClipboardList },
];

const superAdminNav: NavItem[] = [
  { label: 'Dashboard', href: '/super-admin/dashboard', icon: LayoutDashboard },
  { label: 'Gyms', href: '/super-admin/gyms', icon: Dumbbell },
  { label: 'Music Library', href: '/super-admin/music', icon: Music2 },
];

export function Sidebar({ role, gymName }: { role: string; gymName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = isSuperAdminRole(role)
    ? superAdminNav
    : gymAdminNav.filter((item) => {
        if (item.href === '/gym/plans') return canManagePlans(role);
        if (item.href === '/gym/payments') return canRecordPayments(role);
        if (item.href === '/gym/forms') return canManageGymForms(role);
        return true;
      });
  const isSuper = isSuperAdminRole(role);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const SidebarContent = (
    <div className="relative flex h-full flex-col">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-[#2064B6]/0 via-[#6DCCC3] to-[#2064B6]/0" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(109,204,195,0.22),transparent_70%)]" />

      <div className="relative flex h-16 items-center gap-2.5 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2064B6] text-white">
          <Dumbbell className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold tracking-tight text-slate-800">Gym OS</p>
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
            {isSuper ? 'Super Admin' : 'Gym Admin'}
          </p>
        </div>
      </div>

      {gymName && (
        <div className="relative mx-4 mb-2 rounded-xl border border-[#DAE1E7] bg-[#F4F7FA] px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Current gym</p>
          <p className="truncate text-sm font-medium text-slate-800">{gymName}</p>
        </div>
      )}

      <nav className="relative flex-1 space-y-1 px-3 py-3">
        {nav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#2064B6]/10 text-slate-800 shadow-[inset_0_0_0_1px_rgba(32,100,182,0.22)]'
                  : 'text-slate-500 hover:bg-[#F4F7FA] hover:text-slate-800'
              }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  isActive ? 'bg-[#2064B6] text-white' : 'bg-[#F4F7FA] text-slate-400 group-hover:text-slate-600'
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="relative border-t border-[#DAE1E7] p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F4F7FA]">
            <LogOut className="h-4 w-4" />
          </span>
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 flex-shrink-0 flex-col border-r border-[#DAE1E7] bg-white pt-16 lg:flex">
        {SidebarContent}
      </aside>

      <div className={`fixed inset-x-0 top-0 z-40 h-14 items-center justify-between border-b border-[#DAE1E7] bg-white/95 px-4 backdrop-blur ${isSuper ? 'flex lg:hidden' : 'hidden'}`}>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2064B6] text-white">
            <Dumbbell className="h-3.5 w-3.5" />
          </div>
          <span className="font-semibold text-slate-800">Gym OS</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-slate-500 hover:bg-[#F4F7FA]" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-[110] bg-black/60 lg:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 350, damping: 32 }}
              className="fixed left-0 top-0 z-[120] h-full w-64 border-r border-[#DAE1E7] bg-white pt-16 lg:hidden"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-20 rounded-lg p-1.5 text-slate-400 hover:bg-[#F4F7FA] hover:text-slate-800"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
              {SidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
