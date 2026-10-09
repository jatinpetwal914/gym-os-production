import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createUserServerClient } from '@/lib/supabase/server';
import { canAccessGymPortal, canManagePlans, canAccessStaffApi, isSuperAdminRole } from '@/lib/roles';

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
    const gymIdFilter = searchParams.get('gymId');

    let query = supabase
      .from('membership_plans')
      .select('id, gym_id, name, duration_days, price, discount, final_price, description, status, tier, created_at, updated_at')
      .order('created_at', { ascending: false });

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

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Plans GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canManagePlans(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createUserServerClient();
    const body = await request.json();

    // Determine gymId
    let gymId: string;
    if (canAccessGymPortal(session.role)) {
      if (!session.gymId) {
        return NextResponse.json({ error: 'No gym associated with account' }, { status: 403 });
      }
      gymId = session.gymId;
    } else {
      // SUPER_ADMIN
      if (!body.gymId) {
        return NextResponse.json({ error: 'gymId is required' }, { status: 400 });
      }
      gymId = body.gymId;
    }

    // Validate required fields
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (body.duration_days === undefined || body.duration_days === null) {
      return NextResponse.json({ error: 'Duration is required' }, { status: 400 });
    }
    if (body.price === undefined || body.price === null) {
      return NextResponse.json({ error: 'Price is required' }, { status: 400 });
    }

    // Calculate final_price
    const price = Number(body.price);
    const discount = Number(body.discount || 0);
    const finalPrice = price - discount;

    if (finalPrice < 0) {
      return NextResponse.json({ error: 'Discount cannot exceed price' }, { status: 400 });
    }

    const tier = body.tier === 'premium' ? 'premium' : 'standard';

    const insertData = {
      gym_id: gymId,
      name: body.name.trim(),
      duration_days: Number(body.duration_days),
      price,
      discount,
      final_price: finalPrice,
      description: body.description || null,
      status: 'active',
      tier,
    };

    const { data: plan, error } = await supabase
      .from('membership_plans')
      .insert(insertData)
      .select('id, gym_id, name, duration_days, price, discount, final_price, description, status, tier, created_at, updated_at')
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ data: plan }, { status: 201 });
  } catch (error) {
    console.error('Plans POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
