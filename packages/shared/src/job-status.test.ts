import { describe, expect, it } from 'vitest';
import {
  addDays,
  canSubmit,
  deadlineEnd,
  effectiveStatus,
  extendedDeadline,
  todayInVietnam,
  validateDeadline,
} from './job-status.js';

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
    expect(effectiveStatus({ state: 'paused', deadline: '2099-01-01' })).toBe('paused');
    expect(effectiveStatus({ state: 'filled', deadline: '2099-01-01' })).toBe('filled');
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

describe('canSubmit (grace period)', () => {
  const job = published('2026-11-30');

  it('accepts while open', () => {
    expect(canSubmit(job, at('2026-11-29T10:00:00+07:00'), at('2026-11-29T10:05:00+07:00'))).toBe(true);
  });

  it('accepts within 60 min if the form was opened before expiry', () => {
    expect(canSubmit(job, at('2026-11-30T23:50:00+07:00'), at('2026-12-01T00:30:00+07:00'))).toBe(true);
  });

  it('rejects after the grace period', () => {
    expect(canSubmit(job, at('2026-11-30T23:50:00+07:00'), at('2026-12-01T01:01:00+07:00'))).toBe(false);
  });

  it('rejects a form opened after expiry', () => {
    expect(canSubmit(job, at('2026-12-01T00:10:00+07:00'), at('2026-12-01T00:20:00+07:00'))).toBe(false);
  });

  it('rejects paused and filled jobs', () => {
    const now = at('2026-11-20T10:00:00+07:00');
    expect(canSubmit({ state: 'paused', deadline: '2026-11-30' }, now, now)).toBe(false);
    expect(canSubmit({ state: 'filled', deadline: '2026-11-30' }, now, now)).toBe(false);
  });
});

describe('extendedDeadline', () => {
  it('adds 14 days to a future deadline', () => {
    expect(extendedDeadline('2026-11-30', at('2026-11-28T10:00:00+07:00'))).toBe('2026-12-14');
  });

  it('adds 14 days from today when already expired', () => {
    expect(extendedDeadline('2026-10-01', at('2026-10-22T10:00:00+07:00'))).toBe('2026-11-05');
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
