import { NextRequest, NextResponse } from 'next/server';
import { requireGymFormsSession } from '@/lib/gym-form-auth';
import { createUserServerClient } from '@/lib/supabase/server';

function csvEscape(value: unknown) {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireGymFormsSession();
    if ('error' in auth) return auth.error;
    const supabase = createUserServerClient();
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').replace(/[%_,()]/g, '').slice(0, 80);
    const formId = searchParams.get('formId') || '';
    const planId = searchParams.get('planId') || '';
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';
    const format = searchParams.get('format') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = format === 'csv' ? 2000 : Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    let query = supabase
      .from('gym_form_submissions')
      .select(
        'id, public_reference, submitter_name, submitter_phone, submitter_email, created_at, form_id, plan_id, member_id, gym_forms(name), membership_plans(name, duration_days)',
        { count: 'exact' }
      )
      .eq('gym_id', auth.session.gymId)
      .order('created_at', { ascending: false });

    if (formId) query = query.eq('form_id', formId);
    if (planId) query = query.eq('plan_id', planId);
    if (from) query = query.gte('created_at', `${from}T00:00:00`);
    if (to) query = query.lte('created_at', `${to}T23:59:59`);
    if (search) {
      query = query.or(
        `submitter_name.ilike.%${search}%,submitter_phone.ilike.%${search}%,submitter_email.ilike.%${search}%,public_reference.ilike.%${search}%`
      );
    }

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    const rows = (data || []).map((row) => {
      const form = row.gym_forms as { name?: string } | { name?: string }[] | null;
      const plan = row.membership_plans as { name?: string; duration_days?: number } | { name?: string; duration_days?: number }[] | null;
      const formName = Array.isArray(form) ? form[0]?.name : form?.name;
      const planRow = Array.isArray(plan) ? plan[0] : plan;
      return {
        id: row.id,
        public_reference: row.public_reference,
        submitter_name: row.submitter_name,
        submitter_phone: row.submitter_phone,
        submitter_email: row.submitter_email,
        created_at: row.created_at,
        form_id: row.form_id,
        plan_id: row.plan_id,
        member_id: row.member_id,
        form_name: formName || 'Form',
        membership: planRow?.name || '',
        membership_duration: planRow?.duration_days ? `${planRow.duration_days} days` : '',
      };
    });

    if (format === 'csv') {
      const header = 'Name,Phone,Email,Form,Membership,Duration,Reference,Submitted';
      const body = rows
        .map((row) =>
          [row.submitter_name, row.submitter_phone, row.submitter_email, row.form_name, row.membership, row.membership_duration, row.public_reference, row.created_at]
            .map(csvEscape)
            .join(',')
        )
        .join('\n');
      return new NextResponse(`${header}\n${body}`, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="form-submissions.csv"',
        },
      });
    }

    return NextResponse.json({ data: rows, total: count || 0, page, limit });
  } catch (error) {
    console.error('gym-form submissions GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
