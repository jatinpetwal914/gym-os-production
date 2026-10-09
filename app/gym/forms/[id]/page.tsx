'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { QueryState } from '@/components/query-state';
import { GymFormRenderer } from '@/components/gym/gym-form-renderer';
import { FormSharePanel } from '@/components/gym/form-share-panel';
import {
  emptyField,
  emptySection,
  fieldTypeLabel,
  GYM_FORM_FIELD_TYPES,
  type GymFormFieldType,
  type GymFormRecord,
  type GymFormSection,
} from '@/lib/gym-forms';

const steps = ['Details', 'Fields', 'Settings', 'Preview', 'Publish'] as const;

export default function GymFormBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<GymFormRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [plans, setPlans] = useState<{ id: string; name: string; duration_days: number; final_price: number }[]>([]);
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [formRes, planRes] = await Promise.all([fetch(`/api/gym-forms/${id}`), fetch('/api/plans')]);
      const formJson = await formRes.json();
      const planJson = await planRes.json();
      if (!formRes.ok) throw new Error(formJson.error || 'Form not found');
      setForm(formJson.data);
      setPlans(planJson.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load form');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (next = form, publish = false) => {
    if (!next) return false;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/gym-forms/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: next.name,
          description: next.description,
          status: publish ? 'active' : next.status,
          success_message: next.success_message,
          member_sync: next.member_sync,
          allowed_plan_ids: next.allowed_plan_ids,
          sections: next.sections,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unable to save form');
      setForm(json.data);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save form');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async () => {
    const res = await fetch(`/api/gym-forms/${id}/duplicate`, { method: 'POST' });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Unable to duplicate');
      return;
    }
    router.push(`/gym/forms/${json.data.id}`);
  };

  const remove = async () => {
    if (!confirm('Delete this form? Submissions must be removed first.')) return;
    const res = await fetch(`/api/gym-forms/${id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || 'Unable to delete form');
      return;
    }
    router.push('/gym/forms');
  };

  const updateSections = (sections: GymFormSection[]) => {
    if (!form) return;
    setForm({ ...form, sections });
  };

  const allowedPlans = useMemo(() => {
    if (!form?.allowed_plan_ids.length) return plans;
    return plans.filter((plan) => form.allowed_plan_ids.includes(plan.id));
  }, [form, plans]);

  if (loading || error || !form) {
    return (
      <div className="px-4 py-4 lg:p-8">
        <Link href="/gym/forms" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400">
          <ArrowLeft className="h-4 w-4" /> Back to Forms
        </Link>
        <QueryState loading={loading} error={error || null} empty={!loading && !error && !form} emptyMessage="Form not found">
          <span />
        </QueryState>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/gym/forms" className="mb-2 inline-flex items-center gap-1.5 text-sm text-slate-400">
            <ArrowLeft className="h-4 w-4" /> Back to Forms
          </Link>
          <h1 className="admin-page-title">{form.name || 'Form builder'}</h1>
          <p className="admin-page-sub">Build, preview, and publish a shareable gym form.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={duplicate} className="admin-secondary-btn">
            Duplicate
          </button>
          <button type="button" onClick={remove} className="admin-secondary-btn">
            Delete
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {steps.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(index)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              step === index ? 'bg-[#2064B6] text-white' : 'bg-white text-slate-500 ring-1 ring-[#DAE1E7]'
            }`}
          >
            {index + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="admin-surface max-w-2xl space-y-4 p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Form name</label>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="admin-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Description</label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="admin-field"
            />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          {form.sections.map((section, sectionIndex) => (
            <div key={section.id} className="admin-surface p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <input
                  value={section.title}
                  onChange={(event) => {
                    const sections = [...form.sections];
                    sections[sectionIndex] = { ...section, title: event.target.value };
                    updateSections(sections);
                  }}
                  className="admin-field flex-1 font-medium"
                />
                <button
                  type="button"
                  className="admin-secondary-btn"
                  onClick={() => updateSections(moveItem(form.sections, sectionIndex, -1))}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="admin-secondary-btn"
                  onClick={() => updateSections(moveItem(form.sections, sectionIndex, 1))}
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="admin-secondary-btn"
                  onClick={() => updateSections(form.sections.filter((_, index) => index !== sectionIndex))}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                {section.fields.map((field, fieldIndex) => (
                  <div key={field.id} className="rounded-lg border border-[#DAE1E7] p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={field.label}
                        onChange={(event) => {
                          const sections = [...form.sections];
                          const fields = [...section.fields];
                          fields[fieldIndex] = { ...field, label: event.target.value };
                          sections[sectionIndex] = { ...section, fields };
                          updateSections(sections);
                        }}
                        className="admin-field"
                        placeholder="Label"
                      />
                      <select
                        value={field.field_type}
                        onChange={(event) => {
                          const type = event.target.value as GymFormFieldType;
                          const sections = [...form.sections];
                          const fields = [...section.fields];
                          fields[fieldIndex] = {
                            ...field,
                            field_type: type,
                            options:
                              type === 'dropdown' || type === 'radio' || type === 'multi_checkbox'
                                ? field.options.length
                                  ? field.options
                                  : ['Option 1']
                                : [],
                          };
                          sections[sectionIndex] = { ...section, fields };
                          updateSections(sections);
                        }}
                        className="admin-field"
                      >
                        {GYM_FORM_FIELD_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {fieldTypeLabel(type)}
                          </option>
                        ))}
                      </select>
                      <input
                        value={field.placeholder}
                        onChange={(event) => {
                          const sections = [...form.sections];
                          const fields = [...section.fields];
                          fields[fieldIndex] = { ...field, placeholder: event.target.value };
                          sections[sectionIndex] = { ...section, fields };
                          updateSections(sections);
                        }}
                        className="admin-field"
                        placeholder="Placeholder"
                      />
                      <input
                        value={field.help_text}
                        onChange={(event) => {
                          const sections = [...form.sections];
                          const fields = [...section.fields];
                          fields[fieldIndex] = { ...field, help_text: event.target.value };
                          sections[sectionIndex] = { ...section, fields };
                          updateSections(sections);
                        }}
                        className="admin-field"
                        placeholder="Help text"
                      />
                    </div>
                    {(field.field_type === 'dropdown' || field.field_type === 'radio' || field.field_type === 'multi_checkbox') && (
                      <textarea
                        className="admin-field mt-3"
                        rows={2}
                        value={field.options.join('\n')}
                        onChange={(event) => {
                          const sections = [...form.sections];
                          const fields = [...section.fields];
                          fields[fieldIndex] = {
                            ...field,
                            options: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean),
                          };
                          sections[sectionIndex] = { ...section, fields };
                          updateSections(sections);
                        }}
                        placeholder="One option per line"
                      />
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-sm text-slate-500">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(event) => {
                            const sections = [...form.sections];
                            const fields = [...section.fields];
                            fields[fieldIndex] = { ...field, required: event.target.checked };
                            sections[sectionIndex] = { ...section, fields };
                            updateSections(sections);
                          }}
                        />
                        Required
                      </label>
                      <button
                        type="button"
                        className="admin-secondary-btn"
                        onClick={() => {
                          const sections = [...form.sections];
                          sections[sectionIndex] = { ...section, fields: moveItem(section.fields, fieldIndex, -1) };
                          updateSections(sections);
                        }}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="admin-secondary-btn"
                        onClick={() => {
                          const sections = [...form.sections];
                          sections[sectionIndex] = { ...section, fields: moveItem(section.fields, fieldIndex, 1) };
                          updateSections(sections);
                        }}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="admin-secondary-btn"
                        onClick={() => {
                          const sections = [...form.sections];
                          sections[sectionIndex] = {
                            ...section,
                            fields: section.fields.filter((_, index) => index !== fieldIndex),
                          };
                          updateSections(sections);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="admin-secondary-btn mt-4"
                onClick={() => {
                  const sections = [...form.sections];
                  sections[sectionIndex] = { ...section, fields: [...section.fields, emptyField()] };
                  updateSections(sections);
                }}
              >
                <Plus className="h-4 w-4" /> Add field
              </button>
            </div>
          ))}
          <button type="button" className="admin-secondary-btn" onClick={() => updateSections([...form.sections, emptySection(`Section ${form.sections.length + 1}`)])}>
            <Plus className="h-4 w-4" /> Add section
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="admin-surface max-w-2xl space-y-4 p-5">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={form.status === 'active'}
              onChange={(event) => setForm({ ...form, status: event.target.checked ? 'active' : 'inactive' })}
            />
            Active (public submissions allowed)
          </label>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Success message</label>
            <textarea
              rows={3}
              value={form.success_message}
              onChange={(event) => setForm({ ...form, success_message: event.target.value })}
              className="admin-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">After submission</label>
            <select
              value={form.member_sync}
              onChange={(event) => setForm({ ...form, member_sync: event.target.value as GymFormRecord['member_sync'] })}
              className="admin-field"
            >
              <option value="none">Save submission only</option>
              <option value="create_or_update">Create or update member (no payment charged)</option>
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Member sync matches by phone. Existing verified photos are not overwritten. Desk payment is not charged from this form.
            </p>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-slate-500">Membership plans available on this form</p>
            <div className="space-y-2">
              {plans.map((plan) => {
                const checked = form.allowed_plan_ids.length === 0 || form.allowed_plan_ids.includes(plan.id);
                return (
                  <label key={plan.id} className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        const current = form.allowed_plan_ids.length ? [...form.allowed_plan_ids] : plans.map((item) => item.id);
                        const next = event.target.checked
                          ? Array.from(new Set([...current, plan.id]))
                          : current.filter((item) => item !== plan.id);
                        setForm({ ...form, allowed_plan_ids: next.length === plans.length ? [] : next });
                      }}
                    />
                    {plan.name} · {plan.duration_days} days
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="admin-surface max-w-2xl p-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#2064B6]">Public preview</p>
          <h2 className="text-xl font-semibold text-slate-800">{form.name}</h2>
          <p className="mb-6 text-sm text-slate-400">{form.description}</p>
          <GymFormRenderer
            sections={form.sections}
            values={previewValues}
            plans={allowedPlans}
            onChange={(fieldId, value) => setPreviewValues((current) => ({ ...current, [fieldId]: value }))}
          />
        </div>
      )}

      {step === 4 && (
        <div className="admin-surface max-w-xl p-5">
          <p className="mb-3 text-sm text-slate-500">Publish to generate a public URL and QR code. Only active forms accept submissions.</p>
          <FormSharePanel publicId={form.public_id} formName={form.name} />
          <button
            type="button"
            className="admin-primary-btn mt-4"
            disabled={saving}
            onClick={() => save(form, true)}
          >
            {form.status === 'active' ? 'Save and keep published' : 'Publish form'}
          </button>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {step > 0 && (
          <button type="button" className="admin-secondary-btn" onClick={() => setStep((value) => value - 1)}>
            Back
          </button>
        )}
        <button type="button" className="admin-secondary-btn" disabled={saving} onClick={() => save()}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {step < steps.length - 1 && (
          <button
            type="button"
            className="admin-primary-btn"
            disabled={saving}
            onClick={async () => {
              const ok = await save();
              if (ok) setStep((value) => value + 1);
            }}
          >
            Save and continue
          </button>
        )}
      </div>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
    </div>
  );
}

function moveItem<T>(items: T[], index: number, direction: number) {
  const next = [...items];
  const target = index + direction;
  if (target < 0 || target >= next.length) return next;
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}
