'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { QueryState } from '@/components/query-state';

interface Plan {
  id: string;
  name: string;
  duration_days: number;
  price: number;
  discount: number;
  final_price: number;
  description: string | null;
  status: string;
  tier: string;
}

interface PlanForm {
  name: string;
  duration_days: string;
  price: string;
  discount: string;
  description: string;
  tier: 'standard' | 'premium';
}

const emptyForm: PlanForm = {
  name: '',
  duration_days: '',
  price: '',
  discount: '',
  description: '',
  tier: 'standard',
};

const statusStyles: Record<string, string> = {
  active: 'bg-[#6DCCC3]/20 text-[#2064B6] border-[#6DCCC3]',
  inactive: 'bg-white text-slate-500 border-[#DAE1E7]',
};

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/plans');
      if (!res.ok) throw new Error('Failed to fetch plans');
      const json = await res.json();
      setPlans(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const openAddModal = () => {
    setEditingPlan(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (p: Plan) => {
    setEditingPlan(p);
    setForm({
      name: p.name,
      duration_days: String(p.duration_days),
      price: String(p.price),
      discount: String(p.discount),
      description: p.description || '',
      tier: p.tier === 'premium' ? 'premium' : 'standard',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        name: form.name,
        duration_days: Number(form.duration_days),
        price: Number(form.price),
        discount: Number(form.discount || 0),
        description: form.description,
        tier: form.tier,
      };
      if (editingPlan) {
        const res = await fetch(`/api/plans/${editingPlan.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const j = await res.json();
          throw new Error(j.error || 'Failed to update plan');
        }
      } else {
        const res = await fetch('/api/plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const j = await res.json();
          throw new Error(j.error || 'Failed to create plan');
        }
      }
      setModalOpen(false);
      fetchPlans();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/plans/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || 'Failed to delete plan');
      }
      setDeleteTarget(null);
      fetchPlans();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="px-4 py-4 lg:p-8"
    >
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="admin-kicker">Membership</p>
          <h1 className="admin-page-title">Plans</h1>
          <p className="mt-1 text-sm text-slate-400">Create and manage membership plans.</p>
        </div>
        <button
          onClick={openAddModal}
          className="admin-primary-btn"
        >
          <Plus className="h-4 w-4" />
          Add Plan
        </button>
      </div>

      {/* Plan cards */}
      <QueryState loading={loading} error={error || null} empty={plans.length === 0} emptyMessage="No plans found">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.id}
              className={`gym-card-hover admin-surface relative overflow-hidden p-5 ${
                p.status === 'active' ? 'shadow-[0_12px_28px_rgba(32,100,182,0.08)]' : ''
              }`}
            >
              {p.status === 'active' && (
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full border border-[#6DCCC3]/50" aria-hidden />
              )}
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{p.tier || 'standard'}</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-800">{p.name}</h2>
                </div>
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusStyles[p.status] || statusStyles.active}`}>
                  {p.status}
                </span>
              </div>
              <p className="relative mt-4 text-3xl font-semibold tracking-tight text-slate-800">
                ${p.final_price.toFixed(2)}
              </p>
              <p className="relative mt-1 text-xs text-slate-400">{p.duration_days} days</p>
              {p.description ? <p className="relative mt-3 text-sm text-slate-500">{p.description}</p> : null}
              <dl className="relative mt-4 space-y-1 text-xs text-slate-400">
                <div className="flex justify-between">
                  <dt>Price</dt>
                  <dd className="text-slate-600">${p.price.toFixed(2)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Discount</dt>
                  <dd className="text-slate-600">${p.discount.toFixed(2)}</dd>
                </div>
              </dl>
              <div className="relative mt-5 flex gap-2">
                <button
                  onClick={() => openEditModal(p)}
                  className="admin-secondary-btn flex-1 justify-center"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={() => setDeleteTarget(p)}
                  className="admin-secondary-btn justify-center text-red-300 hover:border-red-400/30"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </QueryState>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="admin-modal max-w-md"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800">
                  {editingPlan ? 'Edit Plan' : 'Add Plan'}
                </h2>
                <button onClick={() => setModalOpen(false)} className="rounded-md p-1 text-slate-500 hover:bg-[#EEF4F8]">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="admin-field"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Tier</label>
                  <select
                    value={form.tier}
                    onChange={(e) => setForm({ ...form, tier: e.target.value === 'premium' ? 'premium' : 'standard' })}
                    className="admin-field"
                  >
                    <option value="standard">Standard</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Duration (days) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={form.duration_days}
                    onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
                    className="admin-field"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Price *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      className="admin-field"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Discount</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.discount}
                      onChange={(e) => setForm({ ...form, discount: e.target.value })}
                      className="admin-field"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    className="admin-field"
                  />
                </div>

                {form.price && form.discount && Number(form.discount) > 0 && (
                  <p className="text-xs text-slate-400">
                    Final price: <span className="font-medium text-slate-800">
                      ${(Math.max(0, Number(form.price) - Number(form.discount || 0))).toFixed(2)}
                    </span>
                  </p>
                )}

                {formError && <p className="text-sm text-red-500">{formError}</p>}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="admin-secondary-btn"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="admin-primary-btn disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : editingPlan ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteTarget(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="admin-modal max-w-sm"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <h2 className="text-lg font-semibold text-slate-800">Delete Plan</h2>
              </div>
              <p className="mb-5 text-sm text-slate-400">
                Are you sure you want to delete <span className="font-medium text-slate-800">{deleteTarget.name}</span>? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="admin-secondary-btn"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
