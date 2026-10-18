import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createUserServerClient } from '@/lib/supabase/server';
import { canAccessGymPortal, canCheckIn } from '@/lib/roles';
import { isValidDateTime } from '@/lib/attendance-query';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canCheckIn(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = createUserServerClient();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'A valid JSON object is required' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A valid JSON object is required' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    let checkOutAt = new Date().toISOString();
    if (input.check_out_time !== undefined) {
      if (typeof input.check_out_time !== 'string' || !isValidDateTime(input.check_out_time)) {
        return NextResponse.json({ error: 'check_out_time must be a valid date-time' }, { status: 400 });
      }
      checkOutAt = new Date(input.check_out_time).toISOString();
    }

    let query = supabase.from('visits').select('id, gym_id, check_in_at, check_out_at').eq('id', params.id);
    if (canAccessGymPortal(session.role)) {
      if (!session.gymId) return NextResponse.json({ error: 'No gym associated with account' }, { status: 403 });
      query = query.eq('gym_id', session.gymId);
    }

    const { data: existing, error: fetchError } = await query.maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    if (existing.check_out_at) {
      return NextResponse.json({ error: 'Member is already checked out' }, { status: 409 });
    }
    if (Date.parse(checkOutAt) < Date.parse(existing.check_in_at)) {
      return NextResponse.json({ error: 'check_out_time must not be before check-in' }, { status: 400 });
    }

    const { data: updated, error: updateError } = await supabase
      .from('visits')
      .update({ check_out_at: checkOutAt })
      .eq('id', params.id)
      .is('check_out_at', null)
      .select('id, gym_id, member_id, check_in_at, check_out_at, status, created_at')
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updated) {
      return NextResponse.json({ error: 'Member is already checked out' }, { status: 409 });
    }

    return NextResponse.json({
      data: {
        ...updated,
        check_in_time: updated.check_in_at,
        check_out_time: updated.check_out_at,
      },
    });
  } catch (error) {
    console.error('Attendance PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
