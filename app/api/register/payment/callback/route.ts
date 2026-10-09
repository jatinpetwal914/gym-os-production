import { NextRequest, NextResponse } from 'next/server';
import { applyVerifiedPayUPayment } from '@/lib/gym-os-payu-payment';
import { getPublicSiteUrl, parsePayUCallbackParams } from '@/lib/payu';

async function paramsFromRequest(request: NextRequest): Promise<URLSearchParams> {
  const merged = new URLSearchParams(request.nextUrl.searchParams);
  const contentType = request.headers.get('content-type') || '';

  if (request.method === 'POST' && contentType.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    const form = new URLSearchParams(text);
    form.forEach((value, key) => merged.set(key, value));
    return merged;
  }

  if (request.method === 'POST' && contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    form.forEach((value, key) => {
      if (typeof value === 'string') merged.set(key, value);
    });
    return merged;
  }

  if (request.method === 'POST' && contentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    Object.entries(body).forEach(([key, value]) => {
      if (value != null) merged.set(key, String(value));
    });
  }

  return merged;
}

function returnUrl(reference: string, txnid: string, status: string) {
  const site = getPublicSiteUrl() || 'http://localhost:3000';
  const url = new URL('/register/payment/return', `${site}/`);
  if (reference) url.searchParams.set('ref', reference);
  if (txnid) url.searchParams.set('txnid', txnid);
  if (status) url.searchParams.set('status', status);
  return url.toString();
}

async function handleCallback(request: NextRequest) {
  const params = parsePayUCallbackParams(await paramsFromRequest(request));
  const result = await applyVerifiedPayUPayment(params);
  const status = result.paid ? 'paid' : params.status || 'pending';
  return NextResponse.redirect(returnUrl(result.public_reference_id || params.udf1, params.txnid, status), 303);
}

export async function GET(request: NextRequest) {
  return handleCallback(request);
}

export async function POST(request: NextRequest) {
  return handleCallback(request);
}
