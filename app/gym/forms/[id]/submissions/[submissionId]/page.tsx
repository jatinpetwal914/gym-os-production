'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { QueryState } from '@/components/query-state';
import type { GymFormAnswer } from '@/lib/gym-forms';

type Snapshot = {
  name?: string;
  description?: string;
  sections?: { id: string; title: string; fields: { id: string; label: string; field_type: string }[] }[];
};

type SubmissionDetail = {
  id: string;
  public_reference: string;
  submitter_name: string | null;
  submitter_phone: string | null;
  submitter_email: string | null;
  created_at: string;
  form_id: string;
  member_id: string | null;
  schema_snapshot: Snapshot;
  answers: GymFormAnswer[];
  gym_forms: { name?: string; public_id?: string } | { name?: string; public_id?: string }[] | null;
  membership_plans: { name?: string; duration_days?: number } | { name?: string; duration_days?: number }[] | null;
  members: { id?: string; member_id?: string; name?: string } | { id?: string; member_id?: string; name?: string }[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

function answerFor(answers: GymFormAnswer[], fieldId: string) {
  return answers.find((item) => item.field_id === fieldId);
}

function displayValue(answer?: GymFormAnswer) {
  if (!answer || answer.value == null || answer.value === '') return '—';
  if (Array.isArray(answer.value)) return answer.value.join(', ');
  if (typeof answer.value === 'boolean') return answer.value ? 'Yes' : 'No';
  if (answer.field_type === 'file' || answer.field_type === 'photo') {
    return String(answer.value);
  }
  return String(answer.value);
}

export default function GymFormSubmissionPage() {
  const params = useParams();
  const router = useRouter();
  const formId = params.id as string;
  const submissionId = params.submissionId as string;
  const [data, setData] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/gym-forms/submissions/${submissionId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Submission not found');
      setData(json.data);
      setName(json.data.submitter_name || '');
      setPhone(json.data.submitter_phone || '');
      setEmail(json.data.submitter_email || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load submission');
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    const res = await fetch(`/api/gym-forms/submissions/${submissionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submitter_name: name, submitter_phone: phone, submitter_email: email }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || 'Unable to update submission');
      return;
    }
    setEditing(false);
    load();
  };

  const remove = async () => {
    if (!confirm('Delete this submission?')) return;
    const res = await fetch(`/api/gym-forms/submissions/${submissionId}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || 'Unable to delete submission');
      return;
    }
    router.push('/gym/forms');
  };

  if (loading || error || !data) {
    return (
      <div className="px-4 py-4 lg:p-8">
        <Link href="/gym/forms" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400">
          <ArrowLeft className="h-4 w-4" /> Back to Forms
        </Link>
        <QueryState loading={loading} error={error || null} empty={!loading && !data} emptyMessage="Submission not found">
          <span />
        </QueryState>
      </div>
    );
  }

  const formMeta = one(data.gym_forms);
  const plan = one(data.membership_plans);
  const member = one(data.members);
  const answers = Array.isArray(data.answers) ? data.answers : [];
  const snapshot = data.schema_snapshot || {};

  return (
    <div className="px-4 py-4 lg:p-8">
      <Link href="/gym/forms" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400">
        <ArrowLeft className="h-4 w-4" /> Back to Forms
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="admin-page-title">{formMeta?.name || 'Submission'}</h1>
          <p className="admin-page-sub">
            Reference {data.public_reference} · {new Date(data.created_at).toLocaleString('en-IN')}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/gym/forms/${formId}`} className="admin-secondary-btn">
            Edit form
          </Link>
          <button type="button" onClick={remove} className="admin-secondary-btn">
            Delete
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="admin-surface p-5 lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Member information</h2>
          {editing ? (
            <div className="space-y-3">
              <input value={name} onChange={(event) => setName(event.target.value)} className="admin-field" />
              <input value={phone} onChange={(event) => setPhone(event.target.value)} className="admin-field" />
              <input value={email} onChange={(event) => setEmail(event.target.value)} className="admin-field" />
              <button type="button" onClick={save} className="admin-primary-btn">
                Save
              </button>
            </div>
          ) : (
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-slate-400">Name</dt>
                <dd className="font-medium text-slate-800">{data.submitter_name || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Phone</dt>
                <dd>{data.submitter_phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Email</dt>
                <dd>{data.submitter_email || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Membership</dt>
                <dd>
                  {plan?.name || '—'}
                  {plan?.duration_days ? ` · ${plan.duration_days} days` : ''}
                </dd>
              </div>
              {member?.id ? (
                <div>
                  <dt className="text-slate-400">Linked member</dt>
                  <dd>
                    <Link href={`/gym/members/${member.id}`} className="text-[#2064B6]">
                      {member.member_id} · {member.name}
                    </Link>
                  </dd>
                </div>
              ) : null}
            </dl>
          )}
          {!editing ? (
            <button type="button" onClick={() => setEditing(true)} className="admin-secondary-btn mt-4">
              Edit contact
            </button>
          ) : null}
        </div>

        <div className="space-y-4 lg:col-span-2">
          {(snapshot.sections || []).map((section) => (
            <section key={section.id} className="admin-surface p-5">
              <h2 className="mb-4 text-sm font-semibold text-slate-800">{section.title}</h2>
              <dl className="space-y-3">
                {section.fields.map((field) => {
                  const answer = answerFor(answers, field.id);
                  const isFile = field.field_type === 'file' || field.field_type === 'photo';
                  const path = isFile && answer?.value ? String(answer.value) : '';
                  return (
                    <div key={field.id}>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">{field.label}</dt>
                      <dd className="mt-1 text-sm text-slate-800">
                        {isFile && path ? (
                          field.field_type === 'photo' ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`/api/gym-forms/files?path=${encodeURIComponent(path)}`}
                              alt={field.label}
                              className="h-32 w-32 rounded-lg object-cover"
                            />
                          ) : (
                            <a
                              href={`/api/gym-forms/files?path=${encodeURIComponent(path)}`}
                              className="text-[#2064B6]"
                              target="_blank"
                              rel="noreferrer"
                            >
                              Download file
                            </a>
                          )
                        ) : (
                          displayValue(answer)
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
