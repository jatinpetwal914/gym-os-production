const assert = require('node:assert/strict');
const QRCode = require('qrcode');

let baseUrl = process.env.TEST_BASE_URL;
const adminUsername = process.env.TEST_ADMIN_USERNAME;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;

function validateEnvironment() {
  if (process.env.E2E_ALLOW_DATA_CREATION !== 'YES') {
    throw new Error('Set E2E_ALLOW_DATA_CREATION=YES only for a disposable local database.');
  }
  if (!baseUrl || !adminUsername || !adminPassword) {
    throw new Error('Set TEST_BASE_URL, TEST_ADMIN_USERNAME, and TEST_ADMIN_PASSWORD.');
  }

  const url = new URL(baseUrl);
  if (
    url.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.pathname !== '/'
  ) {
    throw new Error('Lifecycle E2E tests are restricted to an HTTP loopback app URL.');
  }

  return url.origin;
}

function cookieHeader(response) {
  const cookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie') || ''];

  return cookies
    .map((cookie) => cookie.split(';', 1)[0])
    .filter(Boolean)
    .join('; ');
}

async function api(path, { cookie, ...options } = {}) {
  const headers = new Headers(options.headers);
  if (cookie) headers.set('cookie', cookie);
  const response = await fetch(new URL(path, baseUrl), { ...options, headers });
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${options.method || 'GET'} ${path} returned a non-JSON response (${response.status}).`);
  }
  return { response, body };
}

async function login(username, password) {
  const { response, body } = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(response.status, 200, 'staff account should authenticate');
  const cookie = cookieHeader(response);
  assert.ok(cookie, 'authentication should set a session cookie');
  return { body, cookie };
}

async function run() {
  baseUrl = validateEnvironment();

  let result = await api('/api/auth/me');
  assert.equal(result.response.status, 401, 'unauthenticated session lookup should be rejected');
  console.log('PASS unauthenticated session is rejected');

  const superAdmin = await login(adminUsername, adminPassword);
  assert.equal(superAdmin.body.role, 'super_admin');
  console.log('PASS seeded platform administrator authenticates');

  const gymName = `Lifecycle E2E ${Date.now()}`;
  result = await api('/api/gyms', {
    cookie: superAdmin.cookie,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: gymName, owner_name: 'Lifecycle Test Owner' }),
  });
  assert.equal(result.response.status, 201, 'platform administrator should create a test gym');
  const owner = result.body.data?.adminUser;
  const gym = result.body.data?.gym;
  assert.ok(owner?.username && owner?.temporaryPassword && gym?.id, 'gym and owner credentials should be returned');
  console.log('PASS gym creation provisions a gym-owner account');

  const gymOwner = await login(owner.username, owner.temporaryPassword);
  assert.equal(gymOwner.body.role, 'gym_owner');
  console.log('PASS provisioned gym owner authenticates');

  result = await api('/api/plans', {
    cookie: gymOwner.cookie,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Lifecycle Test Plan', duration_days: 30, price: 100, discount: 0 }),
  });
  assert.equal(result.response.status, 201, 'gym owner should create a membership plan');
  const plan = result.body.data;
  assert.ok(plan?.id, 'membership plan should be persisted');
  console.log('PASS gym owner creates a membership plan');

  const form = new FormData();
  form.set('name', 'Lifecycle Test Member');
  form.set('phone', '5550100100');
  form.set('plan_id', plan.id);
  form.set('start_date', new Date().toISOString().slice(0, 10));
  form.set('payment_method', 'cash');
  form.set('payment_amount', '100');
  form.set('payment_notes', 'Disposable lifecycle E2E test');
  form.set(
    'photo',
    new Blob([
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/iXcAAAAASUVORK5CYII=',
        'base64'
      ),
    ], { type: 'image/png' }),
    'lifecycle-test.png'
  );
  result = await api('/api/members', { cookie: gymOwner.cookie, method: 'POST', body: form });
  assert.equal(result.response.status, 201, `member creation should succeed (${result.body.error || 'no error message'})`);
  const member = result.body.data;
  assert.ok(member?.id && result.body.payment, 'member and initial payment should be persisted');
  assert.equal(result.body.payment_error, null, 'initial payment should succeed');
  console.log('PASS member creation stores a photo and initial payment');

  result = await api(`/api/members/${member.id}/qr`, { cookie: gymOwner.cookie });
  assert.equal(result.response.status, 200, 'member QR should be available to gym staff');
  const qrToken = result.body.data?.qr_token;
  assert.match(qrToken, /^[a-f0-9]{64}$/, 'QR token should be an opaque 32-byte value');
  const qrImage = await QRCode.toDataURL(qrToken);
  assert.ok(qrImage.startsWith('data:image/png;base64,'), 'member QR should render as a PNG data URL');

  result = await api(`/api/members/${member.id}`, { cookie: gymOwner.cookie });
  assert.equal(result.response.status, 200);
  assert.equal(Object.hasOwn(result.body.data, 'qr_token'), false, 'ordinary member response must omit QR token');
  assert.ok(result.body.data.payments.length > 0, 'member profile should include the saved payment');
  console.log('PASS member QR is generated and the private token stays out of profile data');

  result = await api('/api/attendance', {
    cookie: gymOwner.cookie,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ qr_token: qrToken }),
  });
  assert.equal(result.response.status, 201, `QR scan should check in the member (${result.body.error || 'no error message'})`);
  assert.equal(result.body.data?.action, 'checkin');
  const visit = result.body.data.attendance;
  assert.ok(visit?.id, 'check-in should persist a visit');

  const duplicate = await api('/api/attendance', {
    cookie: gymOwner.cookie,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ qr_token: qrToken }),
  });
  assert.equal(duplicate.response.status, 409, 'a second scan of an open visit should conflict');
  assert.equal(duplicate.body.data?.alreadyCheckedIn, true);
  console.log('PASS QR check-in persists once and duplicate scans are idempotently rejected');

  result = await api(`/api/attendance?page=1&limit=20&memberId=${encodeURIComponent(member.id)}`, {
    cookie: gymOwner.cookie,
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.total, 1, 'attendance history should include the visit');
  assert.equal(result.body.data[0]?.id, visit.id);

  const beforeCheckIn = new Date(new Date(visit.check_in_at).getTime() - 60_000).toISOString();
  const invalidCheckout = await api(`/api/attendance/${visit.id}`, {
    cookie: gymOwner.cookie,
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ check_out_time: beforeCheckIn }),
  });
  assert.equal(invalidCheckout.response.status, 400, 'checkout cannot precede check-in');

  result = await api(`/api/attendance/${visit.id}`, {
    cookie: gymOwner.cookie,
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(result.response.status, 200, 'open visit should check out');
  assert.ok(result.body.data?.check_out_time, 'checkout time should be persisted');

  const duplicateCheckout = await api(`/api/attendance/${visit.id}`, {
    cookie: gymOwner.cookie,
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(duplicateCheckout.response.status, 409, 'a closed visit cannot be checked out twice');

  result = await api(`/api/attendance?page=1&limit=20&memberId=${encodeURIComponent(member.id)}`, {
    cookie: gymOwner.cookie,
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.total, 1);
  assert.ok(result.body.data[0]?.check_out_time, 'history should reflect persisted checkout');

  result = await api(`/api/members/${member.id}`, { cookie: gymOwner.cookie });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.attendanceCount, 1, 'member profile should reflect persisted visit count');
  console.log('PASS attendance history and member profile synchronize check-in and checkout');

  const invalidPage = await api('/api/attendance?page=1e3', { cookie: gymOwner.cookie });
  assert.equal(invalidPage.response.status, 400, 'malformed pagination is rejected');
  const invalidQr = await api('/api/attendance', {
    cookie: gymOwner.cookie,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ qr_token: '' }),
  });
  assert.equal(invalidQr.response.status, 400, 'empty QR token is rejected');
  console.log('PASS malformed pagination and empty QR input are rejected');
}

run().catch((error) => {
  console.error('Lifecycle E2E failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
