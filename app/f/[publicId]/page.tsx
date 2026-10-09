'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { GymFormRenderer } from '@/components/gym/gym-form-renderer';
import { validateFormAnswers, type GymFormSection } from '@/lib/gym-forms';

type PublicPlan = { id: string; name: string; duration_days: number; final_price: number };

export default function PublicGymFormPage() {
  const params = useParams();
  const publicId = params.publicId as string;
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [message, setMessage] = useState('');
  const [gymName, setGymName] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [sections, setSections] = useState<GymFormSection[]>([]);
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState('');

  const storageKey = `gym-form-submitted-${publicId}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/public/forms/${publicId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Form not found');
      setGymName(json.gym_name || 'Gym');
      if (!json.available) {
        setAvailable(false);
        setMessage(json.message || 'This form is currently unavailable.');
        return;
      }
      setAvailable(true);
      setName(json.data.name);
      setDescription(json.data.description);
      setSuccessMessage(json.data.success_message);
      setSections(json.data.sections || []);
      setPlans(json.plans || []);
      const defaults: Record<string, unknown> = {};
      for (const section of json.data.sections || []) {
        for (const field of section.fields || []) {
          if (field.default_value) defaults[field.id] = field.default_value;
          if (field.field_type === 'checkbox') defaults[field.id] = false;
        }
      }
      setValues(defaults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load form');
    } finally {
      setLoading(false);
    }
  }, [publicId]);

  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey);
    if (saved) setReference(saved);
    load();
  }, [load, storageKey]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const invalid = validateFormAnswers(sections, values);
    if (invalid) {
      setError(invalid);
      return;
    }
    for (const section of sections) {
      for (const field of section.fields) {
        if ((field.field_type === 'photo' || field.field_type === 'file') && field.required && !files[field.id]) {
          setError(`${field.label} is required.`);
          return;
        }
      }
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = new FormData();
      payload.set('answers', JSON.stringify(values));
      for (const [fieldId, file] of Object.entries(files)) {
        if (file) payload.set(`file_${fieldId}`, file);
      }
      const res = await fetch(`/api/public/forms/${publicId}/submit`, { method: 'POST', body: payload });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unable to submit form');
      setReference(json.data.reference);
      if (json.data.success_message) setSuccessMessage(json.data.success_message);
      sessionStorage.setItem(storageKey, json.data.reference);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  const title = useMemo(() => name || 'Gym form', [name]);

  if (loading) {
    return <div className="px-5 py-16 text-center text-sm text-slate-400">Loading form…</div>;
  }

  if (!available) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2064B6]">{gymName}</p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-800">Form currently unavailable</h1>
        <p className="mt-3 text-sm text-slate-500">{message}</p>
      </div>
    );
  }

  if (error && !name) {
    return <div className="mx-auto max-w-lg px-5 py-16 text-center text-sm text-red-700">{error}</div>;
  }

  if (reference) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2064B6]">{gymName}</p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-800">Submitted</h1>
        <p className="mt-3 text-sm text-slate-500">{successMessage}</p>
        <p className="mt-4 rounded-lg border border-[#DAE1E7] bg-white px-3 py-2 text-sm font-medium text-[#2064B6]">
          Reference ID: {reference}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-16">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2064B6]">{gymName}</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-800">{title}</h1>
      {description ? <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p> : null}
      <form onSubmit={submit} className="admin-surface mt-8 p-5">
        <GymFormRenderer
          sections={sections}
          values={values}
          files={files}
          plans={plans}
          onChange={(fieldId, value) => setValues((current) => ({ ...current, [fieldId]: value }))}
          onFile={(fieldId, file) => setFiles((current) => ({ ...current, [fieldId]: file }))}
        />
        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
        <button type="submit" disabled={submitting} className="admin-primary-btn mt-6 w-full justify-center">
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
      </form>
    </div>
  );
}
