import { NextRequest, NextResponse } from 'next/server';
import { requireGymFormsSession } from '@/lib/gym-form-auth';
import { createUserServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireGymFormsSession();
    if ('error' in auth) return auth.error;
    const path = request.nextUrl.searchParams.get('path') || '';
    if (!path || path.includes('..') || path.includes('\\') || !path.startsWith(`${auth.session.gymId}/`)) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }
    const supabase = createUserServerClient();
    const { data, error } = await supabase.storage.from('gym-form-uploads').download(path);
    if (error || !data) return NextResponse.json({ error: 'File unavailable' }, { status: 404 });
    const bytes = Buffer.from(await data.arrayBuffer());
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': data.type || 'application/octet-stream',
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (error) {
    console.error('gym-form file GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
