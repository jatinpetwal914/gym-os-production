import crypto from 'crypto';
import type { GymFormField, GymFormRecord, GymFormSection } from '@/lib/gym-forms';
import { GYM_FORM_FIELD_TYPES } from '@/lib/gym-forms';

type AnyClient = any;

export function newPublicId() {
  return crypto.randomBytes(8).toString('hex');
}

function mapField(row: Record<string, unknown>, index: number): GymFormField {
  const type = GYM_FORM_FIELD_TYPES.includes(row.field_type as never) ? row.field_type : 'short_text';
  return {
    id: String(row.id),
    field_type: type as GymFormField['field_type'],
    label: String(row.label || ''),
    placeholder: String(row.placeholder || ''),
    help_text: String(row.help_text || ''),
    required: Boolean(row.required),
    options: Array.isArray(row.options) ? row.options.map(String) : [],
    default_value: String(row.default_value || ''),
    sort_order: Number(row.sort_order ?? index),
  };
}

export async function loadForm(supabase: AnyClient, formId: string, gymId: string): Promise<GymFormRecord | null> {
  const { data: form, error } = await supabase.from('gym_forms').select('*').eq('id', formId).eq('gym_id', gymId).maybeSingle();
  if (error) throw error;
  if (!form) return null;
  return attachDefinition(supabase, form);
}

export async function loadFormByPublicId(supabase: AnyClient, publicId: string) {
  const { data: form, error } = await supabase.from('gym_forms').select('*').eq('public_id', publicId).maybeSingle();
  if (error) throw error;
  if (!form) return null;
  return attachDefinition(supabase, form);
}

async function attachDefinition(supabase: AnyClient, form: Record<string, unknown>): Promise<GymFormRecord> {
  const { data: sections, error: sectionError } = await supabase
    .from('gym_form_sections')
    .select('*')
    .eq('form_id', form.id)
    .order('sort_order');
  if (sectionError) throw sectionError;
  const { data: fields, error: fieldError } = await supabase.from('gym_form_fields').select('*').eq('form_id', form.id).order('sort_order');
  if (fieldError) throw fieldError;

  const nested: GymFormSection[] = (sections || []).map((section: Record<string, unknown>, index: number) => ({
    id: String(section.id),
    title: String(section.title || 'Section'),
    sort_order: Number(section.sort_order ?? index),
    fields: (fields || [])
      .filter((field: Record<string, unknown>) => field.section_id === section.id)
      .map((field: Record<string, unknown>, fieldIndex: number) => mapField(field, fieldIndex)),
  }));

  return {
    id: String(form.id),
    gym_id: String(form.gym_id),
    public_id: String(form.public_id),
    name: String(form.name),
    description: String(form.description || ''),
    status: form.status === 'active' ? 'active' : 'inactive',
    success_message: String(form.success_message || ''),
    member_sync: form.member_sync === 'create_or_update' ? 'create_or_update' : 'none',
    allowed_plan_ids: Array.isArray(form.allowed_plan_ids) ? form.allowed_plan_ids.map(String) : [],
    created_at: String(form.created_at),
    updated_at: String(form.updated_at),
    sections: nested,
  };
}

export async function saveDefinition(
  supabase: AnyClient,
  formId: string,
  sections: GymFormSection[]
) {
  await supabase.from('gym_form_sections').delete().eq('form_id', formId);
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const section = sections[sectionIndex];
    const sectionId = crypto.randomUUID();
    const { error: sectionError } = await supabase.from('gym_form_sections').insert({
      id: sectionId,
      form_id: formId,
      title: section.title.trim() || `Section ${sectionIndex + 1}`,
      sort_order: sectionIndex,
    });
    if (sectionError) throw sectionError;
    const fieldRows = section.fields.map((field: GymFormSection['fields'][number], fieldIndex: number) => ({
      id: crypto.randomUUID(),
      form_id: formId,
      section_id: sectionId,
      field_type: GYM_FORM_FIELD_TYPES.includes(field.field_type) ? field.field_type : 'short_text',
      label: field.label.trim() || 'Field',
      placeholder: field.placeholder || '',
      help_text: field.help_text || '',
      required: Boolean(field.required),
      options: field.options || [],
      default_value: field.default_value || '',
      sort_order: fieldIndex,
    }));
    if (fieldRows.length) {
      const { error: fieldError } = await supabase.from('gym_form_fields').insert(fieldRows);
      if (fieldError) throw fieldError;
    }
  }
}
