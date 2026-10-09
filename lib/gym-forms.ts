export const GYM_FORM_FIELD_TYPES = [
  'short_text',
  'long_text',
  'number',
  'phone',
  'email',
  'date',
  'dropdown',
  'radio',
  'checkbox',
  'multi_checkbox',
  'file',
  'photo',
  'membership',
  'emergency_contact',
  'address',
] as const;

export type GymFormFieldType = (typeof GYM_FORM_FIELD_TYPES)[number];

export type GymFormField = {
  id: string;
  field_type: GymFormFieldType;
  label: string;
  placeholder: string;
  help_text: string;
  required: boolean;
  options: string[];
  default_value: string;
  sort_order: number;
};

export type GymFormSection = {
  id: string;
  title: string;
  sort_order: number;
  fields: GymFormField[];
};

export type GymFormRecord = {
  id: string;
  gym_id: string;
  public_id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  success_message: string;
  member_sync: 'none' | 'create_or_update';
  allowed_plan_ids: string[];
  created_at: string;
  updated_at: string;
  sections: GymFormSection[];
  submission_count?: number;
};

export type GymFormAnswer = {
  field_id: string;
  label: string;
  field_type: string;
  value: string | string[] | boolean | number | null;
};

export function publicFormUrl(publicId: string) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '') || 'http://localhost:3000';
  return `${base}/f/${publicId}`;
}

export function clientPublicFormUrl(publicId: string) {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/f/${publicId}`;
  }
  return publicFormUrl(publicId);
}

export function newClientId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function emptyField(type: GymFormFieldType = 'short_text'): GymFormField {
  return {
    id: newClientId(),
    field_type: type,
    label: type === 'membership' ? 'Membership plan' : 'New field',
    placeholder: '',
    help_text: '',
    required: false,
    options: type === 'dropdown' || type === 'radio' || type === 'multi_checkbox' ? ['Option 1'] : [],
    default_value: '',
    sort_order: 0,
  };
}

export function emptySection(title = 'Section 1'): GymFormSection {
  return {
    id: newClientId(),
    title,
    sort_order: 0,
    fields: [emptyField('short_text')],
  };
}

export function fieldTypeLabel(type: GymFormFieldType) {
  const labels: Record<GymFormFieldType, string> = {
    short_text: 'Short text',
    long_text: 'Long text',
    number: 'Number',
    phone: 'Phone',
    email: 'Email',
    date: 'Date',
    dropdown: 'Dropdown',
    radio: 'Radio buttons',
    checkbox: 'Checkbox',
    multi_checkbox: 'Multiple checkboxes',
    file: 'File upload',
    photo: 'Photo',
    membership: 'Membership plan',
    emergency_contact: 'Emergency contact',
    address: 'Address',
  };
  return labels[type];
}

export function snapshotForm(form: Pick<GymFormRecord, 'name' | 'description' | 'sections'>) {
  return {
    name: form.name,
    description: form.description,
    sections: form.sections.map((section) => ({
      id: section.id,
      title: section.title,
      fields: section.fields.map((field) => ({
        id: field.id,
        field_type: field.field_type,
        label: field.label,
        required: field.required,
        options: field.options,
      })),
    })),
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateFormAnswers(
  sections: GymFormSection[],
  answers: Record<string, unknown>,
  allowedPlanIds: string[] = []
): string | null {
  for (const section of sections) {
    for (const field of section.fields) {
      const raw = answers[field.id];
      const empty =
        raw == null ||
        raw === '' ||
        (Array.isArray(raw) && raw.length === 0) ||
        raw === false;
      if (field.required && empty) return `${field.label} is required.`;
      if (empty) continue;
      if (field.field_type === 'email' && !EMAIL_RE.test(String(raw))) return 'Enter a valid email address.';
      if (field.field_type === 'phone' && !PHONE_RE.test(String(raw))) return 'Enter a valid phone number.';
      if (field.field_type === 'number' && Number.isNaN(Number(raw))) return `${field.label} must be a number.`;
      if (field.field_type === 'membership') {
        const planId = String(raw);
        if (!UUID_RE.test(planId)) return 'Select a valid membership plan.';
        if (allowedPlanIds.length && !allowedPlanIds.includes(planId)) return 'That membership plan is not available on this form.';
      }
      if ((field.field_type === 'dropdown' || field.field_type === 'radio') && field.options.length) {
        if (!field.options.includes(String(raw))) return `${field.label} has an invalid option.`;
      }
      if (field.field_type === 'multi_checkbox' && Array.isArray(raw) && field.options.length) {
        if (raw.some((item) => !field.options.includes(String(item)))) return `${field.label} has an invalid option.`;
      }
    }
  }
  return null;
}

export function extractSubmitter(answers: GymFormAnswer[]) {
  const byType = (type: GymFormFieldType) => answers.find((item) => item.field_type === type);
  const byLabel = (needle: string) =>
    answers.find((item) => item.label.toLowerCase().includes(needle) && item.value != null && String(item.value).trim());
  const name = String(byLabel('name')?.value || byType('short_text')?.value || '').trim();
  const phone = String(byType('phone')?.value || byLabel('phone')?.value || '').trim();
  const email = String(byType('email')?.value || byLabel('email')?.value || '').trim();
  const planId = String(byType('membership')?.value || '').trim();
  const address = String(byType('address')?.value || byLabel('address')?.value || '').trim();
  const emergency = String(byType('emergency_contact')?.value || byLabel('emergency')?.value || '').trim();
  const gender = String(byLabel('gender')?.value || '').trim();
  return {
    name,
    phone: phone || null,
    email: email || null,
    planId: planId || null,
    address: address || null,
    emergency: emergency || null,
    gender: gender || null,
  };
}

export function newSubmissionReference() {
  const bytes = typeof crypto !== 'undefined' && 'getRandomValues' in crypto
    ? Array.from(crypto.getRandomValues(new Uint8Array(4)))
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('')
    : Math.random().toString(16).slice(2, 10);
  return `FORM-${bytes.toUpperCase()}`;
}

export function flattenAnswers(sections: GymFormSection[], answers: Record<string, unknown>): GymFormAnswer[] {
  const rows: GymFormAnswer[] = [];
  for (const section of sections) {
    for (const field of section.fields) {
      const value = answers[field.id];
      rows.push({
        field_id: field.id,
        label: field.label,
        field_type: field.field_type,
        value: (value as GymFormAnswer['value']) ?? null,
      });
    }
  }
  return rows;
}

export function answerValue(answers: GymFormAnswer[], types: GymFormFieldType[]) {
  const row = answers.find((item) => types.includes(item.field_type as GymFormFieldType));
  return row && row.value != null ? String(row.value) : '';
}
