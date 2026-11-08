import type { ActivityDto, ApplicationDetailDto } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { activityLines } from './activityLines';

const entry = (over: Partial<ActivityDto>): ActivityDto => ({
  kind: 'status',
  actor: 'Phòng Nhân sự',
  at: '2026-11-04T03:00:00.000Z',
  from: null,
  to: null,
  detail: null,
  ...over,
});

const app = (over: Partial<ApplicationDetailDto> = {}) =>
  ({
    activity: [],
    cvHistory: [],
    contacts: [],
    addedBy: null,
    fullName: 'An',
    createdAt: '2026-11-01T03:00:00.000Z',
    ...over,
  }) as unknown as ApplicationDetailDto;

describe('activityLines', () => {
  it('should say a status change in words, with its reason', () => {
    // Act
    const [line] = activityLines(app({ activity: [entry({ from: 'interview', to: 'rejected', detail: 'salary' })] }));

    // Assert
    expect(line).toMatchObject({
      title: 'Đổi trạng thái',
      change: 'Hẹn phỏng vấn → Chưa phù hợp',
      note: 'Lý do: Lương không khớp',
      actor: 'Phòng Nhân sự',
    });
  });

  it('should tell an undo from a change', () => {
    const [line] = activityLines(app({ activity: [entry({ from: 'passed', to: 'interview', detail: 'undo' })] }));

    expect(line).toMatchObject({ title: 'Hoàn tác trạng thái', change: 'Đạt → Hẹn phỏng vấn', note: null });
  });

  it('should put how it came in last and everything else by time, newest first', () => {
    // Act
    const lines = activityLines(
      app({
        activity: [entry({ kind: 'note', at: '2026-11-03T03:00:00.000Z' })],
        contacts: [{ templateKey: 'call', channel: 'copy', hrName: 'Mai', createdAt: '2026-11-04T03:00:00.000Z' }],
        cvHistory: [{ by: 'Ứng viên', at: '2026-11-02T03:00:00.000Z', previous: 'cu.pdf' }],
      }),
    );

    // Assert
    expect(lines.map((line) => line.title)).toEqual(['Soạn thư', 'Sửa ghi chú', 'Đổi CV', 'Ứng viên nộp hồ sơ']);
  });

  it('should name the HR who added it', () => {
    expect(activityLines(app({ addedBy: 'Mai' }))[0]).toMatchObject({ title: 'HR thêm hồ sơ', actor: 'Mai' });
  });

  it('should name the field changed in contact details', () => {
    const [line] = activityLines(
      app({ activity: [entry({ kind: 'contact', detail: 'phone', from: '0912', to: '0913' })] }),
    );

    expect(line).toMatchObject({ title: 'Sửa số điện thoại', change: '0912 → 0913' });
  });

  it('TC-SH-12: should name a fixed name and gender, in words', () => {
    // Act
    const lines = activityLines(
      app({
        activity: [
          entry({ kind: 'contact', detail: 'fullName', from: 'Nguyen Van An', to: 'Nguyễn Văn An' }),
          entry({ kind: 'contact', detail: 'gender', from: null, to: 'female' }),
        ],
      }),
    );

    // Assert
    expect(lines.map((l) => [l.title, l.change])).toEqual(
      expect.arrayContaining([
        ['Sửa họ tên', 'Nguyen Van An → Nguyễn Văn An'],
        ['Sửa giới tính', 'Theo CV → Nữ'],
      ]),
    );
  });

  it('should say only the site of an old CV link, whose address can be hundreds of characters', () => {
    // Arrange
    const previous = `https://www.ntd.vieclam24h.vn/chi-tiet?id=1&token=${'x'.repeat(400)}`;

    // Act
    const [line] = activityLines(app({ cvHistory: [{ by: 'Lan', at: '2026-11-02T03:00:00.000Z', previous }] })).filter(
      (l) => l.title === 'Đổi CV',
    );

    // Assert
    expect(line?.note).toBe('CV trước: link ntd.vieclam24h.vn');
  });
});
