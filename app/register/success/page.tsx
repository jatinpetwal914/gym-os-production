'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import {
  formatInr,
  PAYMENT_UNAVAILABLE_MESSAGE,
  REGISTRATION_SUCCESS_STORAGE_KEY,
  submitErrorMessage,
  type GymOsSubmitResult,
} from '@/lib/gym-os-saas-plans';

function postToPayU(action: string, fields: Record<string, string>) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  form.acceptCharset = 'UTF-8';
  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value ?? '';
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

function SuccessExperience() {
  const searchParams = useSearchParams();
  const [result, setResult] = useState<GymOsSubmitResult | null>(null);
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const reference = searchParams.get('ref') || result?.public_reference_id || '';

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(REGISTRATION_SUCCESS_STORAGE_KEY);
      if (raw) setResult(JSON.parse(raw) as GymOsSubmitResult);
    } catch {
      setResult(null);
    }
  }, []);

  const isFree = Boolean(
    result && (result.payment_status === 'free_coupon' || Number(result.final_amount || 0) === 0)
  );
  const isPaid = result?.payment_status === 'paid';
  const needsPayment = Boolean(result && !isFree && !isPaid);
  const payable = result ? Number(result.final_amount || 0) : null;

  const handlePay = async () => {
    if (!reference || paying) return;
    setPaying(true);
    setPaymentError('');
    try {
      const res = await fetch('/api/register/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_reference_id: reference }),
      });
      const data = await res.json().catch(() => ({}));

      if (data.already_paid || data.payment_status === 'paid') {
        const next = {
          ...(result || {}),
          ok: true,
          public_reference_id: reference,
          payment_status: 'paid' as const,
          final_amount: Number(data.final_amount ?? result?.final_amount ?? 0),
        };
        sessionStorage.setItem(REGISTRATION_SUCCESS_STORAGE_KEY, JSON.stringify(next));
        setResult(next);
        setPaying(false);
        return;
      }

      if (!res.ok || !data.ok || !data.action || !data.fields) {
        setPaymentError(
          submitErrorMessage(data.error_code, data.message) || PAYMENT_UNAVAILABLE_MESSAGE
        );
        setPaying(false);
        return;
      }

      postToPayU(data.action, data.fields);
    } catch (error) {
      console.error(error);
      setPaymentError(PAYMENT_UNAVAILABLE_MESSAGE);
      setPaying(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#F4F7FA] text-slate-800">
      <div className="relative mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-5 py-24 sm:px-8">
        <div className="rounded-3xl border border-[#DAE1E7] bg-white p-8 ">
          <CheckCircle2 className="h-10 w-10 text-[#2064B6]" />
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Registration Received!</h1>
          <p className="mt-3 text-sm leading-7 text-slate-500">Thank you for choosing Gym OS.</p>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            Your registration request has been successfully submitted.
          </p>

          {isFree && (
            <>
              <p className="mt-4 text-sm text-[#2064B6]">Your launch offer has been applied.</p>
              <p className="mt-1 text-lg font-semibold">Amount payable: {formatInr(0)}</p>
            </>
          )}

          {isPaid && (
            <>
              <p className="mt-4 text-sm text-[#2064B6]">If payment was required, your payment has been confirmed.</p>
              {payable !== null && <p className="mt-1 text-lg font-semibold">Amount paid: {formatInr(payable)}</p>}
            </>
          )}

          {needsPayment && (
            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
              <p className="text-sm font-medium text-amber-800">Payment required to complete your registration.</p>
              {payable !== null && (
                <p className="mt-1 text-sm text-amber-800/80">Amount payable: {formatInr(payable)}</p>
              )}
              <button
                type="button"
                onClick={handlePay}
                disabled={paying || !reference}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2064B6] py-3 text-sm font-semibold text-white transition hover:bg-[#18539a] disabled:opacity-60"
              >
                {paying && <Loader2 className="h-4 w-4 animate-spin" />}
                Proceed to Payment
              </button>
              {paymentError && <p className="mt-3 text-sm text-red-700">{paymentError}</p>}
            </div>
          )}

          <div className="mt-6 space-y-2 text-sm leading-7 text-slate-500">
            <p>Our team will review your registration and create your Gym OS account.</p>
            <p>Your login credentials will be sent to your registered email.</p>
            <p>Please check your Spam/Junk folder as well.</p>
          </div>

          {result?.customer_email_sent && (
            <p className="mt-4 text-sm text-[#2064B6]">A confirmation email was sent to your registered address.</p>
          )}
          {result?.email_notice && (
            <p className="mt-4 text-sm text-amber-800">{result.email_notice}</p>
          )}

          {reference && (
            <p className="mt-6 rounded-xl border border-[#DAE1E7] bg-[#F4F7FA] px-4 py-3 text-sm">
              Registration reference: <span className="font-semibold tracking-wide text-[#2064B6]">{reference}</span>
            </p>
          )}

          <Link
            href="/login"
            className="mt-8 inline-flex rounded-full border border-[#DAE1E7] px-4 py-2 text-sm text-slate-500 transition hover:text-slate-800"
          >
            Go to staff login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RegisterSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F4F7FA] text-slate-400">Loading…</div>
      }
    >
      <SuccessExperience />
    </Suspense>
  );
}
