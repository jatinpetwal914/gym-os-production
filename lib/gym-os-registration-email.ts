import { createAdminClient } from '@/lib/supabase-server';
import { formatInr } from '@/lib/gym-os-saas-plans';
import { createSmtpTransporter, getSmtpConfig, sanitizeMailError, smtpFrom } from '@/lib/smtp';

export type RegistrationEmailRow = {
  public_reference_id: string;
  gym_name: string;
  owner_name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  username_preference: string;
  member_count: number;
  plan_name: string;
  duration_months: number;
  base_amount: number | string;
  discount_amount: number | string;
  final_amount: number | string;
  coupon_code: string | null;
  payment_status: string;
  registration_status: string;
  cashfree_order_id: string | null;
  cashfree_payment_id: string | null;
  created_at: string;
  customer_email_status: string;
  caumas_email_status: string;
};

export type RegistrationEmailResult = {
  customer_email_sent: boolean;
  caumas_email_sent: boolean;
};

export const EMAIL_NOT_SENT_NOTICE =
  'Your registration is saved. We could not send the confirmation email just now. Please check Spam/Junk later, or wait for our team to contact you.';

const SELECT_COLUMNS =
  'public_reference_id, gym_name, owner_name, email, phone, city, state, username_preference, member_count, plan_name, duration_months, base_amount, discount_amount, final_amount, coupon_code, payment_status, registration_status, cashfree_order_id, cashfree_payment_id, created_at, customer_email_status, caumas_email_status';

function durationLabel(months: number) {
  return months === 1 ? '1 month' : `${months} months`;
}

function paymentStatusLabel(status: string) {
  if (status === 'free_coupon') return 'Free coupon';
  if (status === 'paid') return 'Paid';
  if (status === 'failed') return 'Failed';
  if (status === 'cancelled') return 'Cancelled';
  return 'Pending';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatSubmittedAt(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function isEligibleForNotification(row: RegistrationEmailRow) {
  const underReview = row.registration_status === 'under_review';
  return (
    underReview &&
    (row.payment_status === 'free_coupon' || row.payment_status === 'paid')
  );
}

function customerBodies(row: RegistrationEmailRow) {
  const base = Number(row.base_amount);
  const discount = Number(row.discount_amount);
  const finalAmount = Number(row.final_amount);
  const isFree = row.payment_status === 'free_coupon' || finalAmount === 0;
  const isPaid = row.payment_status === 'paid';

  const details = [
    `Gym name: ${row.gym_name}`,
    `Selected plan: ${row.plan_name}`,
    `Duration: ${durationLabel(Number(row.duration_months))}`,
    `Original price: ${formatInr(base)}`,
    `Discount: ${formatInr(discount)}`,
    `Final amount: ${formatInr(finalAmount)}`,
    `Payment status: ${paymentStatusLabel(row.payment_status)}`,
    `Registration reference: ${row.public_reference_id}`,
  ].join('\n');

  const freeCopy = isFree
    ? [
        'Your launch discount has been successfully applied.',
        '',
        `Amount payable: ${formatInr(0)}`,
        '',
        'Your registration is now under review.',
        'Your Gym OS account will be created manually after approval.',
        'You will receive your credentials by email.',
      ]
    : [];

  const paidCopy = isPaid
    ? [
        'Payment successful.',
        'Registration received.',
        '',
        `Amount paid: ${formatInr(finalAmount)}`,
        '',
        'Your Gym OS account will be created after manual review.',
        'You will receive credentials by email.',
      ]
    : [];

  const text = [
    'Your Gym OS registration request has been received.',
    '',
    'Your account will be created after our team reviews your registration.',
    'You will receive your Gym OS login credentials by email after approval.',
    'Please check your Spam/Junk folder as well.',
    '',
    ...freeCopy,
    ...(freeCopy.length && paidCopy.length ? [''] : []),
    ...paidCopy,
    '',
    details,
  ]
    .filter((line, index, lines) => !(line === '' && lines[index - 1] === ''))
    .join('\n');

  const htmlParts = [
    '<p>Your Gym OS registration request has been received.</p>',
    '<p>Your account will be created after our team reviews your registration.</p>',
    '<p>You will receive your Gym OS login credentials by email after approval.</p>',
    '<p>Please check your Spam/Junk folder as well.</p>',
  ];

  if (isFree) {
    htmlParts.push(
      '<p><strong>Your launch discount has been successfully applied.</strong></p>',
      `<p>Amount payable: ${escapeHtml(formatInr(0))}</p>`,
      '<p>Your registration is now under review.</p>',
      '<p>Your Gym OS account will be created manually after approval.</p>',
      '<p>You will receive your credentials by email.</p>'
    );
  }

  if (isPaid) {
    htmlParts.push(
      '<p><strong>Payment successful.</strong></p>',
      '<p>Registration received.</p>',
      `<p>Amount paid: ${escapeHtml(formatInr(finalAmount))}</p>`,
      '<p>Your Gym OS account will be created after manual review.</p>',
      '<p>You will receive credentials by email.</p>'
    );
  }

  htmlParts.push(
    '<ul>',
    `<li>Gym name: ${escapeHtml(row.gym_name)}</li>`,
    `<li>Selected plan: ${escapeHtml(row.plan_name)}</li>`,
    `<li>Duration: ${escapeHtml(durationLabel(Number(row.duration_months)))}</li>`,
    `<li>Original price: ${escapeHtml(formatInr(base))}</li>`,
    `<li>Discount: ${escapeHtml(formatInr(discount))}</li>`,
    `<li>Final amount: ${escapeHtml(formatInr(finalAmount))}</li>`,
    `<li>Payment status: ${escapeHtml(paymentStatusLabel(row.payment_status))}</li>`,
    `<li>Registration reference: ${escapeHtml(row.public_reference_id)}</li>`,
    '</ul>'
  );

  return { text, html: htmlParts.join('\n') };
}

function caumasBodies(row: RegistrationEmailRow) {
  const lines = [
    `Registration reference: ${row.public_reference_id}`,
    `Gym name: ${row.gym_name}`,
    `Owner name: ${row.owner_name}`,
    `Email: ${row.email}`,
    `Phone: ${row.phone}`,
    `City: ${row.city}`,
    `State: ${row.state}`,
    `Username preference: ${row.username_preference}`,
    `Member count: ${row.member_count}`,
    `Selected plan: ${row.plan_name}`,
    `Duration: ${durationLabel(Number(row.duration_months))}`,
    `Original price: ${formatInr(Number(row.base_amount))}`,
    `Discount: ${formatInr(Number(row.discount_amount))}`,
    `Final amount: ${formatInr(Number(row.final_amount))}`,
    `Coupon used: ${row.coupon_code || 'None'}`,
    `Payment status: ${paymentStatusLabel(row.payment_status)}`,
    `PayU txnid: ${row.cashfree_order_id || 'N/A'}`,
    `PayU mihpayid: ${row.cashfree_payment_id || 'N/A'}`,
    `Registration status: ${row.registration_status}`,
    `Submission date/time: ${formatSubmittedAt(row.created_at)} (IST)`,
  ];

  const text = ['New Gym OS registration request.', '', ...lines].join('\n');
  const html =
    '<p>New Gym OS registration request.</p><ul>' +
    lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('') +
    '</ul>';

  return { text, html };
}

type EmailAdmin = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: RegistrationEmailRow | null; error: { message: string } | null }>;
      };
    };
  };
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data?: unknown; error: { message: string } | null }>;
};

