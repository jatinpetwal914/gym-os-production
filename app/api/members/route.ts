import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createUserServerClient } from '@/lib/supabase/server';
import { canAccessGymPortal, canManageMembers, canAccessStaffApi, isSuperAdminRole } from '@/lib/roles';
import crypto from 'crypto';
import type { Database } from '@/lib/database.types';
import { memberPhotoStoragePath, readAndValidateMemberPhoto } from '@/lib/member-photo';
import { recordMemberPayment } from '@/lib/member-payment';

type MemberInsert = Database['public']['Tables']['members']['Insert'];

function asString(value: unknown) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function asOptionalString(value: unknown) {
  const text = asString(value).trim();
  return text || null;
}

function calculateAge(dateOfBirth: string): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

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
    const search = searchParams.get('search')?.trim() || '';
    const status = searchParams.get('status')?.trim() || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    let query = supabase.from('members').select(
      'id, gym_id, member_id, name, photo_url, date_of_birth, age, gender, phone, address, emergency_contact, plan_id, start_date, expiry_date, amount_paid, status, notes, created_at, updated_at',
      { count: 'exact' }
    );

    if (canAccessGymPortal(session.role)) {
      if (!session.gymId) {
        return NextResponse.json({ error: 'No gym associated with account' }, { status: 403 });
      }
      query = query.eq('gym_id', session.gymId);
    } else if (isSuperAdminRole(session.role)) {
      const gymIdFilter = searchParams.get('gymId');
      if (gymIdFilter) {
        query = query.eq('gym_id', gymIdFilter);
      }
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const safeSearch = search.replace(/[%_,()]/g, '').slice(0, 80);
    if (safeSearch) {
      query = query.or(`name.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%,member_id.ilike.%${safeSearch}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error('Members GET error:', error);
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
    const contentType = request.headers.get('content-type') || '';
    let body: Record<string, unknown> = {};
    let photoFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const photo = form.get('photo');
      photoFile = photo instanceof File ? photo : null;
      body = {
        gymId: asString(form.get('gymId')),
        name: asString(form.get('name')),
        phone: asString(form.get('phone')),
        address: asString(form.get('address')),
        date_of_birth: asString(form.get('date_of_birth')),
        gender: asString(form.get('gender')),
        emergency_contact: asString(form.get('emergency_contact')),
        plan_id: asString(form.get('plan_id')),
        start_date: asString(form.get('start_date')),
        notes: asString(form.get('notes')),
        payment_method: asString(form.get('payment_method')),
        payment_amount: asString(form.get('payment_amount')),
        payment_discount: asString(form.get('payment_discount')),
        payment_notes: asString(form.get('payment_notes')),
      };
    } else {
      const json = await request.json();
      body = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
    }

    if (!canManageMembers(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Determine gymId
    let gymId: string;
    if (canAccessGymPortal(session.role)) {
      if (!session.gymId) {
        return NextResponse.json({ error: 'No gym associated with account' }, { status: 403 });
      }
      gymId = session.gymId;
    } else {
      // SUPER_ADMIN
      const requestedGymId = asString(body.gymId);
      if (!requestedGymId) {
        return NextResponse.json({ error: 'gymId is required' }, { status: 400 });
      }
      gymId = requestedGymId;
    }

    const name = asString(body.name).trim();
    const planId = asString(body.plan_id);
    const startDateValue = asString(body.start_date);
    const paymentMethod = asString(body.payment_method).trim();

    // Validate required fields
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!planId) {
      return NextResponse.json({ error: 'Plan is required' }, { status: 400 });
    }
    if (!startDateValue) {
      return NextResponse.json({ error: 'Start date is required' }, { status: 400 });
    }
    if (!paymentMethod) {
      return NextResponse.json({ error: 'Payment method is required to complete registration.' }, { status: 400 });
    }

    if (!photoFile) {
      return NextResponse.json({ error: 'Photograph is required.' }, { status: 400 });
    }
    const photo = await readAndValidateMemberPhoto(photoFile);
    if (!photo.ok) {
      return NextResponse.json({ error: photo.error }, { status: 400 });
    }

    // Fetch plan to get duration and price
    const { data: plan, error: planError } = await supabase
      .from('membership_plans')
      .select('id, duration_days, final_price, gym_id')
      .eq('id', planId)
      .maybeSingle();

    if (planError) throw planError;
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }
    if (plan.gym_id !== gymId) {
      return NextResponse.json({ error: 'Plan does not belong to this gym' }, { status: 403 });
    }

    // Auto-generate member_id: gym_id + sequential number
    const { count: existingCount, error: countError } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('gym_id', gymId);

    if (countError) throw countError;

    const { data: gymRow } = await supabase.from('gyms').select('gym_id').eq('id', gymId).maybeSingle();
    const gymCode = gymRow?.gym_id || gymId;

    const { data: defaultBranch } = await supabase
      .from('gym_branches')
      .select('id')
      .eq('gym_id', gymId)
      .eq('is_default', true)
      .maybeSingle();

    const seqNumber = (existingCount || 0) + 1;
    const memberId = `${gymCode}-${String(seqNumber).padStart(4, '0')}`;
    const qrToken = crypto.randomBytes(32).toString('hex');
    const startDate = new Date(startDateValue);
    const expiryDate = new Date(startDate);
    expiryDate.setDate(expiryDate.getDate() + plan.duration_days);
    const expiryDateStr = expiryDate.toISOString().split('T')[0];
    const status = 'inactive';
    const dateOfBirth = asOptionalString(body.date_of_birth);
    const age = dateOfBirth ? calculateAge(dateOfBirth) : null;

    const insertData: MemberInsert = {
      gym_id: gymId,
      home_branch_id: defaultBranch?.id || null,
      member_id: memberId,
      name,
      phone: asOptionalString(body.phone),
      address: asOptionalString(body.address),
      date_of_birth: dateOfBirth,
      age,
      gender: asOptionalString(body.gender),
      emergency_contact: asOptionalString(body.emergency_contact),
      plan_id: planId,
      start_date: startDateValue,
      expiry_date: expiryDateStr,
      amount_paid: 0,
      status,
      qr_token: qrToken,
      notes: asOptionalString(body.notes),
    };

    const { data: member, error: insertError } = await supabase
      .from('members')
      .insert(insertData)
      .select('id, gym_id, member_id, name, photo_url, date_of_birth, age, gender, phone, address, emergency_contact, plan_id, start_date, expiry_date, amount_paid, status, notes, created_at, updated_at')
      .maybeSingle();

    if (insertError) throw insertError;
    if (!member) {
      return NextResponse.json({ error: 'Unable to create member' }, { status: 500 });
    }

    const photoPath = memberPhotoStoragePath(gymId, member.id, photo.mime);
    const { error: uploadError } = await supabase.storage.from('member-photos').upload(photoPath, photo.buffer, {
      contentType: photo.mime,
      upsert: true,
    });
    if (uploadError) {
      console.error('Member photo upload on create', uploadError);
      await supabase.from('memberships').delete().eq('member_id', member.id);
      await supabase.from('members').delete().eq('id', member.id);
      return NextResponse.json({ error: 'Could not save the photograph. Please try again.' }, { status: 500 });
    }

    const { data: withPhoto, error: photoUpdateError } = await supabase
      .from('members')
      .update({ photo_url: photoPath })
      .eq('id', member.id)
      .select('id, gym_id, member_id, name, photo_url, date_of_birth, age, gender, phone, address, emergency_contact, plan_id, start_date, expiry_date, amount_paid, status, notes, created_at, updated_at')
      .maybeSingle();

    if (photoUpdateError) throw photoUpdateError;
    const saved = withPhoto || { ...member, photo_url: photoPath };

    const { error: membershipError } = await supabase.from('memberships').insert({
      gym_id: gymId,
      branch_id: defaultBranch?.id || null,
      member_id: saved.id,
      plan_id: planId,
      starts_on: startDateValue,
      ends_on: expiryDateStr,
      status: 'pending',
      amount_due: plan.final_price,
      amount_paid: 0,
    });
    if (membershipError) {
      console.error('Membership insert on create', membershipError);
      return NextResponse.json(
        { error: 'Member photograph saved, but the membership could not be created. Try again from this profile.' },
        { status: 500 }
      );
    }

    let payment = null;
    let paymentError: string | null = null;
    const paidAmount = Number(body.payment_amount ?? plan.final_price);
    const result = await recordMemberPayment(supabase, {
      memberId: saved.id,
      planId,
      amount: Number.isFinite(paidAmount) ? paidAmount : plan.final_price,
      discount: Number(body.payment_discount || 0),
      method: paymentMethod,
      notes: asString(body.payment_notes) || 'Collected during registration',
      branchId: session.homeBranchId || defaultBranch?.id || null,
    });
    if (result.error) {
      paymentError = result.error.message;
    } else {
      payment = result.data;
    }

    return NextResponse.json(
      {
        data: saved,
        payment,
        payment_error: paymentError,
        message: paymentError
          ? 'Member saved with photograph. Payment could not be recorded — complete it from this registration.'
          : undefined,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Members POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
