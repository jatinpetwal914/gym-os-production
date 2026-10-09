import { NextRequest, NextResponse } from 'next/server';
import { requireGymFormsSession } from '@/lib/gym-form-auth';
import { createUserServerClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/database.types';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireGymFormsSession();
    if ('error' in auth) return auth.error;
    const supabase = createUserServerClient();
    const { data, error } = await supabase
      .from('gym_form_submissions')
      .select(
        'id, public_reference, submitter_name, submitter_phone, submitter_email, created_at, updated_at, form_id, plan_id, member_id, schema_snapshot, answers, gym_forms(name, public_id), membership_plans(id, name, duration_days), members(id, member_id, name, photo_url)'
      )
      .eq('id', params.id)
      .eq('gym_id', auth.session.gymId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (error) {
    console.error('gym-form submission GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireGymFormsSession();
    if ('error' in auth) return auth.error;
    const body = await request.json().catch(() => ({}));
    const supabase = createUserServerClient();
    const { data: existing, error: loadError } = await supabase
      .from('gym_form_submissions')
      .select('id')
      .eq('id', params.id)
      .eq('gym_id', auth.session.gymId)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!existing) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });

    const patch: {
      submitter_name?: string;
      submitter_phone?: string;
      submitter_email?: string;
      answers?: Json;
    } = {};
    if (typeof body.submitter_name === 'string') patch.submitter_name = body.submitter_name.trim();
    if (typeof body.submitter_phone === 'string') patch.submitter_phone = body.submitter_phone.trim();
    if (typeof body.submitter_email === 'string') patch.submitter_email = body.submitter_email.trim();
    if (Array.isArray(body.answers)) patch.answers = body.answers as unknown as Json;
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'No changes provided.' }, { status: 400 });

    const { error } = await supabase
      .from('gym_form_submissions')
      .update(patch)
      .eq('id', params.id)
      .eq('gym_id', auth.session.gymId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('gym-form submission PATCH', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireGymFormsSession();
    if ('error' in auth) return auth.error;
    const supabase = createUserServerClient();
    const { error } = await supabase
      .from('gym_form_submissions')
      .delete()
      .eq('id', params.id)
      .eq('gym_id', auth.session.gymId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('gym-form submission DELETE', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
