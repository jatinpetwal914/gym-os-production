import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';
import {
  buildPayUCheckout,
  getPayUConfig,
  getPublicSiteUrl,
  newPayUTxnId,
  PAYMENT_UNAVAILABLE_MESSAGE,
} from '@/lib/payu';

type RegistrationRow = {
  id: string;
  public_reference_id: string;
  owner_name: string;
  email: string;
  phone: string;
  plan_name: string;
  final_amount: number | string;
  payment_status: string;
  cashfree_order_id: string | null;
};

const USER_PAYMENT_ERROR = PAYMENT_UNAVAILABLE_MESSAGE;

function unavailable() {
  return NextResponse.json(
    { ok: false, error_code: 'payment_unavailable', message: USER_PAYMENT_ERROR },
    { status: 503 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const reference = typeof body.public_reference_id === 'string' ? body.public_reference_id.trim() : '';
    if (!reference) {
      return NextResponse.json(
        { ok: false, error_code: 'validation_error', message: 'Missing registration reference.' },
        { status: 400 }
      );
    }

    const config = getPayUConfig();
    if (!config) {
      console.error('PayU is not configured: PAYU_MERCHANT_KEY / PAYU_MERCHANT_SALT missing');
      return unavailable();
    }

    const admin = createAdminClient() as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            maybeSingle: () => Promise<{ data: RegistrationRow | null; error: { message: string } | null }>;
          };
        };
        update: (values: Record<string, unknown>) => {
          eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    };

    const { data: row, error } = await admin
      .from('gym_os_registration_requests')
      .select('id, public_reference_id, owner_name, email, phone, plan_name, final_amount, payment_status, cashfree_order_id')
      .eq('public_reference_id', reference)
      .maybeSingle();

    if (error) {
      console.error('register payment lookup', error);
      return NextResponse.json(
        { ok: false, error_code: 'lookup_failed', message: USER_PAYMENT_ERROR },
        { status: 500 }
      );
    }

    if (!row) {
      return NextResponse.json(
        { ok: false, error_code: 'not_found', message: 'Registration not found.' },
        { status: 404 }
      );
    }

    const amount = Number(row.final_amount);
    if (row.payment_status === 'free_coupon' || amount <= 0) {
      return NextResponse.json(
        { ok: false, error_code: 'not_payable', message: 'No payment is required for this registration.' },
        { status: 400 }
      );
    }

    if (row.payment_status === 'paid') {
      return NextResponse.json({
        ok: true,
        already_paid: true,
        public_reference_id: row.public_reference_id,
        payment_status: 'paid',
        final_amount: amount,
      });
    }

    const siteUrl = getPublicSiteUrl() || 'http://localhost:3000';
    const txnid = newPayUTxnId(row.public_reference_id);
    const callbackUrl = `${siteUrl}/api/register/payment/callback`;
    const fields = buildPayUCheckout(config, {
      txnid,
      amount,
      productinfo: `Gym OS ${row.plan_name}`.slice(0, 100),
      firstname: row.owner_name,
      email: row.email,
      phone: row.phone,
      surl: callbackUrl,
      furl: callbackUrl,
      udf1: row.public_reference_id,
    });

    const { error: saveError } = await admin
      .from('gym_os_registration_requests')
      .update({ cashfree_order_id: txnid })
      .eq('id', row.id);

    if (saveError) {
      console.error('Failed to store PayU txnid', saveError);
      return unavailable();
    }

    return NextResponse.json({
      ok: true,
      public_reference_id: row.public_reference_id,
      txnid,
      action: config.paymentUrl,
      fields,
      environment: config.environment,
      final_amount: amount,
    });
  } catch (error) {
    console.error('POST /api/register/payment', error);
    return unavailable();
  }
}
