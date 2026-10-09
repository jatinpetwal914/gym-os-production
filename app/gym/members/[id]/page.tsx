'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  Phone,
  MapPin,
  AlertCircle,
  Calendar,
  CreditCard,
  QrCode,
} from 'lucide-react';
import { QueryState } from '@/components/query-state';
import { MemberAvatar } from '@/components/gym/member-avatar';
import { displayPaymentStatus, paymentStatusClass } from '@/lib/member-payment';
import { formatInr } from '@/lib/gym-os-saas-plans';

interface Plan {
  id: string;
  name: string;
  duration_days: number;
  price: number;
  discount: number;
  final_price: number;
  description: string | null;
}

interface Payment {
  id: string;
  amount: number;
  discount: number;
  payment_method: string | null;
  payment_date: string;
  notes: string | null;
  status?: string;
  gateway?: string | null;
  gateway_reference?: string | null;
  refund_amount?: number;
  refunded_at?: string | null;
}

interface MemberDetail {
  id: string;
  member_id: string;
  name: string;
  phone: string | null;
  address: string | null;
  emergency_contact: string | null;
  date_of_birth: string | null;
  gender: string | null;
  age: number | null;
  plan_id: string | null;
  start_date: string | null;
  expiry_date: string | null;
  amount_paid: number;
  status: string;
  notes: string | null;
  photo_url?: string | null;
  plan: Plan | null;
  attendanceCount: number;
  payments: Payment[];
}

