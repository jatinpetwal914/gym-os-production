import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

function getUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL is required');
  return url;
}

/** Anon client. Public catalog reads so RLS still applies. */
export function createAnonClient() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');

  return createClient<Database>(getUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Service-role client. Auth admin and login username lookup only — never for tenant data. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations');

  return createClient<Database>(getUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** @deprecated Use createUserServerClient for tenant data and createAdminClient for Auth admin. */
export function createServerClient() {
  return createAdminClient();
}
