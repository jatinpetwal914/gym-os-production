import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createUserServerClient } from '@/lib/supabase/server';
import { canAccessGymPortal, canAccessStaffApi, canRecordPayments, isSuperAdminRole } from '@/lib/roles';
import { recordMemberPayment } from '@/lib/member-payment';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canAccessStaffApi(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createUserServerClient();
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const gymIdFilter = searchParams.get('gymId');

    let query = supabase
      .from('payments')
      .select(`
        id, gym_id, member_id, plan_id, amount, discount, payment_method, payment_date,
        notes, created_at, status, currency, gateway, gateway_reference, refund_amount, refunded_at, reversed_at,
        members!inner(member_id, name, phone),
        membership_plans(name)
      `)
      .order('payment_date', { ascending: false });

    if (canAccessGymPortal(session.role)) {
      if (!session.gymId) {
        return NextResponse.json({ error: 'No gym associated with account' }, { status: 403 });
      }
      query = query.eq('gym_id', session.gymId);
    } else if (isSuperAdminRole(session.role)) {
      if (gymIdFilter) {
        query = query.eq('gym_id', gymIdFilter);
      }
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (memberId) {
      query = query.eq('member_id', memberId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Payments GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createUserServerClient();
    const body = await request.json();

    if (!canRecordPayments(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!body.member_id) {
      return NextResponse.json({ error: 'member_id is required' }, { status: 400 });
    }
    if (body.amount === undefined || body.amount === null) {
      return NextResponse.json({ error: 'amount is required' }, { status: 400 });
    }

    let planId = body.plan_id as string | undefined;
    if (!planId) {
      const { data: member } = await supabase
        .from('members')
        .select('plan_id')
        .eq('id', body.member_id)
        .maybeSingle();
      planId = member?.plan_id || undefined;
    }
    if (!planId) {
      return NextResponse.json({ error: 'plan_id is required' }, { status: 400 });
    }

    const { data, error } = await recordMemberPayment(supabase, {
      memberId: body.member_id,
      planId,
      amount: Number(body.amount),
      discount: Number(body.discount || 0),
      method: body.payment_method,
      notes: body.notes || '',
      branchId: body.branch_id || session.homeBranchId || undefined,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Payments POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
