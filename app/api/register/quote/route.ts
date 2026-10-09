import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';
import { parseGymOsSaasPlanId, type GymOsQuoteResult } from '@/lib/gym-os-saas-plans';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const planId = parseGymOsSaasPlanId(body.plan_id);

    if (!planId) {
      return NextResponse.json(
        { ok: false, error_code: 'invalid_plan', message: 'Invalid plan.' } satisfies GymOsQuoteResult,
        { status: 400 }
      );
    }

    const couponCode = typeof body.coupon_code === 'string' ? body.coupon_code : '';
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('quote_gym_os_registration', {
      p_plan_id: planId,
      p_coupon_code: couponCode || null,
    });

    if (error) {
      console.error('quote_gym_os_registration', error);
      return NextResponse.json(
        { ok: false, error_code: 'quote_failed', message: 'Unable to price this plan right now.' },
        { status: 500 }
      );
    }

    const quote = ((data || {}) as unknown) as GymOsQuoteResult;
    return NextResponse.json({
      ok: quote.ok !== false,
      plan_id: quote.plan_id,
      plan_name: quote.plan_name,
      duration_months: quote.duration_months,
      base_amount: Number(quote.base_amount ?? 0),
      discount_amount: Number(quote.discount_amount ?? 0),
      final_amount: Number(quote.final_amount ?? 0),
      coupon_valid: Boolean(quote.coupon_valid),
      coupon_status: quote.coupon_status || 'none',
      error_code: quote.error_code,
      message: quote.message,
    } satisfies GymOsQuoteResult);
  } catch (error) {
    console.error('POST /api/register/quote', error);
    return NextResponse.json(
      { ok: false, error_code: 'quote_failed', message: 'Unable to price this plan right now.' },
      { status: 500 }
    );
  }
}
