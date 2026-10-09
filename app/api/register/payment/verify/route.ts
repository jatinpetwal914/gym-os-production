import { NextRequest, NextResponse } from 'next/server';
import { getRegistrationPaymentStatus } from '@/lib/gym-os-payu-payment';
import { PAYMENT_UNAVAILABLE_MESSAGE } from '@/lib/payu';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const txnid = typeof body.txnid === 'string' ? body.txnid.trim() : typeof body.order_id === 'string' ? body.order_id.trim() : '';
    const reference = typeof body.public_reference_id === 'string' ? body.public_reference_id.trim() : '';

    if (!txnid && !reference) {
      return NextResponse.json(
        { ok: false, error_code: 'validation_error', message: 'Missing payment reference.' },
        { status: 400 }
      );
    }

    const result = await getRegistrationPaymentStatus(txnid, reference);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error('POST /api/register/payment/verify', error);
    return NextResponse.json(
      { ok: false, error_code: 'payment_unavailable', message: PAYMENT_UNAVAILABLE_MESSAGE },
      { status: 503 }
    );
  }
}