function emailAdmin() {
  return createAdminClient() as unknown as EmailAdmin;
}

async function loadRegistration(reference: string): Promise<RegistrationEmailRow | null> {
  const admin = emailAdmin();
  const { data, error } = await admin
    .from('gym_os_registration_requests')
    .select(SELECT_COLUMNS)
    .eq('public_reference_id', reference)
    .maybeSingle();

  if (error) {
    console.error('registration email lookup', error.message);
    return null;
  }

  return (data as RegistrationEmailRow | null) || null;
}

async function claimChannel(reference: string, channel: 'customer' | 'caumas') {
  const admin = emailAdmin();
  const { data, error } = await admin.rpc('claim_gym_os_registration_email', {
    p_public_reference_id: reference,
    p_channel: channel,
  });

  if (error) {
    console.error('claim_gym_os_registration_email', channel, error.message);
    return false;
  }

  return Boolean(data);
}

async function completeChannel(
  reference: string,
  channel: 'customer' | 'caumas',
  ok: boolean,
  errorText?: string
) {
  const admin = emailAdmin();
  const { error } = await admin.rpc('complete_gym_os_registration_email', {
    p_public_reference_id: reference,
    p_channel: channel,
    p_ok: ok,
    p_error: errorText || null,
  });

  if (error) {
    console.error('complete_gym_os_registration_email', channel, error.message);
  }
}

export async function sendGymOsRegistrationEmails(
  publicReferenceId: string | undefined | null
): Promise<RegistrationEmailResult> {
  const reference = typeof publicReferenceId === 'string' ? publicReferenceId.trim() : '';
  const empty = { customer_email_sent: false, caumas_email_sent: false };
  if (!reference) return empty;

  try {
    const row = await loadRegistration(reference);
    if (!row || !isEligibleForNotification(row)) {
      return empty;
    }

    const already = {
      customer_email_sent: row.customer_email_status === 'sent',
      caumas_email_sent: row.caumas_email_status === 'sent',
    };

    const config = getSmtpConfig();
    if (!config) {
      console.error('Registration email skipped: SMTP is not configured');
      if (!already.customer_email_sent && (await claimChannel(reference, 'customer'))) {
        await completeChannel(reference, 'customer', false, 'smtp_not_configured');
      }
      if (!already.caumas_email_sent && (await claimChannel(reference, 'caumas'))) {
        await completeChannel(reference, 'caumas', false, 'smtp_not_configured');
      }
      return already;
    }

    const transporter = createSmtpTransporter(config);

    if (!already.customer_email_sent && (await claimChannel(reference, 'customer'))) {
      try {
        const customer = customerBodies(row);
        await transporter.sendMail({
          from: smtpFrom(config),
          to: row.email,
          replyTo: config.user,
          envelope: { from: config.user, to: row.email },
          subject: 'Gym OS Registration Received — CAUMAS',
          text: customer.text,
          html: customer.html,
        });
        await completeChannel(reference, 'customer', true);
        already.customer_email_sent = true;
      } catch (error) {
        const message = sanitizeMailError(error);
        console.error('customer registration email failed', message);
        await completeChannel(reference, 'customer', false, message);
      }
    }

    if (!already.caumas_email_sent && (await claimChannel(reference, 'caumas'))) {
      try {
        const caumas = caumasBodies(row);
        await transporter.sendMail({
          from: smtpFrom(config),
          to: config.caumasTo,
          replyTo: config.user,
          envelope: { from: config.user, to: config.caumasTo },
          subject: 'New Gym OS Registration Request',
          text: caumas.text,
          html: caumas.html,
        });
        await completeChannel(reference, 'caumas', true);
        already.caumas_email_sent = true;
      } catch (error) {
        const message = sanitizeMailError(error);
        console.error('CAUMAS registration email failed', message);
        await completeChannel(reference, 'caumas', false, message);
      }
    }

    return already;
  } catch (error) {
    console.error('sendGymOsRegistrationEmails', sanitizeMailError(error));
    return empty;
  }
}
