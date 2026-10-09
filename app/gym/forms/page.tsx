'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { QueryState } from '@/components/query-state';
import { FlipBackButton, FormSharePanel } from '@/components/gym/form-share-panel';

type FormCard = {
  id: string;
  name: string;
  description: string;
  status: string;
  public_id: string;
  created_at: string;
  updated_at: string;
  submission_count: number;
};

type SubmissionRow = {
  id: string;
  public_reference: string;
  submitter_name: string | null;
  submitter_phone: string | null;
  submitter_email: string | null;
  created_at: string;
  form_id: string;
  form_name: string;
  membership: string;
  membership_duration: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function GymFormsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'forms' | 'submissions'>('forms');
  const [forms, setForms] = useState<FormCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [flipped, setFlipped] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [subTotal, setSubTotal] = useState(0);
  const [subPage, setSubPage] = useState(1);
  const [subLoading, setSubLoading] = useState(false);
  const [subSearch, setSubSearch] = useState('');
  const [formFilter, setFormFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([]);

  const loadForms = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/gym-forms');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unable to load forms');
      setForms(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load forms');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSubmissions = useCallback(async () => {
    setSubLoading(true);
    const params = new URLSearchParams({
      page: String(subPage),
      limit: '20',
    });
    if (subSearch) params.set('search', subSearch);
    if (formFilter) params.set('formId', formFilter);
    if (planFilter) params.set('planId', planFilter);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    try {
      const res = await fetch(`/api/gym-forms/submissions?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unable to load submissions');
      setSubmissions(json.data || []);
      setSubTotal(json.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load submissions');
    } finally {
      setSubLoading(false);
    }
  }, [subPage, subSearch, formFilter, planFilter, from, to]);

  useEffect(() => {
    loadForms();
    fetch('/api/plans')
      .then((res) => res.json())
      .then((json) => setPlans(json.data || []))
      .catch(() => undefined);
  }, [loadForms]);

  useEffect(() => {
    if (tab === 'submissions') loadSubmissions();
  }, [tab, loadSubmissions]);

  const visibleForms = useMemo(() => {
    return forms.filter((form) => {
      if (status && form.status !== status) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return form.name.toLowerCase().includes(q) || form.description.toLowerCase().includes(q);
    });
  }, [forms, search, status]);

  const createForm = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/gym-forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New gym form', description: '' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unable to create form');
      router.push(`/gym/forms/${json.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create form');
      setCreating(false);
    }
  };

  const exportCsv = () => {
    const params = new URLSearchParams({ format: 'csv', limit: '2000' });
    if (subSearch) params.set('search', subSearch);
    if (formFilter) params.set('formId', formFilter);
    if (planFilter) params.set('planId', planFilter);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    window.location.href = `/api/gym-forms/submissions?${params}`;
  };

  return (
    <div className="px-4 py-4 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="admin-kicker">Operations</p>
          <h1 className="admin-page-title">Forms</h1>
          <p className="admin-page-sub">Manage and share your gym forms.</p>
        </div>
        <button type="button" onClick={createForm} disabled={creating} className="admin-primary-btn self-start">
          <Plus className="h-4 w-4" />
          Create Form
        </button>
      </div>

      <div className="mb-5 flex gap-2 border-b border-[#DAE1E7]">
        {(['forms', 'submissions'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`border-b-2 px-3 py-2 text-sm font-medium capitalize ${
              tab === item ? 'border-cyan-400 text-[#2064B6]' : 'border-transparent text-slate-400'
            }`}
          >
            {item === 'submissions' ? 'Submissions' : 'Forms'}
          </button>
        ))}
      </div>

      {tab === 'forms' ? (
        <>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search forms"
                className="admin-input"
              />
            </div>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="admin-field pl-3">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <QueryState loading={loading} error={error || null} empty={!loading && visibleForms.length === 0} emptyMessage="No forms yet. Create one to share with members.">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleForms.map((form) => (
                <div key={form.id} className="form-card-scene">
                  <div className={`form-card-inner ${flipped === form.id ? 'is-flipped' : ''}`}>
                    <div className="form-card-face admin-surface flex min-h-[280px] flex-col p-5">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-base font-semibold uppercase tracking-wide text-slate-800">{form.name}</h2>
                          <p className="mt-1 text-sm text-slate-400">{form.description || 'No description'}</p>
                        </div>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                            form.status === 'active'
                              ? 'border-[#6DCCC3] bg-[#6DCCC3]/20 text-[#2064B6]'
                              : 'border-[#DAE1E7] bg-white text-slate-500'
                          }`}
                        >
                          {form.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <dl className="mt-auto space-y-1 text-sm text-slate-500">
                        <div className="flex justify-between">
                          <dt>Created</dt>
                          <dd>{formatDate(form.created_at)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>Updated</dt>
                          <dd>{formatDate(form.updated_at)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>Submissions</dt>
                          <dd>{form.submission_count}</dd>
                        </div>
                      </dl>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <a href={`/f/${form.public_id}`} target="_blank" rel="noreferrer" className="admin-secondary-btn">
                          View Form
                        </a>
                        <Link href={`/gym/forms/${form.id}`} className="admin-secondary-btn">
                          Edit
                        </Link>
                        <button type="button" onClick={() => setFlipped(form.id)} className="admin-primary-btn">
                          Share
                        </button>
                      </div>
                    </div>
                    <div className="form-card-back admin-surface">
                      <FormSharePanel publicId={form.public_id} formName={form.name} compact />
                      <div className="flex justify-center pb-4">
                        <FlipBackButton onClick={() => setFlipped(null)} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </QueryState>
        </>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <input
              value={subSearch}
              onChange={(event) => {
                setSubPage(1);
                setSubSearch(event.target.value);
              }}
              placeholder="Search name, phone, email"
              className="admin-field"
            />
            <select
              value={formFilter}
              onChange={(event) => {
                setSubPage(1);
                setFormFilter(event.target.value);
              }}
              className="admin-field"
            >
              <option value="">All forms</option>
              {forms.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.name}
                </option>
              ))}
            </select>
            <select
              value={planFilter}
              onChange={(event) => {
                setSubPage(1);
                setPlanFilter(event.target.value);
              }}
              className="admin-field"
            >
              <option value="">All memberships</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
            <input type="date" value={from} onChange={(event) => { setSubPage(1); setFrom(event.target.value); }} className="admin-field" />
            <input type="date" value={to} onChange={(event) => { setSubPage(1); setTo(event.target.value); }} className="admin-field" />
          </div>
          <div className="mb-4">
            <button type="button" onClick={exportCsv} className="admin-secondary-btn">
              Export CSV
            </button>
          </div>
          <div className="admin-surface overflow-x-auto">
            <QueryState loading={subLoading} error={null} empty={!subLoading && submissions.length === 0} emptyMessage="No submissions yet.">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[#DAE1E7] bg-white text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Form</th>
                    <th className="px-4 py-3">Membership</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((row) => (
                    <tr key={row.id} className="border-b border-white/5 last:border-0 hover:bg-white">
                      <td className="px-4 py-3 font-medium text-slate-800">{row.submitter_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{row.submitter_phone || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{row.form_name}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {row.membership || '—'}
                        {row.membership_duration ? ` · ${row.membership_duration}` : ''}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(row.created_at)}</td>
                      <td className="px-4 py-3 text-slate-500">{formatTime(row.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-[#6DCCC3] bg-[#6DCCC3]/20 px-2 py-0.5 text-xs text-[#2064B6]">Submitted</span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/gym/forms/${row.form_id}/submissions/${row.id}`} className="text-sm font-medium text-[#2064B6]">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </QueryState>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
            <span>{subTotal} submissions</span>
            <div className="flex gap-2">
              <button type="button" disabled={subPage <= 1} onClick={() => setSubPage((page) => page - 1)} className="admin-secondary-btn">
                Previous
              </button>
              <button
                type="button"
                disabled={subPage * 20 >= subTotal}
                onClick={() => setSubPage((page) => page + 1)}
                className="admin-secondary-btn"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
      {tab === 'forms' ? null : error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
