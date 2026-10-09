import { NextResponse } from 'next/server';
import { createUserServerClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = createUserServerClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
