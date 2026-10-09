import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createUserServerClient } from '@/lib/supabase/server';
import { canManageGymForms } from '@/lib/roles';
import { emptyField, emptySection } from '@/lib/gym-forms';
import { newPublicId, saveDefinition } from '@/lib/gym-form-store';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManageGymForms(session.role) || !session.gymId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const supabase = createUserServerClient();
    const { data, error } = await supabase
      .from('gym_forms')
      .select('id, name, description, status, public_id, created_at, updated_at, gym_form_submissions(count)')
      .eq('gym_id', session.gymId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    const forms = (data || []).map((row) => {
      const related = row.gym_form_submissions as unknown as { count: number }[] | null;
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        public_id: row.public_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        submission_count: related?.[0]?.count || 0,
      };
    });
    return NextResponse.json({ data: forms });
  } catch (error) {
    console.error('gym-forms GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManageGymForms(session.role) || !session.gymId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'Form name is required.' }, { status: 400 });

    const supabase = createUserServerClient();
    const { data, error } = await supabase
      .from('gym_forms')
      .insert({
        gym_id: session.gymId,
        public_id: newPublicId(),
        name,
        description: typeof body.description === 'string' ? body.description.trim() : '',
        status: 'inactive',
        member_sync: body.member_sync === 'create_or_update' ? 'create_or_update' : 'none',
      })
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Unable to create form.' }, { status: 500 });
    const starter = emptySection('Personal details');
    starter.fields = [
      { ...emptyField('short_text'), label: 'Full name', required: true },
      { ...emptyField('phone'), label: 'Phone', required: true },
      { ...emptyField('email'), label: 'Email' },
      { ...emptyField('membership'), label: 'Membership plan' },
    ];
    await saveDefinition(supabase, data.id, [starter]);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('gym-forms POST', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
