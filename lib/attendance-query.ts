export const MAX_ATTENDANCE_PAGE_SIZE = 1000;
export const MAX_ATTENDANCE_OFFSET = 1_000_000;

export interface AttendancePagination {
  page: number;
  limit: number;
}

export function parseAttendancePagination(params: URLSearchParams): AttendancePagination | null {
  const pageValue = params.get('page');
  const limitValue = params.get('limit');
  const page = pageValue === null ? 1 : /^\d+$/.test(pageValue) ? Number(pageValue) : Number.NaN;
  const limit = limitValue === null
    ? MAX_ATTENDANCE_PAGE_SIZE
    : /^\d+$/.test(limitValue)
      ? Number(limitValue)
      : Number.NaN;
  const offset = (page - 1) * limit;

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > MAX_ATTENDANCE_PAGE_SIZE ||
    !Number.isSafeInteger(offset) ||
    offset > MAX_ATTENDANCE_OFFSET
  ) {
    return null;
  }

  return { page, limit };
}

export function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isValidDateTime(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return false;
  }
  if (!isValidDateOnly(value.slice(0, 10))) return false;

  return Number.isFinite(Date.parse(value));
}
