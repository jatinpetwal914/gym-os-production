import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createUserServerClient } from '@/lib/supabase/server';
import { canAccessGymPortal, canAccessStaffApi, canCheckIn, isSuperAdminRole } from '@/lib/roles';
import { isValidDateOnly, parseAttendancePagination } from '@/lib/attendance-query';

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
    const pagination = parseAttendancePagination(searchParams);

    if (!pagination) {
      return NextResponse.json({ error: 'Invalid page or limit' }, { status: 400 });
    }
    if ((from && !isValidDateOnly(from)) || (to && !isValidDateOnly(to))) {
      return NextResponse.json({ error: 'Dates must use YYYY-MM-DD format' }, { status: 400 });
    }
    if (from && to && from > to) {
      return NextResponse.json({ error: 'The from date must not be after the to date' }, { status: 400 });
    }

    let query = supabase
      .from('visits')
      .select(`
        id, gym_id, branch_id, member_id, check_in_at, check_out_at, status, created_at, method,
        members!inner(member_id, name, phone)
      `, { count: 'exact' })
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
    const offset = (pagination.page - 1) * pagination.limit;
    query = query.range(offset, offset + pagination.limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    const mapped = (data || []).map((row) => ({
      ...row,
      date: row.check_in_at?.slice(0, 10),
      check_in_time: row.check_in_at,
      check_out_time: row.check_out_at,
    }));

    return NextResponse.json({
      data: mapped,
      total: count || 0,
      page: pagination.page,
      limit: pagination.limit,
    });
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
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A valid JSON object is required' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const qrToken = typeof input.qr_token === 'string' ? input.qr_token.trim() : '';
    if (!qrToken || qrToken.length > 256) {
      return NextResponse.json(
        { error: 'qr_token must be a non-empty string with at most 256 characters' },
        { status: 400 }
      );
    }

    let branchId: string | null = typeof input.branch_id === 'string'
      ? input.branch_id
      : session.homeBranchId || null;
    if (input.branch_id !== undefined && typeof input.branch_id !== 'string') {
      return NextResponse.json({ error: 'branch_id must be a string' }, { status: 400 });
    }
    if (!branchId && session.gymId) {
      const { data: branch } = await supabase
        .from('gym_branches')
        .select('id')
        .eq('gym_id', session.gymId)
        .eq('is_default', true)
        .maybeSingle();
      branchId = branch?.id || null;
    }

    if (!branchId) {
      return NextResponse.json({ error: 'branch_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('check_in', {
      p_qr_token: qrToken,
      p_branch_id: branchId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const result = data as { action?: string; member?: Record<string, unknown>; visit?: Record<string, unknown> };
    const action = result?.action;
    const alreadyCheckedIn = action === 'already_checked_in';
    const member = result?.member ? { ...result.member } : null;
    if (member) delete member.qr_token;
    return NextResponse.json({
      data: {
        member,
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
