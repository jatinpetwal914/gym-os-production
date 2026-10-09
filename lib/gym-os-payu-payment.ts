import { createAdminClient } from '@/lib/supabase-server';
import {
  EMAIL_NOT_SENT_NOTICE,
  sendGymOsRegistrationEmails,
} from '@/lib/gym-os-registration-email';
import {
  amountsMatch,
  getPayUConfig,
  isPayUSuccessStatus,
  PAYMENT_UNAVAILABLE_MESSAGE,
  type PayUCallbackParams,
  verifyPayUResponseHash,
} from '@/lib/payu';
import type { GymOsSubmitResult } from '@/lib/gym-os-saas-plans';

type RegistrationRow = {
  public_reference_id: string;
  final_amount: number | string;
  payment_status: string;
  cashfree_order_id: string | null;
};

type PaymentAdmin = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: RegistrationRow | null; error: { message: string } | null }>;
      };
    };
  };
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function paymentAdmin() {
  return createAdminClient() as unknown as PaymentAdmin;
}

async function loadByTxnOrRef(txnid: string, reference: string) {
  const admin = paymentAdmin();

  if (txnid) {
    const { data, error } = await admin
      .from('gym_os_registration_requests')
      .select('public_reference_id, final_amount, payment_status, cashfree_order_id')
      .eq('cashfree_order_id', txnid)
      .maybeSingle();
    if (error) {
      console.error('PayU lookup by txnid', error);
      return { error: true as const, row: null };
    }
    if (data) return { error: false as const, row: data };
  }

  if (reference) {
    const { data, error } = await admin
      .from('gym_os_registration_requests')
      .select('public_reference_id, final_amount, payment_status, cashfree_order_id')
      .eq('public_reference_id', reference)
      .maybeSingle();
    if (error) {
      console.error('PayU lookup by reference', error);
      return { error: true as const, row: null };
    }
    if (data) return { error: false as const, row: data };
  }

  return { error: false as const, row: null };
}

export async function getRegistrationPaymentStatus(txnid: string, reference: string) {
  const { error, row } = await loadByTxnOrRef(txnid, reference);
  if (error) {
    return {
      ok: false as const,
      status: 500,
      body: { ok: false, error_code: 'lookup_failed', message: PAYMENT_UNAVAILABLE_MESSAGE },
    };
  }

  if (!row) {
    return {
      ok: false as const,
      status: 404,
      body: { ok: false, error_code: 'not_found', message: 'Registration not found.' },
    };
  }

  const expected = Number(row.final_amount);
  if (row.payment_status === 'paid') {
    return {
      ok: true as const,
      status: 200,
      body: {
        ok: true,
        paid: true,
        payment_status: 'paid',
        public_reference_id: row.public_reference_id,
        order_status: 'SUCCESS',
        final_amount: expected,
      },
    };
  }

  return {
    ok: true as const,
    status: 200,
    body: {
      ok: true,
      paid: false,
      payment_status: row.payment_status,
      public_reference_id: row.public_reference_id,
      order_status: 'PENDING',
      final_amount: expected,
    },
  };
}

type ApplyPayUResult = {
  ok: boolean;
  paid: boolean;
  public_reference_id?: string;
  payment_status?: 'paid';
  order_status?: string;
  final_amount?: number;
  customer_email_sent?: boolean;
  email_notice?: string;
  error_code?: string;
  message?: string;
};

export async function applyVerifiedPayUPayment(params: PayUCallbackParams): Promise<ApplyPayUResult> {
  const config = getPayUConfig();
  if (!config) {
    console.error('PayU is not configured: PAYU_MERCHANT_KEY / PAYU_MERCHANT_SALT missing');
    return {
      ok: false,
      paid: false,
      error_code: 'payment_unavailable',
      message: PAYMENT_UNAVAILABLE_MESSAGE,
    };
  }

  if (!params.txnid || !params.hash || !params.status) {
    return {
      ok: false,
      paid: false,
      public_reference_id: params.udf1,
      error_code: 'validation_error',
      message: PAYMENT_UNAVAILABLE_MESSAGE,
    };
  }

  if (params.key && params.key !== config.merchantKey) {
    console.error('PayU merchant key mismatch');
    return {
      ok: false,
      paid: false,
      public_reference_id: params.udf1,
      error_code: 'hash_mismatch',
      message: PAYMENT_UNAVAILABLE_MESSAGE,
    };
  }

  if (!verifyPayUResponseHash(config, params)) {
    console.error('PayU response hash mismatch');
    return {
      ok: false,
      paid: false,
      public_reference_id: params.udf1,
      error_code: 'hash_mismatch',
      message: PAYMENT_UNAVAILABLE_MESSAGE,
    };
  }

  if (!isPayUSuccessStatus(params.status)) {
    return {
      ok: true as const,
      paid: false,
      public_reference_id: params.udf1,
      order_status: params.status.toUpperCase(),
      message: 'Payment was not completed.',
    };
  }

  const { error, row } = await loadByTxnOrRef(params.txnid, params.udf1);
  if (error) {
    return {
      ok: false as const,
      paid: false,
      error_code: 'lookup_failed',
      message: PAYMENT_UNAVAILABLE_MESSAGE,
    };
  }

  if (!row) {
    return {
      ok: false as const,
      paid: false,
      error_code: 'not_found',
      message: 'Registration not found.',
    };
  }

  const expected = Number(row.final_amount);
  if (!amountsMatch(params.amount, expected)) {
    console.error('PayU amount mismatch', { txnid: params.txnid, paid: params.amount, expected });
    return {
      ok: false as const,
      paid: false,
      error_code: 'amount_mismatch',
      message: PAYMENT_UNAVAILABLE_MESSAGE,
    };
  }

  const admin = paymentAdmin();
  const { data, error: markError } = await admin.rpc('mark_gym_os_registration_paid', {
    p_public_reference_id: row.public_reference_id,
    p_cashfree_order_id: params.txnid,
    p_cashfree_payment_id: params.mihpayid || '',
    p_paid_amount: expected,
  });

  if (markError) {
    console.error('mark_gym_os_registration_paid', markError);
    return {
      ok: false as const,
      paid: false,
      error_code: 'verify_failed',
      message: PAYMENT_UNAVAILABLE_MESSAGE,
    };
  }

  const result = (data || {}) as GymOsSubmitResult & { already_paid?: boolean };
  if (!result.ok && !result.already_paid) {
    return {
      ok: false as const,
      paid: false,
      error_code: result.error_code || 'verify_failed',
      message: PAYMENT_UNAVAILABLE_MESSAGE,
    };
  }

  let emailResult = { customer_email_sent: false };
  try {
    emailResult = await sendGymOsRegistrationEmails(row.public_reference_id);
  } catch (emailError) {
    console.error('PayU registration email failed', emailError);
  }

  return {
    ok: true as const,
    paid: true,
    public_reference_id: row.public_reference_id,
    payment_status: 'paid' as const,
    final_amount: expected,
    customer_email_sent: emailResult.customer_email_sent,
    email_notice: emailResult.customer_email_sent ? undefined : EMAIL_NOT_SENT_NOTICE,
  };
}
