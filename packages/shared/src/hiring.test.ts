import { describe, expect, it } from 'vitest';
import { isInvited, statusChangeProblem } from './hiring.js';

const NOW = new Date('2026-11-04T03:00:00.000Z');
const PAST = '2026-11-03T02:00:00.000Z';
const FUTURE = '2026-11-20T02:00:00.000Z';

type Status = Parameters<typeof isInvited>[0];

const STATES: [string, Status, string | null][] = [
  ['Mới', 'new', null],
  ['Đã xem', 'seen', null],
  ['Chờ xếp lịch', 'scheduling', null],
  ['Hẹn, chưa có giờ', 'interview', null],
  ['Hẹn, sắp tới', 'interview', FUTURE],
  ['Chờ kết quả', 'interview', PAST],
  ['Đạt', 'passed', PAST],
  ['Nhận việc', 'hired', PAST],
  ['Loại trước phỏng vấn', 'rejected', null],
  ['Loại sau phỏng vấn', 'rejected', PAST],
];

/**
 * ✓ allowed, · refused. Columns: Mới, Đã xem, Chờ xếp lịch, Hẹn, Đạt, Nhận việc, Chưa phù hợp. The same status is no change.
 * "Chờ xếp lịch" (TC-XL-01..03): called, no time agreed yet; reached from anything without a result.
 */
const FLOW: Record<string, string> = {
  Mới: '✓✓✓✓··✓',
  'Đã xem': '✓✓✓✓··✓',
  'Chờ xếp lịch': '·✓✓✓··✓',
  'Hẹn, chưa có giờ': '·✓✓✓··✓',
  'Hẹn, sắp tới': '·✓✓✓··✓',
  'Chờ kết quả': '·✓✓✓✓·✓',
  Đạt: '···✓✓✓✓',
  'Nhận việc': '····✓✓✓',
  'Loại trước phỏng vấn': '·✓✓✓··✓',
  'Loại sau phỏng vấn': '·✓✓✓✓·✓',
};

const TARGETS: Status[] = ['new', 'seen', 'scheduling', 'interview', 'passed', 'hired', 'rejected'];

describe('the flow of an application', () => {
  describe.each(STATES)('from %s', (name, status, interviewAt) => {
    it.each(TARGETS.map((to, i) => [to, FLOW[name]?.[i]] as const))('to %s: %s', (to, mark) => {
      const problem = statusChangeProblem({ status, interviewAt }, to, NOW);

      expect(problem === null ? '✓' : '·').toBe(mark);
    });
  });

  it('should say why a result cannot be written before the interview', () => {
    expect(statusChangeProblem({ status: 'interview', interviewAt: FUTURE }, 'passed', NOW)).toMatch(/Chưa tới giờ/);
    expect(statusChangeProblem({ status: 'interview', interviewAt: null }, 'passed', NOW)).toMatch(/Chọn giờ/);
  });
});

describe('isInvited', () => {
  it.each([
    ['new', false],
    ['seen', false],
    ['scheduling', false],
    ['interview', true],
    ['passed', true],
    ['hired', true],
    ['rejected', false],
  ] as const)('%s: %s', (status, expected) => {
    expect(isInvited(status)).toBe(expected);
  });
});

describe('waiting to schedule', () => {
  it('TC-XL-07: should say why a result cannot be written while no time is agreed', () => {
    expect(statusChangeProblem({ status: 'scheduling', interviewAt: null }, 'passed', NOW)).toMatch(/Chọn giờ/);
    expect(statusChangeProblem({ status: 'passed', interviewAt: PAST }, 'scheduling', NOW)).toMatch(/đã có kết quả/);
  });
});
