import { NextRequest, NextResponse } from 'next/server';
import { createUserServerClient } from '@/lib/supabase/server';
import { requireGymFormsSession } from '@/lib/gym-form-auth';
import { loadForm, saveDefinition } from '@/lib/gym-form-store';
import type { GymFormSection } from '@/lib/gym-forms';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireGymFormsSession();
    if ('error' in auth) return auth.error;
    const supabase = createUserServerClient();
    const form = await loadForm(supabase, params.id, auth.session.gymId);
    if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    return NextResponse.json({ data: form });
  } catch (error) {
    console.error('gym-form GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireGymFormsSession();
    if ('error' in auth) return auth.error;
    const body = await request.json().catch(() => ({}));
    const supabase = createUserServerClient();
    const existing = await loadForm(supabase, params.id, auth.session.gymId);
    if (!existing) return NextResponse.json({ error: 'Form not found' }, { status: 404 });

    const name = typeof body.name === 'string' ? body.name.trim() : existing.name;
    if (!name) return NextResponse.json({ error: 'Form name is required.' }, { status: 400 });

    const { error } = await supabase
      .from('gym_forms')
      .update({
        name,
        description: typeof body.description === 'string' ? body.description : existing.description,
        status: body.status === 'active' ? 'active' : body.status === 'inactive' ? 'inactive' : existing.status,
        success_message: typeof body.success_message === 'string' ? body.success_message : existing.success_message,
        member_sync: body.member_sync === 'create_or_update' ? 'create_or_update' : body.member_sync === 'none' ? 'none' : existing.member_sync,
        allowed_plan_ids: Array.isArray(body.allowed_plan_ids) ? body.allowed_plan_ids : existing.allowed_plan_ids,
      })
      .eq('id', params.id)
      .eq('gym_id', auth.session.gymId);
    if (error) throw error;

    if (Array.isArray(body.sections)) {
      await saveDefinition(supabase, params.id, body.sections as GymFormSection[]);
    }

    const saved = await loadForm(supabase, params.id, auth.session.gymId);
    return NextResponse.json({ data: saved });
  } catch (error) {
    console.error('gym-form PUT', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireGymFormsSession();
    if ('error' in auth) return auth.error;
    const body = await request.json().catch(() => ({}));
    const status = body.status === 'active' ? 'active' : body.status === 'inactive' ? 'inactive' : null;
    if (!status) return NextResponse.json({ error: 'Status must be active or inactive.' }, { status: 400 });
    const supabase = createUserServerClient();
    const { error } = await supabase
      .from('gym_forms')
      .update({ status })
      .eq('id', params.id)
      .eq('gym_id', auth.session.gymId);
    if (error) throw error;
    const form = await loadForm(supabase, params.id, auth.session.gymId);
    if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    return NextResponse.json({ data: form });
  } catch (error) {
    console.error('gym-form PATCH', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireGymFormsSession();
    if ('error' in auth) return auth.error;
    const supabase = createUserServerClient();
    const { count } = await supabase
      .from('gym_form_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('form_id', params.id);
    if ((count || 0) > 0) {
      return NextResponse.json(
        { error: 'This form has submissions. Deactivate it instead of deleting, or delete submissions first.' },
        { status: 409 }
      );
    }
    const { error } = await supabase.from('gym_forms').delete().eq('id', params.id).eq('gym_id', auth.session.gymId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('gym-form DELETE', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
