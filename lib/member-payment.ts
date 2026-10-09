/**
 * Member (gym desk) payments. Manual collection today; a gateway can plug in
 * later by calling the same record_payment RPC after server-side verification.
 * Do not treat frontend status as source of truth.
 */

export const MEMBER_PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'digital_wallet', 'upi'] as const;
export type MemberPaymentMethod = (typeof MEMBER_PAYMENT_METHODS)[number];

export function normalizeMemberPaymentMethod(value: unknown): MemberPaymentMethod {
  const method = String(value || 'cash')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (method === 'bank') return 'bank_transfer';
  if (method === 'wallet' || method === 'upi') return 'digital_wallet';
  if ((MEMBER_PAYMENT_METHODS as readonly string[]).includes(method)) {
    return method as MemberPaymentMethod;
  }
  return 'cash';
}

export function displayPaymentStatus(status: string | null | undefined) {
  const value = (status || 'completed').toLowerCase();
  if (value === 'completed') return 'Paid';
  if (value === 'partially_refunded') return 'Partially refunded';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function paymentStatusClass(status: string | null | undefined) {
  const value = (status || 'completed').toLowerCase();
  if (value === 'completed' || value === 'paid') return 'border-cyan-400/25 bg-cyan-400/10 text-cyan-200';
  if (value === 'pending' || value === 'processing') return 'border-white/15 bg-white/5 text-zinc-300';
  if (value === 'refunded' || value === 'partially_refunded') return 'border-cyan-400/20 bg-cyan-400/5 text-cyan-200';
  if (value === 'cancelled' || value === 'failed' || value === 'reversed') {
    return 'border-red-500/25 bg-red-500/10 text-red-200';
  }
  return 'border-white/10 bg-white/5 text-zinc-300';
}

export type RecordMemberPaymentInput = {
  memberId: string;
  planId: string;
  amount: number;
  discount?: number;
  method?: string;
  notes?: string;
  branchId?: string | null;
};

type RecordPaymentClient = {
  rpc(
    fn: 'record_payment',
    args: {
      p_amount: number;
      p_branch_id?: string;
      p_discount: number;
      p_member_id: string;
      p_method: string;
      p_notes: string;
      p_plan_id?: string;
    }
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export async function recordMemberPayment(supabase: RecordPaymentClient, input: RecordMemberPaymentInput) {
  return supabase.rpc('record_payment', {
    p_member_id: input.memberId,
    p_plan_id: input.planId,
    p_amount: Number(input.amount),
    p_discount: Number(input.discount || 0),
    p_method: normalizeMemberPaymentMethod(input.method),
    p_notes: input.notes || '',
    p_branch_id: input.branchId || undefined,
  });
}
