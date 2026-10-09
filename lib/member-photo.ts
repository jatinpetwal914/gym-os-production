export const MEMBER_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const MEMBER_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type MemberPhotoMime = (typeof MEMBER_PHOTO_MIME_TYPES)[number];

function extensionForMime(mime: MemberPhotoMime) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

export function memberPhotoStoragePath(gymId: string, memberUuid: string, mime: MemberPhotoMime) {
  return `${gymId}/${memberUuid}/profile.${extensionForMime(mime)}`;
}

export function detectMemberPhotoMime(bytes: Uint8Array, fallback?: string | null): MemberPhotoMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  if (fallback && MEMBER_PHOTO_MIME_TYPES.includes(fallback as MemberPhotoMime)) {
    return fallback as MemberPhotoMime;
  }
  return null;
}

export async function readAndValidateMemberPhoto(file: File) {
  if (!file || file.size <= 0) {
    return { ok: false as const, error: 'Photograph is required.' };
  }
  if (file.size > MEMBER_PHOTO_MAX_BYTES) {
    return { ok: false as const, error: 'Photograph must be 5 MB or smaller.' };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = detectMemberPhotoMime(buffer, file.type);
  if (!mime) {
    return { ok: false as const, error: 'Photograph must be a JPG, PNG, or WebP image.' };
  }

  return { ok: true as const, buffer, mime };
}
