'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { GymMemberCard } from '@/components/gym/member-card';
import { QueryState } from '@/components/query-state';
import { useGymPortal } from '@/components/gym/portal-context';
import { canDeleteMembers, canManageMembers } from '@/lib/roles';
import { MemberRegistrationWizard } from '@/components/gym/member-registration-wizard';
import { MemberAvatar } from '@/components/gym/member-avatar';
import { PhotoCapture } from '@/components/gym/photo-capture';

interface Plan {
  id: string;
  name: string;
  duration_days: number;
  price: number;
  final_price: number;
}

interface Member {
  id: string;
  member_id: string;
  name: string;
  phone: string | null;
  status: string;
  expiry_date: string | null;
  plan_id: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  emergency_contact: string | null;
  start_date: string | null;
  amount_paid: number;
  notes: string | null;
  photo_url?: string | null;
}

interface MemberForm {
  name: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  address: string;
  emergency_contact: string;
  plan_id: string;
  start_date: string;
  notes: string;
}

const emptyForm: MemberForm = {
  name: '',
  phone: '',
  date_of_birth: '',
  gender: '',
  address: '',
  emergency_contact: '',
  plan_id: '',
  start_date: '',
  notes: '',
};

export default function MembersPage() {
  const router = useRouter();
  const { role } = useGymPortal();
  const canEditMembers = canManageMembers(role);
  const canRemoveMembers = canDeleteMembers(role);
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [plans, setPlans] = useState<Plan[]>([]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [form, setForm] = useState<MemberForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [editPhoto, setEditPhoto] = useState<File | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState(false);

  const limit = 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/members?${params}`);
      if (!res.ok) throw new Error('Failed to fetch members');
      const json = await res.json();
      setMembers(json.data || []);
      setTotal(json.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/plans');
      if (!res.ok) return;
      const json = await res.json();
      setPlans(json.data || []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(search);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const openAddModal = () => {
    setEditingMember(null);
    setForm(emptyForm);
    setFormError('');
    setEditPhoto(null);
    setModalOpen(true);
  };

  const openEditModal = (m: Member) => {
    setEditingMember(m);
    setForm({
      name: m.name || '',
      phone: m.phone || '',
      date_of_birth: m.date_of_birth || '',
      gender: m.gender || '',
      address: m.address || '',
      emergency_contact: m.emergency_contact || '',
      plan_id: m.plan_id || '',
      start_date: m.start_date || '',
      notes: m.notes || '',
    });
    setFormError('');
    setEditPhoto(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (editingMember) {
        const res = await fetch(`/api/members/${editingMember.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const j = await res.json();
          throw new Error(j.error || 'Failed to update member');
        }
        if (editPhoto) {
          const photoData = new FormData();
          photoData.set('photo', editPhoto);
          const photoRes = await fetch(`/api/members/${editingMember.id}/photo`, {
            method: 'POST',
            body: photoData,
          });
          const photoJson = await photoRes.json().catch(() => ({}));
          if (!photoRes.ok) throw new Error(photoJson.error || 'Failed to save photograph');
        }
      } else {
        return;
      }
      setModalOpen(false);
      fetchMembers();
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
      const res = await fetch(`/api/members/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || 'Failed to delete member');
      }
      setDeleteTarget(null);
      fetchMembers();
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
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="admin-kicker">Roster</p>
          <h1 className="admin-page-title">Members</h1>
          <p className="admin-page-sub">Identity cards for every member. Star = membership plan.</p>
        </div>
        {canEditMembers && (
        <button
          onClick={openAddModal}
          className="admin-primary-btn flex-shrink-0 sm:px-4 sm:py-2.5"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or member ID..."
            className="admin-input"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="admin-field"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Payment due</option>
          <option value="expiring">Expiring</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {/* Table */}
      <QueryState loading={loading} error={error || null} empty={members.length === 0} emptyMessage="No members found">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {members.map((m) => (
              <div key={m.id} className="space-y-2">
                <GymMemberCard
                  member={m}
                  href={`/gym/members/${m.id}`}
                  meta={m.expiry_date ? `Expires ${new Date(m.expiry_date).toLocaleDateString()}` : m.phone || undefined}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push(`/gym/members/${m.id}`)}
                    className="admin-secondary-btn flex-1 justify-center py-2 text-xs"
                    title="View"
                  >
                    <Eye className="mx-auto h-4 w-4" />
                  </button>
                  {canEditMembers && (
                  <button
                    onClick={() => openEditModal(m)}
                    className="admin-secondary-btn flex-1 justify-center py-2 text-xs"
                    title="Edit"
                  >
                    <Pencil className="mx-auto h-4 w-4" />
                  </button>
                  )}
                  {canRemoveMembers && (
                  <button
                    onClick={() => setDeleteTarget(m)}
                    className="admin-secondary-btn flex-1 justify-center py-2 text-xs text-red-300 hover:border-red-400/30"
                    title="Delete"
                  >
                    <Trash2 className="mx-auto h-4 w-4" />
                  </button>
                  )}
                </div>
              </div>
            ))}
          </div>
      </QueryState>

        {/* Pagination */}
        {!loading && members.length > 0 && (
          <div className="mt-4 flex items-center justify-between px-1 py-2">
            <p className="text-xs text-slate-400">
              Page {page} of {totalPages} · {total} total
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
              className="admin-modal max-w-lg"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800">
                  {editingMember ? 'Edit Member' : 'Register member'}
                </h2>
                <button onClick={() => setModalOpen(false)} className="rounded-md p-1 text-slate-500 hover:bg-[#EEF4F8]">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {!editingMember ? (
                <MemberRegistrationWizard
                  plans={plans}
                  onClose={() => setModalOpen(false)}
                  onComplete={() => {
                    setModalOpen(false);
                    fetchMembers();
                  }}
                />
              ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {editingMember.photo_url && !editPhoto && (
                  <MemberAvatar
                    memberId={editingMember.id}
                    photoUrl={editingMember.photo_url}
                    name={editingMember.name}
                    className="h-20 w-20"
                  />
                )}
                <PhotoCapture
                  value={editPhoto}
                  required={!editingMember.photo_url}
                  onChange={setEditPhoto}
                />
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Phone</label>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="admin-field"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Date of Birth</label>
                    <input
                      type="date"
                      value={form.date_of_birth}
                      onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                      className="admin-field"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className="admin-field"
                  >
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Address</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="admin-field"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Emergency Contact</label>
                  <input
                    type="text"
                    value={form.emergency_contact}
                    onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
                    className="admin-field"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Plan *</label>
                    <select
                      required
                      value={form.plan_id}
                      onChange={(e) => setForm({ ...form, plan_id: e.target.value })}
                      className="admin-field"
                    >
                      <option value="">Select plan...</option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (${p.final_price})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Start Date *</label>
                    <input
                      type="date"
                      required
                      value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                      className="admin-field"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                    className="admin-field"
                  />
                </div>

                {formError && (
                  <p className="text-sm text-red-500">{formError}</p>
                )}

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
                    {saving ? 'Saving...' : editingMember ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
              )}
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
                <h2 className="text-lg font-semibold text-slate-800">Delete Member</h2>
              </div>
              <p className="mb-5 text-sm text-slate-400">
                Are you sure you want to delete <span className="font-medium text-slate-800">{deleteTarget.name}</span> ({deleteTarget.member_id})? This action cannot be undone.
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
