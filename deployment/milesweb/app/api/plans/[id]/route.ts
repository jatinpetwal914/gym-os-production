import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createUserServerClient } from '@/lib/supabase/server';
import { canAccessGymPortal, canManagePlans } from '@/lib/roles';
import type { Database } from '@/lib/database.types';

type PlanUpdate = Database['public']['Tables']['membership_plans']['Update'];

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canManagePlans(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createUserServerClient();
    const planId = params.id;
    const body = await request.json();

    // Fetch existing plan to verify ownership
    let planQuery = supabase
      .from('membership_plans')
      .select('id, gym_id, price, discount')
      .eq('id', planId);

    if (canAccessGymPortal(session.role)) {
      if (!session.gymId) {
        return NextResponse.json({ error: 'No gym associated with account' }, { status: 403 });
      }
      planQuery = planQuery.eq('gym_id', session.gymId);
    }

    const { data: existingPlan, error: fetchError } = await planQuery.maybeSingle();

    if (fetchError) throw fetchError;
    if (!existingPlan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Build update object
    const updateData: PlanUpdate = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.duration_days !== undefined) updateData.duration_days = Number(body.duration_days);
    if (body.description !== undefined) updateData.description = body.description;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.tier !== undefined) updateData.tier = body.tier === 'premium' ? 'premium' : 'standard';

    // Handle price/discount changes — recalculate final_price
    const price = body.price !== undefined ? Number(body.price) : Number(existingPlan.price);
    const discount = body.discount !== undefined ? Number(body.discount) : Number(existingPlan.discount);

    if (body.price !== undefined || body.discount !== undefined) {
      const finalPrice = price - discount;
      if (finalPrice < 0) {
        return NextResponse.json({ error: 'Discount cannot exceed price' }, { status: 400 });
      }
      updateData.price = price;
      updateData.discount = discount;
      updateData.final_price = finalPrice;
    }

    const { data: updatedPlan, error: updateError } = await supabase
      .from('membership_plans')
      .update(updateData)
      .eq('id', planId)
      .select('id, gym_id, name, duration_days, price, discount, final_price, description, status, tier, created_at, updated_at')
      .maybeSingle();

    if (updateError) throw updateError;

    return NextResponse.json({ data: updatedPlan });
  } catch (error) {
    console.error('Plan PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canManagePlans(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createUserServerClient();
    const planId = params.id;

    // Verify ownership before deleting
    let planQuery = supabase
      .from('membership_plans')
      .select('id, gym_id')
      .eq('id', planId);

    if (canAccessGymPortal(session.role)) {
      if (!session.gymId) {
        return NextResponse.json({ error: 'No gym associated with account' }, { status: 403 });
      }
      planQuery = planQuery.eq('gym_id', session.gymId);
    }

    const { data: existingPlan, error: fetchError } = await planQuery.maybeSingle();

    if (fetchError) throw fetchError;
    if (!existingPlan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from('membership_plans')
      .delete()
      .eq('id', planId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Plan DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
