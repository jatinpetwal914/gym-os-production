'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Dumbbell, Users, DollarSign, TrendingUp, Building2, Clock, UserX } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { QueryState } from '@/components/query-state';

interface SuperStats {
  totalGyms: number;
  totalMembers: number;
  activeMembers: number;
  expiringMembers: number;
  expiredMembers: number;
  totalRevenue: number;
  todayAttendance: number;
}

interface GymRow {
  id: string;
  gym_id: string;
  name: string;
  owner_name: string | null;
  status: string;
  member_count: number;
  revenue: number;
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<SuperStats | null>(null);
  const [gyms, setGyms] = useState<GymRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load dashboard');
      if (!data.stats) throw new Error('Dashboard response was incomplete.');
      setStats(data.stats);
      setGyms(data.gyms || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading && !stats) {
    return (
      <div className="p-8">
        <QueryState loading empty={false}>
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

  const cards = [
    { label: 'Total Gyms', value: stats.totalGyms, icon: Building2, color: 'text-slate-800', bg: 'bg-white' },
    { label: 'Total Members', value: stats.totalMembers, icon: Users, color: 'text-[#2064B6]', bg: 'bg-[#6DCCC3]/20' },
    { label: 'Active', value: stats.activeMembers, icon: TrendingUp, color: 'text-[#2064B6]', bg: 'bg-[#6DCCC3]/20' },
    { label: 'Expiring', value: stats.expiringMembers, icon: Clock, color: 'text-slate-600', bg: 'bg-white' },
    { label: 'Expired', value: stats.expiredMembers, icon: UserX, color: 'text-red-300', bg: 'bg-red-500/10' },
    { label: 'Total Revenue', value: `₹${stats.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: DollarSign, color: 'text-slate-800', bg: 'bg-white' },
    { label: 'Today\'s Attendance', value: stats.todayAttendance, icon: Dumbbell, color: 'text-[#2064B6]', bg: 'bg-[#6DCCC3]/20' },
  ];

  return (
    <div className="p-6 lg:p-8">
      {error && (
        <div role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="mb-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#2064B6]">Platform</p>
        <h1 className="admin-page-title">Overview</h1>
        <p className="admin-page-sub">Every gym, member, and dollar across ForgeGym.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-7">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.2 }}
              className="admin-stat"
            >
              <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${card.bg}`}>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
              <p className="admin-page-title">{card.value}</p>
              <p className="mt-0.5 text-xs text-slate-400">{card.label}</p>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="admin-surface mt-6 p-5"
      >
        <h2 className="mb-4 text-sm font-semibold text-slate-800">All Gyms</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#DAE1E7]">
                <th className="pb-2 text-left text-xs font-medium text-slate-400">Gym ID</th>
                <th className="pb-2 text-left text-xs font-medium text-slate-400">Name</th>
                <th className="pb-2 text-left text-xs font-medium text-slate-400">Owner</th>
                <th className="pb-2 text-left text-xs font-medium text-slate-400">Members</th>
                <th className="pb-2 text-left text-xs font-medium text-slate-400">Revenue</th>
                <th className="pb-2 text-left text-xs font-medium text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {gyms.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-slate-500">No gyms found</td>
                </tr>
              ) : (
                gyms.map((g) => (
                  <tr key={g.id} className="border-b border-white/5 last:border-0 hover:bg-white">
                    <td className="py-3 text-sm text-slate-500">{g.gym_id}</td>
                    <td className="py-3 text-sm font-medium text-slate-800">{g.name}</td>
                    <td className="py-3 text-sm text-slate-500">{g.owner_name || '—'}</td>
                    <td className="py-3 text-sm text-slate-500">{g.member_count}</td>
                    <td className="py-3 text-sm text-slate-500">₹{g.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="py-3">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                        g.status === 'active'
                          ? 'admin-badge-active'
                          : 'bg-white text-slate-400 border-[#DAE1E7]'
                      }`}>
                        {g.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
