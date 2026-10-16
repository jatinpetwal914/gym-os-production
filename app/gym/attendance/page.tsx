'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Html5Qrcode } from 'html5-qrcode';
import {
  QrCode,
  History,
  Camera,
  CameraOff,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { QueryState } from '@/components/query-state';
import { MemberAvatar } from '@/components/gym/member-avatar';

interface AttendanceRecord {
  id: string;
  member_id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  members: { member_id: string; name: string; phone: string };
}

interface ScanResult {
  member: {
    id: string;
    member_id: string;
    name: string;
    phone: string | null;
    status: string;
    photo_url?: string | null;
    plan_id?: string | null;
    expiry_date?: string | null;
  };
  attendance: {
    id: string;
    check_in_time?: string;
    check_in_at?: string;
    check_out_time?: string | null;
  } | null;
  alreadyCheckedIn: boolean;
  action?: 'checkin' | 'already_checked_in';
}

type TabType = 'scan' | 'history';

const statusStyles: Record<string, string> = {
  active: 'bg-[#6DCCC3]/20 text-[#2064B6] border-[#6DCCC3]',
  expiring: 'bg-white text-slate-600 border-[#DAE1E7]',
  expired: 'bg-red-500/10 text-red-700 border-red-500/25',
};

export default function AttendancePage() {
  const [tab, setTab] = useState<TabType>('scan');

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="px-4 py-4 lg:p-8"
    >
      <div className="mb-6">
        <p className="admin-kicker">Floor</p>
        <h1 className="admin-page-title">Scan & attendance</h1>
        <p className="mt-1 text-sm text-slate-400">Scan the QR, then confirm the person matches the photograph before allowing entry.</p>
      </div>

      <div className="mb-6 inline-flex rounded-xl border border-[#DAE1E7] bg-white p-1">
        <button
          onClick={() => setTab('scan')}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === 'scan' ? 'bg-[#2064B6] text-white' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <QrCode className="h-4 w-4" />
          Scan
        </button>
        <button
          onClick={() => setTab('history')}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === 'history' ? 'bg-[#2064B6] text-white' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="h-4 w-4" />
          History
        </button>
      </div>

      {tab === 'scan' ? <ScanTab /> : <HistoryTab />}
    </motion.div>
  );
}