const statusStyles: Record<string, string> = {
  active: 'border-[#6DCCC3] bg-[#6DCCC3]/20 text-[#2064B6]',
  expiring: 'border-[#DAE1E7] bg-white text-slate-600',
  expired: 'border-red-500/25 bg-red-500/10 text-red-700',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyles[status] || statusStyles.active}`}>
      {status}
    </span>
  );
}

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [member, setMember] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [adjusting, setAdjusting] = useState('');

  const adjustPayment = async (paymentId: string, action: string) => {
    setAdjusting(paymentId);
    try {
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Unable to update payment');
      await fetchMember();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update payment');
    } finally {
      setAdjusting('');
    }
  };

  const fetchMember = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/members/${id}`);
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || 'Failed to fetch member');
      }
      const json = await res.json();
      setMember(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load member');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchQR = useCallback(async () => {
    try {
      const res = await fetch(`/api/members/${id}/qr`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.data?.qr_token) {
        const url = await QRCode.toDataURL(json.data.qr_token, {
          width: 200,
          margin: 2,
          color: { dark: '#18181b', light: '#ffffff' },
        });
        setQrUrl(url);
      }
    } catch {
      // silent
    }
  }, [id]);

  useEffect(() => {
    fetchMember();
    fetchQR();
  }, [fetchMember, fetchQR]);

  if (loading || error || !member) {
    return (
      <div className="p-6 lg:p-8">
        {!loading && (
          <button onClick={() => router.push('/gym/members')} className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-800">
            <ArrowLeft className="h-4 w-4" /> Back to Members
          </button>
        )}
        <QueryState loading={loading} error={error || null} empty={!loading && !error && !member} emptyMessage="Member not found">
          <span />
        </QueryState>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="p-6 lg:p-8"
    >
      {/* Back button */}
      <button
        onClick={() => router.push('/gym/members')}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Members
      </button>

      {/* Header card */}
      <div className={`relative mb-6 overflow-hidden rounded-xl border p-6 ${
        member.status !== 'expired' && Number(member.amount_paid) > 0
          ? 'border-[#DAE1E7] bg-white'
          : 'border-[#DAE1E7] bg-white'
      }`}>
        {member.plan_id && (
          <span className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#6DCCC3]/50 bg-[#6DCCC3]/20 text-[#2064B6]">
            <span className="text-sm">★</span>
          </span>
        )}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <MemberAvatar
              memberId={member.id}
              photoUrl={member.photo_url}
              name={member.name}
              className="h-24 w-24 rounded-2xl ring-2 ring-cyan-400/25"
            />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-800">{member.name}</h1>
              <p className="text-sm text-slate-400">{member.member_id}{member.gender ? ` · ${member.gender}` : ''}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusBadge status={member.status} />
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  member.status !== 'expired' && Number(member.amount_paid) > 0
                    ? 'admin-badge-active'
                    : 'admin-badge'
                }`}>
                  {member.status !== 'expired' && Number(member.amount_paid) > 0 ? 'Fee paid' : 'Fee due'}
                </span>
              </div>
              {!member.photo_url && (
                <p className="mt-2 text-xs text-slate-400">No photograph on file. Add one before relying on this QR at the door.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Contact info */}
        <div className="rounded-xl border border-[#DAE1E7] bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Contact Information</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 text-sm">
              <Phone className="h-4 w-4 text-slate-500" />
              <span className="text-slate-600">{member.phone || '—'}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <MapPin className="h-4 w-4 text-slate-500" />
              <span className="text-slate-600">{member.address || '—'}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <AlertCircle className="h-4 w-4 text-slate-500" />
              <span className="text-slate-600">{member.emergency_contact || '—'}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <Calendar className="h-4 w-4 text-slate-500" />
              <span className="text-slate-600">
                {member.date_of_birth ? new Date(member.date_of_birth).toLocaleDateString() : '—'}
                {member.age ? ` (${member.age} yrs)` : ''}
              </span>
            </div>
            {member.gender && (
              <div className="flex items-center gap-2.5 text-sm">
                <span className="text-slate-500">Gender:</span>
                <span className="capitalize text-slate-600">{member.gender}</span>
              </div>
            )}
          </div>
          {member.notes && (
            <div className="mt-4 border-t border-[#DAE1E7] pt-3">
              <p className="mb-1 text-xs font-medium text-slate-400">Notes</p>
              <p className="text-sm text-slate-600">{member.notes}</p>
            </div>
          )}
        </div>

        {/* Membership info */}
        <div className="rounded-xl border border-[#DAE1E7] bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Membership</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Plan</span>
              <span className="font-medium text-slate-800">{member.plan?.name || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Duration</span>
              <span className="text-slate-600">{member.plan?.duration_days ? `${member.plan.duration_days} days` : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Start Date</span>
              <span className="text-slate-600">{member.start_date ? new Date(member.start_date).toLocaleDateString() : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Expiry Date</span>
              <span className="text-slate-600">{member.expiry_date ? new Date(member.expiry_date).toLocaleDateString() : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Amount Paid</span>
              <span className="font-medium text-slate-800">{formatInr(Number(member.amount_paid || 0))}</span>
            </div>
          </div>
        </div>

        {/* QR Code */}
        <div className="rounded-xl border border-[#DAE1E7] bg-white p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <QrCode className="h-4 w-4" /> QR Code
          </h2>
          <div className="flex flex-col items-center">
            {qrUrl ? (
              <img src={qrUrl} alt="Member QR Code" className="rounded-lg border border-[#DAE1E7]" />
            ) : (
              <div className="flex h-[200px] w-[200px] items-center justify-center rounded-lg border border-[#DAE1E7] text-xs text-slate-500">
                Generating...
              </div>
            )}
            <p className="mt-3 text-xs text-slate-400">Scan to check in. Staff must still match the person to the photograph.</p>
          </div>
        </div>
      </div>

      {/* Attendance summary */}
      <div className="mt-6 rounded-xl border border-[#DAE1E7] bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Attendance</h2>
          <span className="admin-badge">
            {member.attendanceCount} total
          </span>
        </div>
        <p className="py-4 text-center text-sm text-slate-500">
          {member.attendanceCount > 0
            ? `${member.attendanceCount} check-in${member.attendanceCount !== 1 ? 's' : ''} recorded`
            : 'No attendance records yet'}
        </p>
      </div>

      {/* Payment history */}
      <div className="mt-6 rounded-xl border border-[#DAE1E7] bg-white p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <CreditCard className="h-4 w-4" /> Payment History
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#DAE1E7]">
                <th className="pb-2 text-left text-xs font-medium text-slate-400">Date</th>
                <th className="pb-2 text-left text-xs font-medium text-slate-400">Amount</th>
                <th className="pb-2 text-left text-xs font-medium text-slate-400">Status</th>
                <th className="pb-2 text-left text-xs font-medium text-slate-400">Method</th>
                <th className="pb-2 text-left text-xs font-medium text-slate-400">Reference</th>
                <th className="pb-2 text-left text-xs font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {member.payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-slate-500">No payments recorded</td>
                </tr>
              ) : (
                member.payments.map((p) => (
                  <tr key={p.id} className="border-b border-white/5 last:border-0 hover:bg-white">
                    <td className="py-3 text-sm text-slate-600">
                      {new Date(p.payment_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-sm font-medium text-slate-800">{formatInr(Number(p.amount))}</td>
                    <td className="py-3">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${paymentStatusClass(p.status)}`}>
                        {displayPaymentStatus(p.status)}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-slate-600">{p.payment_method || '—'}</td>
                    <td className="py-3 text-sm text-slate-600">{p.gateway_reference || p.gateway || 'manual'}</td>
                    <td className="py-3 text-sm">
                      {p.status === 'completed' && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={adjusting === p.id}
                            onClick={() => adjustPayment(p.id, 'refund')}
                            className="text-xs font-medium text-[#2064B6] disabled:opacity-50"
                          >
                            Refund
                          </button>
                          <button
                            type="button"
                            disabled={adjusting === p.id}
                            onClick={() => adjustPayment(p.id, 'reverse')}
                            className="text-xs font-medium text-slate-400 disabled:opacity-50"
                          >
                            Reverse
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
