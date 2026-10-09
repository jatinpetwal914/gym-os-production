import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';
import { loadFormByPublicId } from '@/lib/gym-form-store';

export async function GET(_request: Request, { params }: { params: { publicId: string } }) {
  try {
    const admin = createAdminClient();
    const form = await loadFormByPublicId(admin, params.publicId);
    if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 });

    const { data: gym } = await admin.from('gyms').select('name').eq('id', form.gym_id).maybeSingle();
    const gymName = gym?.name || 'Gym';

    if (form.status !== 'active') {
      return NextResponse.json({
        available: false,
        gym_name: gymName,
        message: 'This form is currently unavailable. Please contact the gym if you need to submit it.',
      });
    }

    let planQuery = admin
      .from('membership_plans')
      .select('id, name, duration_days, final_price, status')
      .eq('gym_id', form.gym_id)
      .eq('status', 'active')
      .order('duration_days');
    if (form.allowed_plan_ids.length) {
      planQuery = planQuery.in('id', form.allowed_plan_ids);
    }
    const { data: plans } = await planQuery;

    return NextResponse.json({
      available: true,
      gym_name: gymName,
      data: {
        public_id: form.public_id,
        name: form.name,
        description: form.description,
        success_message: form.success_message,
        sections: form.sections,
      },
      plans: plans || [],
    });
  } catch (error) {
    console.error('public form GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
