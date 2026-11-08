import type { ActivityDto, ApplicationDetailDto } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { application } from './AddApplicationFlow.helpers';
import { activityLines } from './activityLines';

const noteLine = (detail: string | null): ActivityDto => ({
  kind: 'note',
  actor: 'Lan',
  at: '2026-11-04T03:00:00.000Z',
  from: null,
  to: null,
  detail,
});

const titleOf = (detail: string | null) => {
  const app: ApplicationDetailDto = application({ activity: [noteLine(detail)] });
  return activityLines(app).find((l) => l.actor === 'Lan')?.title;
};

describe('Nhật ký hồ sơ: notes of the timeline', () => {
  it.each([
    ['add', 'Thêm ghi chú'],
    ['edit', 'Sửa ghi chú'],
    ['delete', 'Xoá ghi chú'],
    [null, 'Sửa ghi chú'],
  ])('should say what was done to a note (%s)', (detail, title) => {
    // Act + Assert
    expect(titleOf(detail)).toBe(title);
  });
});
