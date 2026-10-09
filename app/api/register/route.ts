import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';
import {
  EMAIL_NOT_SENT_NOTICE,
  sendGymOsRegistrationEmails,
} from '@/lib/gym-os-registration-email';
import {
  isUuid,
  parseGymOsSaasPlanId,
  submitErrorMessage,
  type GymOsSubmitResult,
} from '@/lib/gym-os-saas-plans';

function textField(value: unknown, max = 120) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const planId = parseGymOsSaasPlanId(body.plan_id);

    if (!planId) {
      return NextResponse.json(
        { ok: false, error_code: 'invalid_plan', message: 'Please select a valid Gym OS plan.' } satisfies GymOsSubmitResult,
        { status: 400 }
      );
    }

    if (!isUuid(body.idempotency_key)) {
      return NextResponse.json(
        { ok: false, error_code: 'validation_error', message: 'Please refresh the page and try again.' } satisfies GymOsSubmitResult,
        { status: 400 }
      );
    }

    const memberCount = Number(body.member_count);
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('submit_gym_os_registration', {
      p_gym_name: textField(body.gym_name),
      p_owner_name: textField(body.owner_name),
      p_email: textField(body.email, 160),
      p_phone: textField(body.phone, 20),
      p_city: textField(body.city, 80),
      p_state: textField(body.state, 80),
      p_username_preference: textField(body.username_preference, 64),
      p_member_count: Number.isFinite(memberCount) ? Math.trunc(memberCount) : 0,
      p_plan_id: planId,
      p_coupon_code: textField(body.coupon_code, 40) || null,
      p_idempotency_key: body.idempotency_key,
    });

    if (error) {
      console.error('submit_gym_os_registration', error);
      return NextResponse.json(
        { ok: false, error_code: 'submit_failed', message: 'Unable to submit registration. Please try again.' },
        { status: 500 }
      );
    }

    const result = ((data || {}) as unknown) as GymOsSubmitResult;
    if (!result.ok) {
      const status =
        result.error_code === 'coupon_exhausted' || result.error_code === 'coupon_invalid' || result.error_code === 'duplicate_email'
          ? 409
          : 400;
      return NextResponse.json(
        {
          ok: false,
          error_code: result.error_code,
          message: submitErrorMessage(result.error_code, result.message),
        } satisfies GymOsSubmitResult,
        { status }
      );
    }

    let customerEmailSent = false;
    if (result.payment_status === 'free_coupon') {
      try {
        const emailResult = await sendGymOsRegistrationEmails(result.public_reference_id);
        customerEmailSent = emailResult.customer_email_sent;
      } catch (emailError) {
        console.error('registration email failed after submit', emailError);
      }
    }

    return NextResponse.json({
      ok: true,
      idempotent: Boolean(result.idempotent),
      public_reference_id: result.public_reference_id,
      plan_id: result.plan_id,
      plan_name: result.plan_name,
      duration_months: result.duration_months,
      base_amount: Number(result.base_amount ?? 0),
      discount_amount: Number(result.discount_amount ?? 0),
      final_amount: Number(result.final_amount ?? 0),
      coupon_code: result.coupon_code ?? null,
      payment_status: result.payment_status,
      registration_status: result.registration_status,
      customer_email_sent: customerEmailSent,
      email_notice:
        result.payment_status === 'free_coupon' && !customerEmailSent ? EMAIL_NOT_SENT_NOTICE : undefined,
    } satisfies GymOsSubmitResult);
  } catch (error) {
    console.error('POST /api/register', error);
    return NextResponse.json(
      { ok: false, error_code: 'submit_failed', message: 'Unable to submit registration. Please try again.' },
      { status: 500 }
    );
  }
}
