import { detectMemberPhotoMime, MEMBER_PHOTO_MAX_BYTES, readAndValidateMemberPhoto } from '@/lib/member-photo';

export const FORM_FILE_MAX_BYTES = 8 * 1024 * 1024;
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46];

function isPdf(bytes: Uint8Array) {
  return PDF_MAGIC.every((value, index) => bytes[index] === value);
}

export async function validateFormUpload(file: File, kind: 'photo' | 'file') {
  if (!file || file.size <= 0) return { ok: false as const, error: 'A file is required.' };
  if (kind === 'photo') return readAndValidateMemberPhoto(file);
  if (file.size > FORM_FILE_MAX_BYTES) return { ok: false as const, error: 'File must be 8 MB or smaller.' };

  const buffer = Buffer.from(await file.arrayBuffer());
  const bytes = new Uint8Array(buffer);
  if (isPdf(bytes)) {
    return { ok: true as const, buffer, mime: 'application/pdf' as const, ext: 'pdf' };
  }
  const imageMime = detectMemberPhotoMime(bytes, file.type);
  if (!imageMime) {
    return { ok: false as const, error: 'Upload a JPG, PNG, WebP, or PDF file.' };
  }
  if (buffer.length > MEMBER_PHOTO_MAX_BYTES) {
    return { ok: false as const, error: 'Images must be 5 MB or smaller.' };
  }
  const ext = imageMime === 'image/png' ? 'png' : imageMime === 'image/webp' ? 'webp' : 'jpg';
  return { ok: true as const, buffer, mime: imageMime, ext };
}

export function formUploadPath(gymId: string, formId: string, submissionId: string, fieldId: string, ext: string) {
  return `${gymId}/${formId}/${submissionId}/${fieldId}.${ext}`;
}
