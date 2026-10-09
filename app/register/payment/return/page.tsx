'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { formatInr, PAYMENT_UNAVAILABLE_MESSAGE, REGISTRATION_SUCCESS_STORAGE_KEY, type GymOsSubmitResult } from '@/lib/gym-os-saas-plans';

function PaymentReturnExperience() {
  const searchParams = useSearchParams();
  const txnid = searchParams.get('txnid') || searchParams.get('order_id') || '';
  const reference = searchParams.get('ref') || '';
  const [status, setStatus] = useState<'checking' | 'paid' | 'pending' | 'cancelled' | 'error'>('checking');
  const [amount, setAmount] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      try {
        const res = await fetch('/api/register/payment/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txnid,
            public_reference_id: reference,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (data.paid) {
          const stored: GymOsSubmitResult = {
            ok: true,
            public_reference_id: data.public_reference_id || reference,
            payment_status: 'paid',
            registration_status: 'under_review',
            final_amount: Number(data.final_amount || 0),
            customer_email_sent: Boolean(data.customer_email_sent),
            email_notice: data.email_notice,
          };
          sessionStorage.setItem(REGISTRATION_SUCCESS_STORAGE_KEY, JSON.stringify(stored));
          setAmount(Number(data.final_amount || 0));
          setStatus('paid');
          setMessage(data.email_notice || '');
          return;
        }

        if (!res.ok) {
          setMessage(data.message || PAYMENT_UNAVAILABLE_MESSAGE);
          setStatus('error');
          return;
        }

        const orderStatus = String(data.order_status || '').toUpperCase();
        if (orderStatus === 'FAILURE' || orderStatus === 'FAILED' || orderStatus === 'CANCELLED' || orderStatus === 'BOUNCED') {
          setAmount(Number(data.final_amount || 0));
          setStatus('cancelled');
          return;
        }

        setAmount(Number(data.final_amount || 0));
        setStatus('pending');
      } catch {
        if (!cancelled) {
          setMessage(PAYMENT_UNAVAILABLE_MESSAGE);
          setStatus('error');
        }
      }
    }

    if (!txnid && !reference) {
      setMessage(PAYMENT_UNAVAILABLE_MESSAGE);
      setStatus('error');
      return;
    }

    void verify();
    return () => {
      cancelled = true;
    };
  }, [txnid, reference]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#F4F7FA] text-slate-800">
      <div className="relative mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-5 py-24 sm:px-8">
        <div className="rounded-3xl border border-[#DAE1E7] bg-white p-8 ">
          {status === 'checking' && (
            <div className="inline-flex items-center gap-3 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Confirming your payment…
            </div>
          )}

          {status === 'paid' && (
            <>
              <CheckCircle2 className="h-10 w-10 text-[#2064B6]" />
              <h1 className="mt-4 text-3xl font-semibold tracking-tight">Registration Received!</h1>
              <p className="mt-3 text-sm leading-7 text-slate-500">Thank you for choosing Gym OS.</p>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                Your registration request has been successfully submitted.
              </p>
              <p className="mt-4 text-sm text-[#2064B6]">If payment was required, your payment has been confirmed.</p>
              {amount !== null && <p className="mt-1 text-lg font-semibold">Amount paid: {formatInr(amount)}</p>}
              <div className="mt-4 space-y-2 text-sm leading-7 text-slate-500">
                <p>Our team will review your registration and create your Gym OS account.</p>
                <p>Your login credentials will be sent to your registered email.</p>
                <p>Please check your Spam/Junk folder as well.</p>
              </div>
              {message && <p className="mt-4 text-sm text-amber-800">{message}</p>}
            </>
          )}

          {status === 'pending' && (
            <>
              <h1 className="text-3xl font-semibold tracking-tight">Payment pending</h1>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                We have not confirmed this payment yet. If you completed checkout, please wait a moment and try again.
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                Your registration request is saved. Payment is not confirmed until PayU returns a verified success hash to our server.
              </p>
            </>
          )}

          {status === 'cancelled' && (
            <>
              <h1 className="text-3xl font-semibold tracking-tight">Payment cancelled</h1>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                This payment was not completed. Your registration request is still saved, and payment has not been confirmed.
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <h1 className="text-3xl font-semibold tracking-tight">Payment unavailable</h1>
              <p className="mt-3 text-sm leading-7 text-red-700">{message || PAYMENT_UNAVAILABLE_MESSAGE}</p>
            </>
          )}

          {(reference || txnid) && (
            <p className="mt-6 rounded-xl border border-[#DAE1E7] bg-[#F4F7FA] px-4 py-3 text-sm">
              Registration reference:{' '}
              <span className="font-semibold tracking-wide text-[#2064B6]">{reference || '—'}</span>
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            {reference && (
              <Link
                href={`/register/success?ref=${encodeURIComponent(reference)}`}
                className="rounded-full bg-[#2064B6] px-4 py-2 text-sm font-semibold text-white"
              >
                Back to registration
              </Link>
            )}
            <Link
              href="/login"
              className="rounded-full border border-[#DAE1E7] px-4 py-2 text-sm text-slate-500"
            >
              Go to staff login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F4F7FA] text-slate-400">Loading…</div>
      }
    >
      <PaymentReturnExperience />
    </Suspense>
  );
}
