'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Calendar,
  Copy,
  DollarSign,
  Loader2,
  Lock,
  LogOut,
  QrCode,
  TrendingUp,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { GymMemberCard, type GymMemberCardData } from '@/components/gym/member-card';
import { formatClock } from '@/lib/member-visual';
import { QueryState } from '@/components/query-state';
import { OrbitRing } from '@/components/visual/orbit-ring';

interface Stats {
  totalMembers: number;
  activeMembers: number;
  expiringMembers: number;
  expiredMembers: number;
  totalRevenue: number;
  todayAttendance: number;
  insideNow: number;
  leftToday: number;
}

interface FloorMember extends GymMemberCardData {
  attendanceId: string;
  check_in_time: string | null;
  check_out_time: string | null;
}

export default function GymDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [attendanceData, setAttendanceData] = useState<{ date: string; count: number }[]>([]);
  const [revenueData, setRevenueData] = useState<{ month: string; revenue: number }[]>([]);
  const [inside, setInside] = useState<FloorMember[]>([]);
  const [left, setLeft] = useState<FloorMember[]>([]);
  const [floorTab, setFloorTab] = useState<'inside' | 'left'>('inside');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [resetError, setResetError] = useState('');

  const fetchDashboard = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/dashboard', { signal });
      const data = await res.json();
      if (signal?.aborted) return;
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load dashboard');
      }
      if (!data.stats) throw new Error('Dashboard response was incomplete.');
      setStats(data.stats);
      setAttendanceData(data.attendanceChart || []);
      setRevenueData(data.revenueChart || []);
      setInside(data.floor?.inside || []);
      setLeft(data.floor?.left || []);
      setError('');
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    let activeRequest: AbortController | null = null;
    let disposed = false;

    const poll = () => {
      if (disposed || document.visibilityState !== 'visible') return;

      const controller = new AbortController();
      activeRequest = controller;
      void fetchDashboard(controller.signal).finally(() => {
        if (activeRequest === controller) activeRequest = null;
        if (!disposed && !controller.signal.aborted && document.visibilityState === 'visible') {
          timer = window.setTimeout(poll, 20000);
        }
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (timer !== undefined) window.clearTimeout(timer);
        timer = undefined;
        activeRequest?.abort();
        activeRequest = null;
      } else if (!activeRequest && timer === undefined) {
        poll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    poll();

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timer !== undefined) window.clearTimeout(timer);
      activeRequest?.abort();
    };
  }, [fetchDashboard]);

  const handleResetPassword = async () => {
    setResettingPassword(true);
    setResetError('');
    setTempPassword(null);
    try {
      const res = await fetch('/api/auth/reset-password', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      if (data.data?.temporaryPassword) {
        setTempPassword(data.data.temporaryPassword);
      } else {
        setResetError('Password reset, but no new password returned.');
      }
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  };

  const checkoutMember = async (attendanceId: string) => {
    try {
      const res = await fetch(`/api/attendance/${attendanceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = res.status === 409 ? null : await res.json();
      if (!res.ok && res.status !== 409) {
        throw new Error(data?.error || 'Failed to check out member');
      }
      await fetchDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check out member');
    }
  };

  if (loading && !stats) {
    return (
      <div className="p-8">
        <QueryState loading error={null} empty={false}>
          <span />
        </QueryState>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8">
        <QueryState loading={false} error={error || 'Dashboard data is unavailable.'} empty={false}>
          <span />
        </QueryState>
      </div>
    );
  }

  const highlightCards = [
    { label: 'On the floor', value: stats?.insideNow ?? 0, icon: UserCheck },
    { label: 'Left today', value: stats?.leftToday ?? 0, icon: LogOut },
    { label: 'Total members', value: stats?.totalMembers ?? 0, icon: Users },
    { label: 'Expired members', value: stats.expiredMembers, icon: UserX },
    {
      label: 'Revenue',
      value: `₹${stats.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      icon: DollarSign,
    },
    { label: "Today's visits", value: stats?.todayAttendance ?? 0, icon: Calendar },
  ];

  const floorMembers = floorTab === 'inside' ? inside : left;

  return (
    <div className="px-4 py-5 lg:p-8">
      {error && (
        <div role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="admin-kicker">Live desk</p>
          <h1 className="admin-page-title">Who is in the gym</h1>
          <p className="admin-page-sub">Scan a member QR to check them in or out.</p>
        </div>
        <Link
          href="/gym/attendance"
          className="admin-primary-btn hidden lg:inline-flex"
        >
          <QrCode className="h-4 w-4" />
          Scan
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {highlightCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28, delay: i * 0.04 }}
              className="admin-stat gym-card-hover min-h-[132px] p-4"
            >
              <OrbitRing />
              <Icon className="relative mb-6 h-4 w-4 text-[#2064B6]" />
              <p className="relative text-3xl font-semibold tracking-tight text-slate-800">{card.value}</p>
              <p className="relative mt-1 text-xs text-slate-400">{card.label}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="admin-surface mt-6 p-4">
        <div className="mb-4 flex rounded-2xl bg-white p-1">
          <button
            onClick={() => setFloorTab('inside')}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ${
              floorTab === 'inside' ? 'bg-[#2064B6] text-white' : 'text-slate-400'
            }`}
          >
            Inside now ({inside.length})
          </button>
          <button
            onClick={() => setFloorTab('left')}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ${
              floorTab === 'left' ? 'bg-[#2064B6] text-white' : 'text-slate-400'
            }`}
          >
            Left today ({left.length})
          </button>
        </div>

        {floorMembers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#DAE1E7] py-10 text-center text-sm text-slate-400">
            {floorTab === 'inside' ? 'No one is checked in right now.' : 'No check-outs yet today.'}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {floorMembers.map((member) => (
              <div key={member.attendanceId} className="space-y-2">
                <GymMemberCard
                  member={member}
                  href={`/gym/members/${member.id}`}
                  meta={
                    floorTab === 'inside'
                      ? `In since ${formatClock(member.check_in_time)}`
                      : `Left at ${formatClock(member.check_out_time)}`
                  }
                />
                {floorTab === 'inside' && (
                  <button
                    onClick={() => checkoutMember(member.attendanceId)}
                    className="admin-secondary-btn w-full justify-center py-2 text-xs"
                  >
                    Check out
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="admin-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Attendance</h2>
            <TrendingUp className="h-4 w-4 text-[#2064B6]" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={attendanceData}>
              <defs>
                <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2064B6" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#6DCCC3" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#DAE1E7" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #DAE1E7', background: '#ffffff', color: '#163A5F', fontSize: '12px' }} />
              <Area type="monotone" dataKey="count" stroke="#2064B6" strokeWidth={2} fill="url(#attendanceGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="admin-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Revenue</h2>
            <DollarSign className="h-4 w-4 text-[#2064B6]" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DAE1E7" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid #DAE1E7', background: '#ffffff', color: '#163A5F', fontSize: '12px' }}
                formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Revenue']}
              />
              <Bar dataKey="revenue" fill="#6DCCC3" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="admin-surface mt-6 p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Account security</h2>
        <p className="text-sm text-slate-500">Reset your gym admin password if you need a fresh temporary login.</p>
        <button
          onClick={handleResetPassword}
          disabled={resettingPassword}
          className="admin-secondary-btn mt-4 disabled:opacity-60"
        >
          {resettingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {resettingPassword ? 'Resetting…' : 'Reset password'}
        </button>
        {tempPassword && (
          <div className="mt-4 rounded-2xl border border-[#DAE1E7] bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-[#2064B6]">Temporary password</p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(tempPassword);
                  setTempPassword(null);
                }}
                className="rounded p-1 text-[#2064B6]"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <code className="block select-all font-mono text-sm text-slate-800">{tempPassword}</code>
          </div>
        )}
        {resetError && <p className="mt-2 text-sm text-red-300">{resetError}</p>}
      </div>
    </div>
  );
}