function ScanTab() {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState('');
  const [processing, setProcessing] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const startTimerRef = useRef<number | null>(null);
  const elementId = 'qr-reader';

  const stopScanner = useCallback(async () => {
    if (startTimerRef.current !== null) {
      window.clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  const handleScan = useCallback(
    async (decodedText: string) => {
      if (processingRef.current) return;
      processingRef.current = true;
      setProcessing(true);
      await stopScanner();

      try {
        const qrToken = decodedText.trim();
        if (!qrToken) throw new Error('The QR code did not contain a member token.');
        const res = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qr_token: qrToken }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.status === 409 && json.data?.alreadyCheckedIn) {
          setScanResult(json.data);
          setScanError(json.message || 'Member is already checked in');
        } else if (!res.ok) {
          setScanError(json.error || 'Failed to check in');
          setScanResult(null);
        } else {
          setScanResult(json.data);
          setScanError('');
        }
      } catch {
        setScanError('Network error — please try again');
        setScanResult(null);
      } finally {
        processingRef.current = false;
        setProcessing(false);
      }
    },
    [stopScanner]
  );

  const startScanner = useCallback(async () => {
    if (processingRef.current || scannerRef.current || startTimerRef.current !== null) return;
    setScanResult(null);
    setScanError('');
    setScanning(true);

    // Wait for DOM element to render
    startTimerRef.current = window.setTimeout(async () => {
      startTimerRef.current = null;
      try {
        const html5Qrcode = new Html5Qrcode(elementId);
        scannerRef.current = html5Qrcode;

        await html5Qrcode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            handleScan(decodedText);
          },
          () => {
            // per-frame error — ignore
          }
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const cameraUnavailable =
          message.includes('NotAllowedError') ||
          message.includes('NotFoundError') ||
          message.toLowerCase().includes('secure context');
        setScanError(
          cameraUnavailable
            ? 'Camera access is unavailable. Allow camera permission and open this page over HTTPS, then try again.'
            : `Could not start the camera: ${message}`
        );
        if (scannerRef.current) {
          try {
            await scannerRef.current.clear();
          } catch {
            // The scanner may not have initialized its camera.
          }
          scannerRef.current = null;
        }
        setScanning(false);
      }
    }, 100);
  }, [handleScan]);

  useEffect(() => {
    return () => {
      if (startTimerRef.current !== null) window.clearTimeout(startTimerRef.current);
      stopScanner();
    };
  }, [stopScanner]);

  return (
    <div className="max-w-2xl">
      {/* Scanner area */}
      <div className="admin-surface p-6">
        <div className="flex flex-col items-center">
          {/* Camera container */}
          <div className="relative w-full max-w-sm">
            <div id={elementId} className="overflow-hidden rounded-xl" />

            {/* Scanning frame overlay (visible when scanning) */}
            {scanning && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-56 w-56">
                  <div className="absolute inset-0 rounded-xl border-2 border-cyan-400/80" />
                  <motion.div
                    initial={{ top: '0%' }}
                    animate={{ top: ['0%', '100%', '0%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="absolute left-0 right-0 h-0.5 bg-[#6DCCC3]/200 shadow-[0_0_8px_rgba(14,165,233,0.8)]"
                  />
                </div>
              </div>
            )}

            {/* Placeholder when not scanning */}
            {!scanning && !scanResult && !scanError && (
              <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-[#DAE1E7] bg-white">
                <QrCode className="h-12 w-12 text-slate-600" />
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="mt-4 flex gap-3">
            {!scanning ? (
              <button
                onClick={startScanner}
                disabled={processing}
                className="admin-primary-btn disabled:opacity-50"
              >
                <Camera className="h-4 w-4" />
                Start Camera
              </button>
            ) : (
              <button
                onClick={stopScanner}
                className="inline-flex items-center gap-2 admin-secondary-btn"
              >
                <CameraOff className="h-4 w-4" />
                Stop Camera
              </button>
            )}
          </div>

          {processing && (
            <p className="mt-3 text-sm text-slate-400">Processing check-in...</p>
          )}
        </div>
      </div>

      {/* Scan result */}
      <AnimatePresence>
        {scanResult && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className={`mt-4 rounded-xl border p-5 ${
              scanResult.alreadyCheckedIn
                ? 'border-[#DAE1E7] bg-white'
                : 'border-[#6DCCC3] bg-[#6DCCC3]/20'
            }`}
          >
            <div className="flex items-start gap-3">
              <MemberAvatar
                memberId={scanResult.member.id}
                photoUrl={scanResult.member.photo_url}
                name={scanResult.member.name}
                className="h-20 w-20 rounded-2xl"
              />
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  scanResult.alreadyCheckedIn ? 'text-slate-700' : 'text-[#2064B6]'
                }`}>
                  {scanResult.alreadyCheckedIn ? 'Already checked in — verify identity' : 'Verify identity, then allow entry'}
                </p>
                <div className="mt-2 space-y-1 text-sm">
                  <p className="text-slate-600">
                    <span className="font-medium">{scanResult.member.name}</span> ({scanResult.member.member_id})
                  </p>
                  <p className="text-slate-400">
                    Status: <span className="capitalize">{scanResult.member.status}</span>
                  </p>
                  {scanResult.member.expiry_date && (
                    <p className="text-slate-400">
                      Valid until: {new Date(scanResult.member.expiry_date).toLocaleDateString()}
                    </p>
                  )}
                  {(scanResult.attendance?.check_in_time || scanResult.attendance?.check_in_at) && (
                    <p className="text-slate-400">
                      Check-in time: {new Date(String(scanResult.attendance.check_in_time || scanResult.attendance.check_in_at)).toLocaleString()}
                    </p>
                  )}
                  {!scanResult.member.photo_url && (
                    <p className="text-slate-600">No photograph on file for this older registration. Do not rely on the QR alone.</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scan error */}
      <AnimatePresence>
        {scanError && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-5"
          >
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-900">Check-in failed</p>
                <p className="mt-1 text-sm text-red-700">{scanError}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Retry button after result/error */}
      {(scanResult || scanError) && (
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => {
              setScanResult(null);
              setScanError('');
              startScanner();
            }}
            className="inline-flex items-center gap-2 admin-secondary-btn"
          >
            <Camera className="h-4 w-4" />
            Scan Again
          </button>
        </div>
      )}
    </div>
  );
}

function HistoryTab() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await fetch(`/api/attendance?${params}`);
      if (!res.ok) throw new Error('Failed to fetch attendance');
      const json = await res.json();
      setRecords(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const totalPages = Math.max(1, Math.ceil(records.length / limit));
  const paginated = records.slice((page - 1) * limit, page * limit);

  return (
    <div>
      {/* Date filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="admin-field"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="admin-field"
          />
        </div>
        <button
          onClick={() => {
            setPage(1);
            fetchHistory();
          }}
          className="admin-secondary-btn"
        >
          Apply
        </button>
        {(from || to) && (
          <button
            onClick={() => {
              setFrom('');
              setTo('');
              setPage(1);
            }}
            className="text-sm text-slate-400 hover:text-slate-800"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="admin-surface">
        <QueryState loading={loading} error={error || null} empty={!loading && !error && paginated.length === 0} emptyMessage="No attendance records">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#DAE1E7]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Member Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Member ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Check-in</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Check-out</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody>
                  {paginated.map((r) => (
                    <tr key={r.id} className="border-b border-white/5 last:border-0 hover:bg-white">
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">
                        {r.members?.name || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {r.members?.member_id || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {r.date ? new Date(r.date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {r.check_out_time ? new Date(r.check_out_time).toLocaleTimeString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusStyles[r.status] || statusStyles.active}`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </QueryState>

        {/* Pagination */}
        {!loading && records.length > limit && (
          <div className="flex items-center justify-between border-t border-[#DAE1E7] px-4 py-3">
            <p className="text-xs text-slate-400">
              Page {page} of {totalPages} · {records.length} total
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="admin-secondary-btn px-2.5 py-1.5 text-xs disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="admin-secondary-btn px-2.5 py-1.5 text-xs disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
