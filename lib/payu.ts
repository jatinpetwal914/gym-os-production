import { createHash, timingSafeEqual } from 'crypto';
import { PAYMENT_UNAVAILABLE_MESSAGE } from '@/lib/gym-os-saas-plans';

export { PAYMENT_UNAVAILABLE_MESSAGE };

export type PayUEnvironment = 'test' | 'production';

export interface PayUConfig {
  merchantKey: string;
  merchantSalt: string;
  environment: PayUEnvironment;
  paymentUrl: string;
}

export type PayUCheckoutFields = {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  hash: string;
  udf1: string;
  udf2: string;
  udf3: string;
  udf4: string;
  udf5: string;
  service_provider: string;
};

export type PayUCallbackParams = {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  status: string;
  hash: string;
  udf1: string;
  udf2: string;
  udf3: string;
  udf4: string;
  udf5: string;
  mihpayid: string;
  additionalCharges: string;
  splitInfo: string;
};

function trimEnv(name: string) {
  return (process.env[name] || '').trim();
}

export function getPayUConfig(): PayUConfig | null {
  const merchantKey = trimEnv('PAYU_MERCHANT_KEY');
  const merchantSalt = trimEnv('PAYU_MERCHANT_SALT');
  if (!merchantKey || !merchantSalt || merchantKey.startsWith('YOUR_') || merchantSalt.startsWith('YOUR_')) {
    return null;
  }

  const raw = trimEnv('PAYU_ENVIRONMENT').toLowerCase();
  const environment: PayUEnvironment = raw === 'production' || raw === 'live' ? 'production' : 'test';

  return {
    merchantKey,
    merchantSalt,
    environment,
    paymentUrl: environment === 'production' ? 'https://secure.payu.in/_payment' : 'https://test.payu.in/_payment',
  };
}

export function isPayUConfigured() {
  return getPayUConfig() !== null;
}

export function getPublicSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || '').replace(/\/$/, '');
}

export function formatPayUAmount(amount: number) {
  return Number(amount).toFixed(2);
}

export function amountsMatch(paid: string | number, expected: string | number) {
  return Number(Number(paid).toFixed(2)) === Number(Number(expected).toFixed(2));
}

export function payUPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits.padStart(10, '0');
}

export function payUFirstName(value: string) {
  const first = (value || '').trim().split(/\s+/)[0] || 'Owner';
  return first.slice(0, 60);
}

export function newPayUTxnId(publicReferenceId: string) {
  const compact = publicReferenceId.replace(/[^A-Za-z0-9]/g, '').slice(-10);
  const suffix = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `GOS${compact}${suffix}`.slice(0, 25);
}

function sha512Hex(value: string) {
  return createHash('sha512').update(value).digest('hex').toLowerCase();
}

function hashesEqual(expected: string, received: string) {
  const a = Buffer.from(expected.toLowerCase());
  const b = Buffer.from((received || '').toLowerCase());
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function buildPayURequestHash(
  config: PayUConfig,
  input: {
    txnid: string;
    amount: string;
    productinfo: string;
    firstname: string;
    email: string;
    udf1?: string;
    udf2?: string;
    udf3?: string;
    udf4?: string;
    udf5?: string;
  }
) {
  const udf1 = input.udf1 || '';
  const udf2 = input.udf2 || '';
  const udf3 = input.udf3 || '';
  const udf4 = input.udf4 || '';
  const udf5 = input.udf5 || '';
  return sha512Hex(
    `${config.merchantKey}|${input.txnid}|${input.amount}|${input.productinfo}|${input.firstname}|${input.email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${config.merchantSalt}`
  );
}

export function verifyPayUResponseHash(config: PayUConfig, params: PayUCallbackParams) {
  const base = `${params.status}||||||${params.udf5}|${params.udf4}|${params.udf3}|${params.udf2}|${params.udf1}|${params.email}|${params.firstname}|${params.productinfo}|${params.amount}|${params.txnid}|${params.key}`;
  const candidates = [
    sha512Hex(`${config.merchantSalt}|${base}`),
    params.additionalCharges ? sha512Hex(`${params.additionalCharges}|${config.merchantSalt}|${base}`) : '',
    params.splitInfo ? sha512Hex(`${config.merchantSalt}|${params.status}|${params.splitInfo}||||||${params.udf5}|${params.udf4}|${params.udf3}|${params.udf2}|${params.udf1}|${params.email}|${params.firstname}|${params.productinfo}|${params.amount}|${params.txnid}|${params.key}`) : '',
  ].filter(Boolean);

  return candidates.some((expected) => hashesEqual(expected, params.hash));
}

export function isPayUSuccessStatus(status: string) {
  const normalized = (status || '').trim().toLowerCase();
  return normalized === 'success' || normalized === 'captured';
}

export function parsePayUCallbackParams(source: URLSearchParams | Record<string, string>): PayUCallbackParams {
  const get = (key: string) => {
    if (source instanceof URLSearchParams) return (source.get(key) || '').trim();
    return String(source[key] || '').trim();
  };

  return {
    key: get('key'),
    txnid: get('txnid'),
    amount: get('amount'),
    productinfo: get('productinfo'),
    firstname: get('firstname'),
    email: get('email'),
    status: get('status'),
    hash: get('hash'),
    udf1: get('udf1'),
    udf2: get('udf2'),
    udf3: get('udf3'),
    udf4: get('udf4'),
    udf5: get('udf5'),
    mihpayid: get('mihpayid'),
    additionalCharges: get('additionalCharges') || get('additional_charges'),
    splitInfo: get('splitInfo') || get('split_info'),
  };
}

export function buildPayUCheckout(
  config: PayUConfig,
  input: {
    txnid: string;
    amount: number;
    productinfo: string;
    firstname: string;
    email: string;
    phone: string;
    surl: string;
    furl: string;
    udf1: string;
  }
): PayUCheckoutFields {
  const amount = formatPayUAmount(input.amount);
  const fields: Omit<PayUCheckoutFields, 'hash'> & { hash?: string } = {
    key: config.merchantKey,
    txnid: input.txnid,
    amount,
    productinfo: input.productinfo.slice(0, 100),
    firstname: payUFirstName(input.firstname),
    email: input.email.slice(0, 100),
    phone: payUPhone(input.phone),
    surl: input.surl,
    furl: input.furl,
    udf1: input.udf1,
    udf2: '',
    udf3: '',
    udf4: '',
    udf5: '',
    service_provider: 'payu_paisa',
  };

  return {
    ...fields,
    hash: buildPayURequestHash(config, fields),
  };
}
