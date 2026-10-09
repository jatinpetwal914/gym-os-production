import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromName: string;
  fromAddress: string;
  caumasTo: string;
};

const DEFAULT_FROM_NAME = 'Gym OS / CAUMAS';
const DEFAULT_FROM_ADDRESS = 'info@gymnasium.caumas.com';
const DEFAULT_CAUMAS_TO = 'caumasofficial@gmail.com';

export function stripEnvValue(value?: string | null) {
  return String(value || '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .trim();
}

export function parseSmtpFrom(raw: string, fallbackAddress: string) {
  const cleaned = stripEnvValue(raw);
  const angled = cleaned.match(/^(.*)<([^>]+)>$/);
  if (angled) {
    const name = stripEnvValue(angled[1]).replace(/^['"]+|['"]+$/g, '').trim() || DEFAULT_FROM_NAME;
    const address = stripEnvValue(angled[2]) || fallbackAddress;
    return { name, address };
  }
  if (cleaned.includes('@')) {
    return { name: DEFAULT_FROM_NAME, address: cleaned };
  }
  return { name: DEFAULT_FROM_NAME, address: fallbackAddress };
}

export function getSmtpConfig(): SmtpConfig | null {
  const host = stripEnvValue(process.env.SMTP_HOST);
  const port = Number(stripEnvValue(process.env.SMTP_PORT));
  const user = stripEnvValue(process.env.SMTP_USER);
  const password = stripEnvValue(process.env.SMTP_PASSWORD);
  const caumasTo = stripEnvValue(process.env.SMTP_CAUMAS_TO) || DEFAULT_CAUMAS_TO;
  const parsedFrom = parseSmtpFrom(process.env.SMTP_FROM || DEFAULT_FROM_ADDRESS, user || DEFAULT_FROM_ADDRESS);
  const secureEnv = stripEnvValue(process.env.SMTP_SECURE).toLowerCase();
  const secure = secureEnv === 'true' || (!secureEnv && port === 465);

  if (!host || !Number.isFinite(port) || port <= 0 || !user || !password) {
    return null;
  }

  return {
    host,
    port,
    secure,
    user,
    password,
    fromName: parsedFrom.name || DEFAULT_FROM_NAME,
    fromAddress: user,
    caumasTo,
  };
}

export function createSmtpTransporter(config: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    tls: {
      servername: config.host,
    },
  });
}

export function smtpFrom(config: SmtpConfig) {
  return {
    name: config.fromName,
    address: config.fromAddress,
  };
}

export function sanitizeMailError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || 'email_failed');
  const secrets = [
    process.env.SMTP_PASSWORD,
    stripEnvValue(process.env.SMTP_PASSWORD),
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.CASHFREE_SECRET_KEY,
    process.env.PAYU_MERCHANT_SALT,
  ].filter((secret): secret is string => Boolean(secret));

  return secrets.reduce((message, secret) => message.replaceAll(secret, '[redacted]'), raw).slice(0, 500);
}
