import { createAdminClient } from '@/lib/supabase-server';
import { createSmtpTransporter, getSmtpConfig, sanitizeMailError, smtpFrom } from '@/lib/smtp';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendGymOsPasswordSetupEmail(input: {
  authEmail: string;
  recipient: string;
  redirectTo: string;
  fullName: string;
  firstLogin: boolean;
}) {
  const config = getSmtpConfig();
  if (!config) {
    throw new Error('SMTP is not configured');
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: input.authEmail,
    options: { redirectTo: input.redirectTo },
  });

  if (error) {
    throw new Error(`Could not generate password setup link: ${error.message}`);
  }

  const actionLink = data.properties?.action_link;
  if (!actionLink) {
    throw new Error('Supabase did not return a password setup link');
  }

  const name = input.fullName.trim() || 'Gym OS user';
  const heading = input.firstLogin ? 'Welcome to Gym OS' : 'Reset your Gym OS password';
  const instruction = input.firstLogin
    ? 'Set your password to finish setting up your Gym OS account.'
    : 'Use the secure link below to choose a new password.';
  const safeName = escapeHtml(name);
  const safeLink = escapeHtml(actionLink);
  const transporter = createSmtpTransporter(config);

  try {
    await transporter.sendMail({
      from: smtpFrom(config),
      to: input.recipient,
      replyTo: config.user,
      envelope: { from: config.user, to: input.recipient },
      subject: `${heading} — CAUMAS`,
      text: [
        `Hello ${name},`,
        '',
        instruction,
        '',
        actionLink,
        '',
        'If you did not request this email, you can ignore it.',
      ].join('\n'),
      html: [
        `<p>Hello ${safeName},</p>`,
        `<p>${instruction}</p>`,
        `<p><a href="${safeLink}">Set your Gym OS password</a></p>`,
        '<p>If you did not request this email, you can ignore it.</p>',
      ].join('\n'),
    });
  } catch (error) {
    throw new Error(`Could not deliver password setup email: ${sanitizeMailError(error)}`);
  } finally {
    transporter.close();
  }
}
