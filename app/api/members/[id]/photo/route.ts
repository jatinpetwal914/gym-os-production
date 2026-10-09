import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createUserServerClient } from '@/lib/supabase/server';
import { canAccessGymPortal, canAccessStaffApi, canManageMembers } from '@/lib/roles';
import {
  memberPhotoStoragePath,
  readAndValidateMemberPhoto,
} from '@/lib/member-photo';

async function loadMemberForPhoto(memberId: string, gymId: string | null) {
  const supabase = createUserServerClient();
  let query = supabase
    .from('members')
    .select('id, gym_id, photo_url, name')
    .eq('id', memberId);
  if (gymId) query = query.eq('gym_id', gymId);
  return query.maybeSingle();
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canAccessStaffApi(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const gymId = canAccessGymPortal(session.role) ? session.gymId : null;
    if (canAccessGymPortal(session.role) && !gymId) {
      return NextResponse.json({ error: 'No gym associated with account' }, { status: 403 });
    }

    const { data: member, error } = await loadMemberForPhoto(params.id, gymId);
    if (error) throw error;
    if (!member?.photo_url) return NextResponse.json({ error: 'No photograph on file' }, { status: 404 });

    const supabase = createUserServerClient();
    const { data, error: downloadError } = await supabase.storage.from('member-photos').download(member.photo_url);
    if (downloadError || !data) {
      return NextResponse.json({ error: 'Photograph unavailable' }, { status: 404 });
    }

    const bytes = Buffer.from(await data.arrayBuffer());
    const contentType = data.type || 'image/jpeg';
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (error) {
    console.error('Member photo GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManageMembers(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const gymId = canAccessGymPortal(session.role) ? session.gymId : null;
    if (canAccessGymPortal(session.role) && !gymId) {
      return NextResponse.json({ error: 'No gym associated with account' }, { status: 403 });
    }

    const { data: member, error } = await loadMemberForPhoto(params.id, gymId);
    if (error) throw error;
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    const form = await request.formData().catch(() => null);
    const file = form?.get('photo');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Photograph is required.' }, { status: 400 });
    }

    const validated = await readAndValidateMemberPhoto(file);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const path = memberPhotoStoragePath(member.gym_id, member.id, validated.mime);
    const supabase = createUserServerClient();
    const { error: uploadError } = await supabase.storage.from('member-photos').upload(path, validated.buffer, {
      contentType: validated.mime,
      upsert: true,
    });
    if (uploadError) {
      console.error('Member photo upload', uploadError);
      return NextResponse.json({ error: 'Could not save the photograph. Please try again.' }, { status: 500 });
    }

    const { error: updateError } = await supabase.from('members').update({ photo_url: path }).eq('id', member.id);
    if (updateError) throw updateError;

    return NextResponse.json({ ok: true, photo_url: path });
  } catch (error) {
    console.error('Member photo POST', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
