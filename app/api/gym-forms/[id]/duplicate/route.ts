import { NextResponse } from 'next/server';
import { requireGymFormsSession } from '@/lib/gym-form-auth';
import { createUserServerClient } from '@/lib/supabase/server';
import { loadForm, newPublicId, saveDefinition } from '@/lib/gym-form-store';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireGymFormsSession();
    if ('error' in auth) return auth.error;
    const supabase = createUserServerClient();
    const existing = await loadForm(supabase, params.id, auth.session.gymId);
    if (!existing) return NextResponse.json({ error: 'Form not found' }, { status: 404 });

    const { data, error } = await supabase
      .from('gym_forms')
      .insert({
        gym_id: auth.session.gymId,
        public_id: newPublicId(),
        name: `${existing.name} (copy)`,
        description: existing.description,
        status: 'inactive',
        success_message: existing.success_message,
        member_sync: existing.member_sync,
        allowed_plan_ids: existing.allowed_plan_ids,
      })
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Unable to duplicate form.' }, { status: 500 });
    await saveDefinition(supabase, data.id, existing.sections);
    const copy = await loadForm(supabase, data.id, auth.session.gymId);
    return NextResponse.json({ data: copy }, { status: 201 });
  } catch (error) {
    console.error('gym-form duplicate', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
