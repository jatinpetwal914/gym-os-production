export type GymOsSaasPlanId = 'monthly' | 'quarterly' | 'half_yearly';

export interface GymOsSaasPlan {
  id: GymOsSaasPlanId;
  name: string;
  durationMonths: number;
  baseAmount: number;
}

/** Display/type helper only. Quote and submit RPCs are the price source of truth. */
export const GYM_OS_SAAS_PLANS: Record<GymOsSaasPlanId, GymOsSaasPlan> = {
  monthly: { id: 'monthly', name: '1 Month', durationMonths: 1, baseAmount: 1500 },
  quarterly: { id: 'quarterly', name: '3 Months', durationMonths: 3, baseAmount: 3999 },
  half_yearly: { id: 'half_yearly', name: '6 Months', durationMonths: 6, baseAmount: 6999 },
};

export function parseGymOsSaasPlanId(value: unknown): GymOsSaasPlanId | null {
  if (value === 'monthly' || value === 'quarterly' || value === 'half_yearly') {
    return value;
  }
  return null;
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export const LAUNCH_COUPON_CODE = 'RUNMYGYM26';

export type CouponStatus = 'none' | 'applied' | 'invalid' | 'exhausted';

export interface GymOsQuoteResult {
  ok: boolean;
  plan_id?: string;
  plan_name?: string;
  duration_months?: number;
  base_amount?: number;
  discount_amount?: number;
  final_amount?: number;
  coupon_valid?: boolean;
  coupon_status?: CouponStatus;
  error_code?: string;
  message?: string;
}

export interface GymOsSubmitResult {
  ok: boolean;
  idempotent?: boolean;
  id?: string;
  public_reference_id?: string;
  plan_id?: string;
  plan_name?: string;
  duration_months?: number;
  base_amount?: number;
  discount_amount?: number;
  final_amount?: number;
  coupon_code?: string | null;
  payment_status?: 'pending' | 'free_coupon' | 'paid' | 'failed' | 'cancelled';
  registration_status?: 'pending' | 'under_review' | 'approved' | 'rejected';
  customer_email_sent?: boolean;
  email_notice?: string;
  error_code?: string;
  message?: string;
}

export const REGISTRATION_SUCCESS_STORAGE_KEY = 'gym_os_registration_success';
export const REGISTRATION_IDEMPOTENCY_STORAGE_KEY = 'gym_os_registration_idempotency';

export function couponErrorMessage(status: CouponStatus | undefined, fallback?: string) {
  if (status === 'exhausted') {
    return 'This launch coupon has reached its maximum number of redemptions.';
  }
  if (status === 'invalid') {
    return 'Invalid or unavailable coupon code.';
  }
  return fallback || 'Invalid or unavailable coupon code.';
}

export function submitErrorMessage(code: string | undefined, fallback?: string) {
  if (code === 'coupon_exhausted') {
    return 'This launch coupon has reached its maximum number of redemptions.';
  }
  if (code === 'coupon_invalid') {
    return 'Invalid or unavailable coupon code.';
  }
  if (code === 'duplicate_email') {
    return 'A registration request for this email is already under review.';
  }
  if (code === 'invalid_plan') {
    return 'Please select a valid Gym OS plan.';
  }
  if (code === 'payment_unavailable') {
    return 'Online payment is temporarily unavailable. Please try again later.';
  }
  return fallback || 'Unable to submit registration. Please try again.';
}

export function formatInr(amount: number) {
  return `₹${Number(amount).toLocaleString('en-IN')}`;
}

export const PAYMENT_UNAVAILABLE_MESSAGE =
  'Online payment is temporarily unavailable. Please try again later.';
