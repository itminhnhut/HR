import { describe, expect, it } from 'vitest';
import { addDays, deadlineEnd, effectiveStatus, endedOn, todayInVietnam, validateDeadline } from './job-status.js';

const at = (iso: string) => new Date(iso);
const published = (deadline: string) => ({ state: 'published' as const, deadline });

describe('deadlineEnd', () => {
  it('ends at 23:59:59.999 Vietnam time', () => {
    expect(deadlineEnd('2026-11-30').toISOString()).toBe('2026-11-30T16:59:59.999Z');
  });
});

describe('todayInVietnam', () => {
  it('rolls to the next day after 17:00 UTC', () => {
    expect(todayInVietnam(at('2026-11-30T16:59:00Z'))).toBe('2026-11-30');
    expect(todayInVietnam(at('2026-11-30T17:01:00Z'))).toBe('2026-12-01');
  });
});

describe('effectiveStatus', () => {
  it('passes non-published states through', () => {
    expect(effectiveStatus({ state: 'draft', deadline: '2020-01-01' })).toBe('draft');
    expect(effectiveStatus({ state: 'closed', deadline: '2099-01-01' })).toBe('closed');
  });

  it('is open more than 3 days before the deadline', () => {
    expect(effectiveStatus(published('2026-11-30'), at('2026-11-20T00:00:00+07:00'))).toBe('open');
  });

  it('is expiring within 3 days', () => {
    expect(effectiveStatus(published('2026-11-30'), at('2026-11-28T09:00:00+07:00'))).toBe('expiring');
  });

  it('is still expiring at 23:59 on the deadline day', () => {
    expect(effectiveStatus(published('2026-11-30'), at('2026-11-30T23:59:00+07:00'))).toBe('expiring');
  });

  it('expires right after midnight', () => {
    expect(effectiveStatus(published('2026-11-30'), at('2026-12-01T00:00:01+07:00'))).toBe('expired');
  });
});

describe('endedOn', () => {
  const now = at('2026-12-10T09:00:00+07:00');
  it('is the close day for a closed job and the deadline for an expired one', () => {
    expect(endedOn({ state: 'closed', deadline: '2026-12-30', closedOn: '2026-12-05' }, now)).toBe('2026-12-05');
    expect(endedOn({ state: 'published', deadline: '2026-11-30', closedOn: null }, now)).toBe('2026-11-30');
  });
  it('is null while the job still takes applications', () => {
    expect(endedOn({ state: 'published', deadline: '2026-12-30', closedOn: null }, now)).toBeNull();
    expect(endedOn({ state: 'draft', deadline: '2026-11-01', closedOn: null }, now)).toBeNull();
  });
});

describe('validateDeadline', () => {
  const now = at('2026-10-22T10:00:00+07:00');

  it('requires a date', () => {
    expect(validateDeadline(undefined, now)).toBe('missing');
    expect(validateDeadline('30/11/2026', now)).toBe('missing');
  });

  it('rejects past dates', () => {
    expect(validateDeadline('2026-10-21', now)).toBe('past');
  });

  it('allows today and up to 60 days', () => {
    expect(validateDeadline('2026-10-22', now)).toBeNull();
    expect(validateDeadline(addDays('2026-10-22', 60), now)).toBeNull();
  });

  it('rejects more than 60 days', () => {
    expect(validateDeadline(addDays('2026-10-22', 61), now)).toBe('too_far');
  });
});
