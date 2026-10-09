'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { formatInr } from '@/lib/gym-os-saas-plans';
import { MEMBER_PHOTO_MAX_BYTES } from '@/lib/member-photo';
import { PhotoCapture } from '@/components/gym/photo-capture';

type Plan = {
  id: string;
  name: string;
  duration_days: number;
  final_price: number;
};

type WizardForm = {
  name: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  address: string;
  emergency_contact: string;
  plan_id: string;
  start_date: string;
  notes: string;
  payment_method: string;
};

const steps = ['Details', 'Photo', 'Plan', 'Review', 'Payment', 'Done'] as const;

const emptyForm = (): WizardForm => ({
  name: '',
  phone: '',
  date_of_birth: '',
  gender: '',
  address: '',
  emergency_contact: '',
  plan_id: '',
  start_date: new Date().toISOString().slice(0, 10),
  notes: '',
  payment_method: 'cash',
});

export function MemberRegistrationWizard({
  plans,
  onClose,
  onComplete,
}: {
  plans: Plan[];
  onClose: () => void;
  onComplete: () => void;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardForm>(emptyForm);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{
    id: string;
    member_id: string;
    name: string;
    photo_url: string | null;
    status: string;
    amount_paid: number;
    payment_error?: string | null;
  } | null>(null);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === form.plan_id) || null,
    [plans, form.plan_id]
  );

  const setPhotoFile = (file: File | null) => {
    setPhoto(file);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(file ? URL.createObjectURL(file) : '');
  };

  const validateStep = () => {
    if (step === 0 && !form.name.trim()) return 'Name is required.';
    if (step === 1) {
      if (!photo) return 'Photograph is required.';
      if (photo.size > MEMBER_PHOTO_MAX_BYTES) return 'Photograph must be 5 MB or smaller.';
    }
    if (step === 2 && (!form.plan_id || !form.start_date)) return 'Select a plan and start date.';
    if (step === 4 && !form.payment_method) return 'Select how this payment was collected.';
    return '';
  };

  const next = () => {
    const message = validateStep();
    if (message) {
      setError(message);
      return;
    }
    setError('');
    setStep((value) => Math.min(steps.length - 1, value + 1));
  };

  const submit = async () => {
    const message = validateStep();
    if (message) {
      setError(message);
      return;
    }
    if (!photo || !selectedPlan) return;
    setSaving(true);
    setError('');
    try {
      const payload = new FormData();
      payload.set('name', form.name.trim());
      payload.set('phone', form.phone);
      payload.set('date_of_birth', form.date_of_birth);
      payload.set('gender', form.gender);
      payload.set('address', form.address);
      payload.set('emergency_contact', form.emergency_contact);
      payload.set('plan_id', form.plan_id);
      payload.set('start_date', form.start_date);
      payload.set('notes', form.notes);
      payload.set('payment_method', form.payment_method);
      payload.set('payment_amount', String(selectedPlan.final_price));
      payload.set('photo', photo);

      const res = await fetch('/api/members', { method: 'POST', body: payload });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Unable to complete registration.');
      setCreated({
        ...json.data,
        payment_error: json.payment_error,
      });
      setStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete registration.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {steps.map((label, index) => (
          <div key={label} className="min-w-0 flex-1">
            <div className={`h-1.5 rounded-full ${index <= step ? 'bg-[#2064B6]' : 'bg-[#EEF4F8]'}`} />
            <p className="mt-1 hidden truncate text-[10px] text-slate-400 sm:block">{label}</p>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-3">
          <Field label="Name *" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
            <Field label="Date of birth" type="date" value={form.date_of_birth} onChange={(value) => setForm({ ...form, date_of_birth: value })} />
          </div>
          <label className="block text-xs font-medium text-slate-500">
            Gender
            <select
              value={form.gender}
              onChange={(event) => setForm({ ...form, gender: event.target.value })}
              className="admin-field mt-1"
            >
              <option value="">Select...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
          <Field label="Address" value={form.address} onChange={(value) => setForm({ ...form, address: value })} />
          <Field
            label="Emergency contact"
            value={form.emergency_contact}
            onChange={(value) => setForm({ ...form, emergency_contact: value })}
          />
        </div>
      )}

      {step === 1 && (
        <PhotoCapture value={photo} onChange={setPhotoFile} required />
      )}

      {step === 2 && (
        <div className="space-y-3">
          <label className="block text-xs font-medium text-slate-500">
            Plan *
            <select
              required
              value={form.plan_id}
              onChange={(event) => setForm({ ...form, plan_id: event.target.value })}
              className="admin-field mt-1"
            >
              <option value="">Select plan...</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} — {formatInr(plan.final_price)}
                </option>
              ))}
            </select>
          </label>
          <Field label="Start date *" type="date" value={form.start_date} onChange={(value) => setForm({ ...form, start_date: value })} />
          <Field label="Notes" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} />
          {selectedPlan && (
            <p className="rounded-xl bg-white px-3 py-2 text-sm text-slate-600">
              Amount due: <span className="font-semibold">{formatInr(selectedPlan.final_price)}</span>
              <span className="text-slate-400"> · {selectedPlan.duration_days} days</span>
            </p>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3 text-sm">
          {photoPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoPreview} alt="" className="h-24 w-24 rounded-2xl object-cover" />
          )}
          <p><span className="text-slate-400">Name:</span> {form.name}</p>
          <p><span className="text-slate-400">Phone:</span> {form.phone || '—'}</p>
          <p><span className="text-slate-400">Plan:</span> {selectedPlan?.name || '—'}</p>
          <p><span className="text-slate-400">Amount:</span> {selectedPlan ? formatInr(selectedPlan.final_price) : '—'}</p>
          <p className="text-xs text-slate-400">By continuing, desk staff confirm these details and collect payment for this registration.</p>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Collect {selectedPlan ? formatInr(selectedPlan.final_price) : 'the plan amount'} now. Online checkout can be connected later without changing this flow.
          </p>
          <label className="block text-xs font-medium text-slate-500">
            Payment method *
            <select
              value={form.payment_method}
              onChange={(event) => setForm({ ...form, payment_method: event.target.value })}
              className="admin-field mt-1"
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="digital_wallet">Digital wallet</option>
            </select>
          </label>
        </div>
      )}

      {step === 5 && created && (
        <div className="space-y-3 text-sm">
          <CheckCircle2 className="h-8 w-8 text-[#2064B6]" />
          <p className="text-base font-semibold text-slate-800">Registration saved</p>
          <p>{created.name} · {created.member_id}</p>
          <p>Status: <span className="capitalize">{created.status}</span></p>
          <p>Payment: {created.payment_error ? 'Pending — record it from this member' : 'Paid'}</p>
          {created.payment_error && <p className="text-red-300">{created.payment_error}</p>}
          <p className="text-xs text-slate-400">Open the member profile to print the QR code. Verify the photograph at check-in.</p>
        </div>
      )}

      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="flex justify-between gap-3 pt-2">
        {step < 5 ? (
          <>
            <button
              type="button"
              onClick={() => (step === 0 ? onClose() : setStep((value) => value - 1))}
              className="admin-secondary-btn"
            >
              <ChevronLeft className="h-4 w-4" />
              {step === 0 ? 'Cancel' : 'Back'}
            </button>
            {step === 4 ? (
              <button
                type="button"
                disabled={saving}
                onClick={submit}
                className="admin-primary-btn disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Collect payment & finish'}
              </button>
            ) : (
              <button
                type="button"
                onClick={next}
                className="admin-primary-btn"
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={onComplete}
            className="admin-primary-btn ml-auto"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      {label}
      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="admin-field mt-1"
      />
    </label>
  );
}
