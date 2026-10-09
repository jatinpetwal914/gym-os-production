import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/database.types';
import { gymPortalRoles, isSuperAdminRole, type AppRole } from '@/lib/roles';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtected = pathname.startsWith('/super-admin') || pathname.startsWith('/gym');

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  let role = (user?.app_metadata?.role as AppRole | undefined) || null;
  if (isProtected && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .maybeSingle();
    if (!profile || profile.status !== 'active') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    role = profile.role as AppRole;
  }

  if (pathname.startsWith('/super-admin') && role && !isSuperAdminRole(role)) {
    return NextResponse.redirect(new URL('/gym/dashboard', request.url));
  }

  if (pathname.startsWith('/gym') && role === 'member') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (pathname.startsWith('/gym') && role && isSuperAdminRole(role)) {
    return NextResponse.redirect(new URL('/super-admin/dashboard', request.url));
  }

  if (pathname.startsWith('/gym') && role && !gymPortalRoles.includes(role) && !isSuperAdminRole(role)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}
