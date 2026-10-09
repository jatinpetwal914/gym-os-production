import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase-server';
import { loadFormByPublicId } from '@/lib/gym-form-store';
import {
  extractSubmitter,
  flattenAnswers,
  snapshotForm,
  validateFormAnswers,
  type GymFormAnswer,
} from '@/lib/gym-forms';
import { formUploadPath, validateFormUpload } from '@/lib/gym-form-upload';
import { syncMemberFromForm } from '@/lib/gym-form-member-sync';
import type { Json } from '@/lib/database.types';

export async function POST(request: NextRequest, { params }: { params: { publicId: string } }) {
  try {
    const admin = createAdminClient();
    const form = await loadFormByPublicId(admin, params.publicId);
    if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    if (form.status !== 'active') {
      return NextResponse.json({ error: 'This form is currently unavailable.' }, { status: 410 });
    }

    const payload = await request.formData();
    const rawAnswers = payload.get('answers');
    let parsed: Record<string, unknown> = {};
    try {
      parsed = rawAnswers ? JSON.parse(String(rawAnswers)) : {};
    } catch {
      return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 });
    }

    const validation = validateFormAnswers(form.sections, parsed, form.allowed_plan_ids);
    if (validation) return NextResponse.json({ error: validation }, { status: 400 });

    const answers = flattenAnswers(form.sections, parsed);
    const files: { fieldId: string; file: File; kind: 'photo' | 'file' }[] = [];
    for (const section of form.sections) {
      for (const field of section.fields) {
        if (field.field_type !== 'photo' && field.field_type !== 'file') continue;
        const file = payload.get(`file_${field.id}`);
        if (file instanceof File && file.size > 0) {
          files.push({ fieldId: field.id, file, kind: field.field_type });
          continue;
        }
        if (field.required) return NextResponse.json({ error: `${field.label} is required.` }, { status: 400 });
      }
    }

    const extracted = extractSubmitter(answers);
    const publicReference = `FORM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const { data: created, error: createError } = await admin
      .from('gym_form_submissions')
      .insert({
        gym_id: form.gym_id,
        form_id: form.id,
        public_reference: publicReference,
        submitter_name: extracted.name || null,
        submitter_phone: extracted.phone,
        submitter_email: extracted.email,
        plan_id: extracted.planId,
        schema_snapshot: snapshotForm(form) as unknown as Json,
        answers: answers as unknown as Json,
      })
      .select('id, public_reference')
      .maybeSingle();
    if (createError || !created) {
      console.error('public form submit insert', createError);
      return NextResponse.json({ error: 'Unable to save submission.' }, { status: 500 });
    }

    const nextAnswers: GymFormAnswer[] = [...answers];
    let memberPhoto: { buffer: Buffer; mime: 'image/jpeg' | 'image/png' | 'image/webp' } | null = null;
    for (const item of files) {
      const validated = await validateFormUpload(item.file, item.kind);
      if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
      const ext = 'ext' in validated ? validated.ext : validated.mime === 'image/png' ? 'png' : validated.mime === 'image/webp' ? 'webp' : 'jpg';
      const path = formUploadPath(form.gym_id, form.id, created.id, item.fieldId, ext);
      const { error: uploadError } = await admin.storage.from('gym-form-uploads').upload(path, validated.buffer, {
        contentType: validated.mime,
        upsert: true,
      });
      if (uploadError) {
        console.error('public form upload', uploadError);
        return NextResponse.json({ error: 'Unable to save uploaded file.' }, { status: 500 });
      }
      const index = nextAnswers.findIndex((answer) => answer.field_id === item.fieldId);
      if (index >= 0) nextAnswers[index] = { ...nextAnswers[index], value: path };
      if (item.kind === 'photo' && validated.mime !== 'application/pdf' && !memberPhoto) {
        memberPhoto = { buffer: validated.buffer, mime: validated.mime };
      }
    }

    let memberId: string | null = null;
    if (form.member_sync === 'create_or_update') {
      const synced = await syncMemberFromForm(admin, {
        gymId: form.gym_id,
        answers: nextAnswers,
        planId: extracted.planId,
        photo: memberPhoto,
      });
      memberId = synced.memberId;
    }

    await admin
      .from('gym_form_submissions')
      .update({
        answers: nextAnswers as unknown as Json,
        member_id: memberId,
        plan_id: extracted.planId,
      })
      .eq('id', created.id);

    return NextResponse.json({
      data: {
        reference: created.public_reference,
        success_message: form.success_message || 'Thank you. Your form has been submitted.',
      },
    });
  } catch (error) {
    console.error('public form submit', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
