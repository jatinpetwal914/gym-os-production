'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import {
  couponErrorMessage,
  formatInr,
  parseGymOsSaasPlanId,
  REGISTRATION_IDEMPOTENCY_STORAGE_KEY,
  REGISTRATION_SUCCESS_STORAGE_KEY,
  submitErrorMessage,
  type CouponStatus,
  type GymOsQuoteResult,
  type GymOsSaasPlanId,
  type GymOsSubmitResult,
} from '@/lib/gym-os-saas-plans';
import { MARKETING_PLANS } from '@/lib/marketing-plans';

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const r = (Math.random() * 16) | 0;
    const v = char === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function RegistrationForm({ initialPlanId }: { initialPlanId: GymOsSaasPlanId | null }) {
  const router = useRouter();
  const submittingLock = useRef(false);
  const [planId, setPlanId] = useState<GymOsSaasPlanId | ''>(initialPlanId || '');
  const [gymName, setGymName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [username, setUsername] = useState('');
  const [memberCount, setMemberCount] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [quote, setQuote] = useState<GymOsQuoteResult | null>(null);
  const [couponMessage, setCouponMessage] = useState('');
  const [error, setError] = useState('');
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');

  useEffect(() => {
    const existing = sessionStorage.getItem(REGISTRATION_IDEMPOTENCY_STORAGE_KEY);
    if (existing) {
      setIdempotencyKey(existing);
      return;
    }
    const created = newIdempotencyKey();
    sessionStorage.setItem(REGISTRATION_IDEMPOTENCY_STORAGE_KEY, created);
    setIdempotencyKey(created);
  }, []);

  const selectedPlan = useMemo(
    () => MARKETING_PLANS.find((plan) => plan.id === planId) || null,
    [planId]
  );

  const loadQuote = async (nextPlanId: string, couponCode: string, announceCoupon: boolean) => {
    const parsed = parseGymOsSaasPlanId(nextPlanId);
    if (!parsed) {
      setQuote(null);
      return;
    }

    setQuoting(true);
    try {
      const res = await fetch('/api/register/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: parsed, coupon_code: couponCode || undefined }),
      });
      const data = (await res.json()) as GymOsQuoteResult;
      setQuote(data);

      if (!announceCoupon) return;

      const status = (data.coupon_status || 'none') as CouponStatus;
      if (couponCode && status === 'applied') {
        setAppliedCoupon(couponCode);
        setCouponMessage('');
      } else if (couponCode) {
        setAppliedCoupon('');
        setCouponMessage(couponErrorMessage(status, data.message));
      }
    } catch {
      setCouponMessage('Unable to validate coupon right now.');
    } finally {
      setQuoting(false);
    }
  };

  useEffect(() => {
    if (!planId) return;
    void loadQuote(planId, appliedCoupon, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const handleApplyCoupon = async () => {
    setCouponMessage('');
    await loadQuote(planId, couponInput.trim(), true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submittingLock.current || submitting) return;
    submittingLock.current = true;
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: planId,
          gym_name: gymName,
          owner_name: ownerName,
          email,
          phone,
          city,
          state: stateName,
          username_preference: username,
          member_count: Number(memberCount),
          coupon_code: appliedCoupon || couponInput.trim() || undefined,
          idempotency_key: idempotencyKey,
        }),
      });
      const data = (await res.json()) as GymOsSubmitResult;

      if (!res.ok || !data.ok) {
        setError(submitErrorMessage(data.error_code, data.message));
        submittingLock.current = false;
        setSubmitting(false);
        return;
      }

      sessionStorage.removeItem(REGISTRATION_IDEMPOTENCY_STORAGE_KEY);
      sessionStorage.setItem(REGISTRATION_SUCCESS_STORAGE_KEY, JSON.stringify(data));
      router.push(`/register/success?ref=${encodeURIComponent(data.public_reference_id || '')}`);
    } catch {
      setError('Network error. Please try again.');
      submittingLock.current = false;
      setSubmitting(false);
    }
  };

  const summary = quote?.ok
    ? {
        planName: quote.plan_name || selectedPlan?.duration || 'Plan',
        base: Number(quote.base_amount || 0),
        discount: Number(quote.discount_amount || 0),
        final: Number(quote.final_amount || 0),
        couponApplied: quote.coupon_status === 'applied',
      }
    : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-[#6DCCC3]/40 bg-[#6DCCC3]/15 px-4 py-3 text-sm leading-6 text-slate-700">
        Your Gym OS account will be created after your registration is reviewed.
      </div>

      <div>
        <label htmlFor="reg-plan" className="mb-1.5 block text-sm font-medium text-slate-700">
          Selected Plan
        </label>
        <select
          id="reg-plan"
          value={planId}
          onChange={(event) => {
            setPlanId((event.target.value as GymOsSaasPlanId) || '');
            setAppliedCoupon('');
            setCouponMessage('');
          }}
          required
          className="w-full rounded-xl border border-[#DAE1E7] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#2064B6] focus:ring-2 focus:ring-[#2064B6]/20"
        >
          <option value="">
            Choose a plan
          </option>
          {MARKETING_PLANS.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.duration} — {plan.currency}
              {plan.price.toLocaleString('en-IN')}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Gym / Business Name" id="gym_name" value={gymName} onChange={setGymName} required />
        <Field label="Owner Name" id="owner_name" value={ownerName} onChange={setOwnerName} required />
        <Field label="Email" id="email" type="email" value={email} onChange={setEmail} required autoComplete="email" />
        <Field label="Phone Number" id="phone" value={phone} onChange={setPhone} required autoComplete="tel" />
        <Field label="City" id="city" value={city} onChange={setCity} required />
        <div>
          <label htmlFor="state" className="mb-1.5 block text-sm font-medium text-slate-700">
            State
          </label>
          <select
            id="state"
            value={stateName}
            onChange={(event) => setStateName(event.target.value)}
            required
            className="w-full rounded-xl border border-[#DAE1E7] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#2064B6] focus:ring-2 focus:ring-[#2064B6]/20"
          >
            <option value="">
              Select state
            </option>
            {INDIAN_STATES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <Field
          label="Username Preference"
          id="username_preference"
          value={username}
          onChange={setUsername}
          required
          placeholder="gymowner01"
        />
        <Field
          label="Approximate Number of Members"
          id="member_count"
          type="number"
          value={memberCount}
          onChange={setMemberCount}
          required
          min={1}
        />
      </div>

      <div>
        <label htmlFor="coupon_code" className="mb-1.5 block text-sm font-medium text-slate-700">
          Coupon Code
        </label>
        <div className="flex gap-2">
          <input
            id="coupon_code"
            value={couponInput}
            onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
            className="w-full rounded-xl border border-[#DAE1E7] bg-white px-3 py-2.5 text-sm uppercase tracking-wide text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#2064B6] focus:ring-2 focus:ring-[#2064B6]/20"
            placeholder="Optional"
          />
          <button
            type="button"
            onClick={handleApplyCoupon}
            disabled={!planId || quoting}
            className="rounded-xl border border-[#DAE1E7] px-4 text-sm font-semibold text-slate-700 transition hover:bg-[#F4F7FA] disabled:opacity-40"
          >
            Apply
          </button>
        </div>
        {couponMessage && <p className="mt-2 text-sm text-red-600">{couponMessage}</p>}
        {quote?.coupon_status === 'applied' && (
          <p className="mt-2 text-sm text-[#2064B6]">Launch offer applied.</p>
        )}
      </div>

      <div className="rounded-2xl border border-[#DAE1E7] bg-[#F4F7FA] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2064B6]">Order summary</p>
        {summary ? (
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">{summary.planName}</dt>
              <dd>{formatInr(summary.base)}</dd>
            </div>
            {summary.couponApplied && (
              <div className="flex justify-between text-[#2064B6]">
                <dt>Launch Discount</dt>
                <dd>-{formatInr(summary.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-[#DAE1E7] pt-2 text-base font-semibold">
              <dt>YOU PAY</dt>
              <dd>{formatInr(summary.final)}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-slate-400">Select a plan to see pricing.</p>
        )}
        {quoting && (
          <p className="mt-3 inline-flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            Updating summary
          </p>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !planId || !idempotencyKey}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2064B6] py-3 text-sm font-semibold text-white transition hover:bg-[#18539a] disabled:opacity-50"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Submit registration
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required,
  placeholder,
  autoComplete,
  min,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  min?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        min={min}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[#DAE1E7] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#2064B6] focus:ring-2 focus:ring-[#2064B6]/20"
      />
    </div>
  );
}
