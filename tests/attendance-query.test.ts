import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_ATTENDANCE_OFFSET,
  isValidDateOnly,
  isValidDateTime,
  MAX_ATTENDANCE_PAGE_SIZE,
  parseAttendancePagination,
} from '../lib/attendance-query';

test('attendance pagination defaults to a bounded first page', () => {
  assert.deepEqual(parseAttendancePagination(new URLSearchParams()), {
    page: 1,
    limit: MAX_ATTENDANCE_PAGE_SIZE,
  });
});

test('attendance pagination accepts valid requested pages', () => {
  assert.deepEqual(
    parseAttendancePagination(new URLSearchParams('page=3&limit=20')),
    { page: 3, limit: 20 }
  );
});

test('attendance pagination rejects invalid and excessive values', () => {
  for (const query of [
    'page=0',
    'page=-1',
    'page=1.5',
    'page=0x10',
    'limit=0',
    'limit=1001',
    'page=1e100',
    `page=${MAX_ATTENDANCE_OFFSET + 2}&limit=1`,
  ]) {
    assert.equal(parseAttendancePagination(new URLSearchParams(query)), null, query);
  }
});

test('date validation accepts real calendar dates only', () => {
  assert.equal(isValidDateOnly('2026-10-17'), true);
  assert.equal(isValidDateOnly('2026-02-29'), false);
  assert.equal(isValidDateOnly('2026-13-01'), false);
  assert.equal(isValidDateOnly('17-10-2026'), false);
});

test('date-time validation requires a valid ISO date and explicit timezone', () => {
  assert.equal(isValidDateTime('2026-10-17T12:30:00Z'), true);
  assert.equal(isValidDateTime('2026-10-17T12:30:00+05:30'), true);
  assert.equal(isValidDateTime('2026-10-17T12:30:00'), false);
  assert.equal(isValidDateTime('2026-02-30T12:30:00Z'), false);
});
