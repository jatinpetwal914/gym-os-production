import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createUserServerClient } from '@/lib/supabase/server';
import { canAccessGymPortal, canAccessStaffApi, canRecordPayments, isSuperAdminRole } from '@/lib/roles';

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
        notes, created_at, status,
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

    const method = String(body.payment_method || 'cash')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
    const allowed = new Set(['cash', 'card', 'bank_transfer', 'digital_wallet', 'upi']);
    const pMethod = allowed.has(method)
      ? method
      : method === 'bank'
        ? 'bank_transfer'
        : method === 'wallet'
          ? 'digital_wallet'
          : 'cash';

    const { data, error } = await supabase.rpc('record_payment', {
      p_member_id: body.member_id,
      p_plan_id: planId,
      p_amount: Number(body.amount),
      p_discount: Number(body.discount || 0),
      p_method: pMethod,
      p_notes: body.notes || '',
      p_branch_id: body.branch_id || session.homeBranchId || undefined,
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
