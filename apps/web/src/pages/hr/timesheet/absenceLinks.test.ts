import { describe, expect, it } from 'vitest';
import { filtersFromLink, leaveListLink, NO_FILTERS, sheetLink } from './absenceFilters';

/** Links into the leave list and the sheet, from the leave calendar and the yearly report. */

const read = (link: string) => filtersFromLink(new URL(link, 'http://x').searchParams, '2026-11-09');

describe('links into the leave list', () => {
  it('should open the leave list on one day, in that day’s year', () => {
    // Act
    const opened = read(leaveListLink({ day: '2025-12-30' }));

    // Assert
    expect(leaveListLink({ day: '2025-12-30' })).toBe('/hr/cham-cong/nghi?ngay=2025-12-30');
    expect(opened).toEqual({ year: 2025, filters: { ...NO_FILTERS, day: '2025-12-30' } });
  });

  it('should open the leave list on one person’s year, and one kind of leave when asked', () => {
    // Act
    const all = read(leaveListLink({ employeeId: 'e1', year: 2026 }));
    const unpaid = read(leaveListLink({ employeeId: 'e1', year: 2026, kind: 'KL' }));

    // Assert
    expect(leaveListLink({ employeeId: 'e1', year: 2026, kind: 'KL' })).toBe('/hr/cham-cong/nghi?nguoi=e1&nam=2026&loai=KL');
    expect(all).toEqual({ year: 2026, filters: { ...NO_FILTERS, employeeId: 'e1' } });
    expect(unpaid).toEqual({ year: 2026, filters: { ...NO_FILTERS, employeeId: 'e1', kind: 'KL' } });
  });

  it('should open as usual on a plain link or one that makes no sense', () => {
    // Act
    const answers = [read('/hr/cham-cong/nghi'), read('/hr/cham-cong/nghi?ngay=hom-nay'), read('/hr/cham-cong/nghi?nguoi=e1&nam=abc&loai=XX')];

    // Assert
    expect(answers).toEqual([null, null, { year: 2026, filters: { ...NO_FILTERS, employeeId: 'e1' } }]);
  });

  it('should open the sheet of the period a day is in, on that person’s cell', () => {
    // Act
    const links = [sheetLink('2026-11-26', 'e1'), sheetLink('2026-11-25')];

    // Assert
    expect(links).toEqual(['/hr/cham-cong?ky=2026-12&ngay=2026-11-26&nv=e1', '/hr/cham-cong?ky=2026-11&ngay=2026-11-25']);
  });
});
