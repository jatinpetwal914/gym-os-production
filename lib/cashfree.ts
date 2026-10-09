import { createHmac, timingSafeEqual } from 'crypto';
import { PAYMENT_UNAVAILABLE_MESSAGE } from '@/lib/gym-os-saas-plans';

export { PAYMENT_UNAVAILABLE_MESSAGE };

export type CashfreeEnvironment = 'sandbox' | 'production';

export interface CashfreeConfig {
  appId: string;
  secretKey: string;
  environment: CashfreeEnvironment;
  baseUrl: string;
  apiVersion: string;
}

export interface CashfreeOrder {
  order_id: string;
  cf_order_id?: string | number;
  order_amount: number;
  order_currency?: string;
  order_status: string;
  payment_session_id?: string;
}

function trimEnv(name: string) {
  return (process.env[name] || '').trim();
}

export function getCashfreeConfig(): CashfreeConfig | null {
  const appId = trimEnv('CASHFREE_APP_ID');
  const secretKey = trimEnv('CASHFREE_SECRET_KEY');
  if (!appId || !secretKey) return null;

  const raw = trimEnv('CASHFREE_ENVIRONMENT').toLowerCase() || 'sandbox';
  const environment: CashfreeEnvironment = raw === 'production' ? 'production' : 'sandbox';

  return {
    appId,
    secretKey,
    environment,
    baseUrl: environment === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg',
    apiVersion: trimEnv('CASHFREE_API_VERSION') || '2023-08-01',
  };
}

export function isCashfreeConfigured() {
  return getCashfreeConfig() !== null;
}

function cashfreeHeaders(config: CashfreeConfig) {
  return {
    'Content-Type': 'application/json',
    'x-client-id': config.appId,
    'x-client-secret': config.secretKey,
    'x-api-version': config.apiVersion,
  };
}

async function cashfreeFetch<T>(config: CashfreeConfig, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      ...cashfreeHeaders(config),
      ...(init?.headers || {}),
    },
  });

  const text = await response.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: 'Invalid Cashfree response' };
  }

  if (!response.ok) {
    const err = new Error('CASHFREE_REQUEST_FAILED');
    (err as Error & { status?: number; details?: unknown }).status = response.status;
    (err as Error & { status?: number; details?: unknown }).details = json;
    throw err;
  }

  return json as T;
}

export async function createCashfreeOrder(
  config: CashfreeConfig,
  input: {
    orderId: string;
    amount: number;
    customerId: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    returnUrl: string;
    notifyUrl?: string;
    note?: string;
  }
) {
  return cashfreeFetch<CashfreeOrder>(config, '/orders', {
    method: 'POST',
    body: JSON.stringify({
      order_id: input.orderId,
      order_amount: Number(input.amount.toFixed(2)),
      order_currency: 'INR',
      customer_details: {
        customer_id: input.customerId.slice(0, 50),
        customer_name: input.customerName.slice(0, 100),
        customer_email: input.customerEmail.slice(0, 100),
        customer_phone: input.customerPhone,
      },
      order_meta: {
        return_url: input.returnUrl,
        ...(input.notifyUrl ? { notify_url: input.notifyUrl } : {}),
      },
      ...(input.note ? { order_note: input.note.slice(0, 200) } : {}),
    }),
  });
}

export async function getCashfreeOrder(config: CashfreeConfig, orderId: string) {
  return cashfreeFetch<CashfreeOrder>(config, `/orders/${encodeURIComponent(orderId)}`);
}

export function verifyCashfreeWebhookSignature(rawBody: string, signature: string, timestamp: string, secretKey: string) {
  if (!signature || !timestamp || !rawBody) return false;

  const ageMs = Math.abs(Date.now() - Number(timestamp));
  if (!Number.isFinite(ageMs) || ageMs > 5 * 60 * 1000) return false;

  const expected = createHmac('sha256', secretKey).update(timestamp + rawBody).digest('base64');
  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(signature);
  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}

export function cashfreePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits.padStart(10, '0');
}

export function newCashfreeOrderId(publicReferenceId: string) {
  const compact = publicReferenceId.replace(/[^A-Za-z0-9]/g, '').slice(-12);
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `GOS${compact}${suffix}`.slice(0, 45);
}

export function getPublicSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || '').replace(/\/$/, '');
}
