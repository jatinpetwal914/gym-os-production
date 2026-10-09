'use client';

import type { GymFormField, GymFormSection } from '@/lib/gym-forms';
import { PhotoCapture } from '@/components/gym/photo-capture';

export type FormPlanOption = {
  id: string;
  name: string;
  duration_days: number;
  final_price?: number;
};

const inputClass =
  'w-full rounded-xl border border-[#DAE1E7] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#2064B6] focus:ring-2 focus:ring-[#6DCCC3]/40';

export function GymFormRenderer({
  sections,
  values,
  files,
  plans,
  onChange,
  onFile,
  disabled,
}: {
  sections: GymFormSection[];
  values: Record<string, unknown>;
  files?: Record<string, File | null>;
  plans?: FormPlanOption[];
  onChange: (fieldId: string, value: unknown) => void;
  onFile?: (fieldId: string, file: File | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <section key={section.id} className="space-y-4">
          <h3 className="border-b border-[#DAE1E7] pb-2 text-sm font-semibold text-slate-800">{section.title}</h3>
          {section.fields.map((field) => (
            <FieldControl
              key={field.id}
              field={field}
              value={values[field.id]}
              file={files?.[field.id] || null}
              plans={plans}
              disabled={disabled}
              onChange={(value) => onChange(field.id, value)}
              onFile={onFile ? (file) => onFile(field.id, file) : undefined}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function FieldControl({
  field,
  value,
  file,
  plans,
  disabled,
  onChange,
  onFile,
}: {
  field: GymFormField;
  value: unknown;
  file?: File | null;
  plans?: FormPlanOption[];
  disabled?: boolean;
  onChange: (value: unknown) => void;
  onFile?: (file: File | null) => void;
}) {
  const label = (
    <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor={field.id}>
      {field.label} {field.required ? <span className="text-red-300">*</span> : null}
    </label>
  );
  const help = field.help_text ? <p className="mt-1 text-xs text-slate-400">{field.help_text}</p> : null;

  if (field.field_type === 'photo') {
    return (
      <div>
        <PhotoCapture
          value={file || null}
          onChange={(next) => onFile?.(next)}
          required={field.required}
          label={field.label}
        />
        {help}
      </div>
    );
  }

  if (field.field_type === 'file') {
    return (
      <div>
        {label}
        <input
          id={field.id}
          type="file"
          disabled={disabled}
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-zinc-950"
          onChange={(event) => onFile?.(event.target.files?.[0] || null)}
        />
        {file ? <p className="mt-1 text-xs text-slate-400">{file.name}</p> : null}
        {help}
      </div>
    );
  }

  if (field.field_type === 'long_text' || field.field_type === 'address') {
    return (
      <div>
        {label}
        <textarea
          id={field.id}
          disabled={disabled}
          rows={4}
          placeholder={field.placeholder}
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
        {help}
      </div>
    );
  }

  if (field.field_type === 'dropdown' || field.field_type === 'membership') {
    const options =
      field.field_type === 'membership'
        ? (plans || []).map((plan) => ({
            value: plan.id,
            label: `${plan.name} · ${plan.duration_days} days${plan.final_price != null ? ` · ₹${plan.final_price}` : ''}`,
          }))
        : field.options.map((option) => ({ value: option, label: option }));
    return (
      <div>
        {label}
        <select
          id={field.id}
          disabled={disabled}
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        >
          <option value="">{field.placeholder || 'Select'}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {help}
      </div>
    );
  }

  if (field.field_type === 'radio') {
    return (
      <fieldset>
        {label}
        <div className="space-y-2">
          {field.options.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="radio"
                name={field.id}
                disabled={disabled}
                checked={String(value ?? '') === option}
                onChange={() => onChange(option)}
              />
              {option}
            </label>
          ))}
        </div>
        {help}
      </fieldset>
    );
  }

  if (field.field_type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          id={field.id}
          type="checkbox"
          disabled={disabled}
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
        {field.label} {field.required ? <span className="text-red-300">*</span> : null}
      </label>
    );
  }

  if (field.field_type === 'multi_checkbox') {
    const selected = Array.isArray(value) ? value.map(String) : [];
    return (
      <fieldset>
        {label}
        <div className="space-y-2">
          {field.options.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                disabled={disabled}
                checked={selected.includes(option)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...selected, option]
                    : selected.filter((item) => item !== option);
                  onChange(next);
                }}
              />
              {option}
            </label>
          ))}
        </div>
        {help}
      </fieldset>
    );
  }

  const type =
    field.field_type === 'number'
      ? 'number'
      : field.field_type === 'email'
        ? 'email'
        : field.field_type === 'date'
          ? 'date'
          : field.field_type === 'phone'
            ? 'tel'
            : 'text';

  return (
    <div>
      {label}
      <input
        id={field.id}
        type={type}
        disabled={disabled}
        placeholder={field.placeholder}
        value={String(value ?? '')}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
      {help}
    </div>
  );
}
