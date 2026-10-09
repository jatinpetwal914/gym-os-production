import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createUserServerClient } from '@/lib/supabase/server';
import { canAccessGymPortal, canAccessStaffApi, canCheckIn, isSuperAdminRole } from '@/lib/roles';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canAccessStaffApi(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = createUserServerClient();
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const gymIdFilter = searchParams.get('gymId');

    let query = supabase
      .from('visits')
      .select(`
        id, gym_id, branch_id, member_id, check_in_at, check_out_at, status, created_at, method,
        members!inner(member_id, name, phone)
      `)
      .order('check_in_at', { ascending: false });

    if (canAccessGymPortal(session.role)) {
      if (!session.gymId) return NextResponse.json({ error: 'No gym associated with account' }, { status: 403 });
      query = query.eq('gym_id', session.gymId);
    } else if (isSuperAdminRole(session.role)) {
      if (gymIdFilter) query = query.eq('gym_id', gymIdFilter);
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (memberId) query = query.eq('member_id', memberId);
    if (from) query = query.gte('check_in_at', `${from}T00:00:00.000Z`);
    if (to) query = query.lte('check_in_at', `${to}T23:59:59.999Z`);

    const { data, error } = await query;
    if (error) throw error;

    const mapped = (data || []).map((row) => ({
      ...row,
      date: row.check_in_at?.slice(0, 10),
      check_in_time: row.check_in_at,
      check_out_time: row.check_out_at,
    }));

    return NextResponse.json({ data: mapped });
  } catch (error) {
    console.error('Attendance GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canCheckIn(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = createUserServerClient();
    const body = await request.json();
    if (!body.qr_token) {
      return NextResponse.json({ error: 'qr_token is required' }, { status: 400 });
    }

    let branchId = body.branch_id || session.homeBranchId;
    if (!branchId && session.gymId) {
      const { data: branch } = await supabase
        .from('gym_branches')
        .select('id')
        .eq('gym_id', session.gymId)
        .eq('is_default', true)
        .maybeSingle();
      branchId = branch?.id;
    }

    if (!branchId) {
      return NextResponse.json({ error: 'branch_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('check_in', {
      p_qr_token: body.qr_token,
      p_branch_id: branchId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const result = data as { action?: string; member?: Record<string, unknown>; visit?: Record<string, unknown> };
    const action = result?.action;
    const alreadyCheckedIn = action === 'already_checked_in';
    return NextResponse.json({
      data: {
        member: result?.member,
        attendance: result?.visit,
        action,
        alreadyCheckedIn,
      },
      message:
        action === 'checkin'
          ? 'Member checked in'
          : alreadyCheckedIn
            ? 'Member is already checked in'
            : 'Done',
    }, { status: action === 'checkin' ? 201 : alreadyCheckedIn ? 409 : 200 });
  } catch (error) {
    console.error('Attendance POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
