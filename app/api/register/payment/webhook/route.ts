import { NextRequest, NextResponse } from 'next/server';
import { applyVerifiedPayUPayment } from '@/lib/gym-os-payu-payment';
import { parsePayUCallbackParams, PAYMENT_UNAVAILABLE_MESSAGE } from '@/lib/payu';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    const merged = new URLSearchParams();

    if (contentType.includes('application/json')) {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      Object.entries(body).forEach(([key, value]) => {
        if (value != null) merged.set(key, String(value));
      });
    } else {
      const text = await request.text();
      const form = new URLSearchParams(text);
      form.forEach((value, key) => merged.set(key, value));
    }

    const params = parsePayUCallbackParams(merged);
    if (!params.txnid) {
      return NextResponse.json({ ok: true });
    }

    const result = await applyVerifiedPayUPayment(params);
    if (!result.ok && result.error_code === 'hash_mismatch') {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    return NextResponse.json({ ok: true, paid: Boolean(result.paid) });
  } catch (error) {
    console.error('POST /api/register/payment/webhook', error);
    return NextResponse.json(
      { ok: false, error_code: 'payment_unavailable', message: PAYMENT_UNAVAILABLE_MESSAGE },
      { status: 500 }
    );
  }
}
