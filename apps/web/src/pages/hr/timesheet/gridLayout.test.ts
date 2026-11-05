import type { TimesheetRowDto } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { centeredScrollLeft, describeFailedCells, filterRows, fitGridHeight, pinnedColumns } from './gridLayout';
import type { GridRow } from './timesheetModel';

const row = (ten: string, ma: string, regionId: string, bp: string) => ({ id: ma, ten, ma, regionId, bp }) as unknown as GridRow;
const people = [row('Nguyễn Văn An', 'TF001', 'hcm', 'Kế toán'), row('Lê Văn Cường', 'TF003', 'hn', 'Kinh doanh')];

describe('frozen columns', () => {
  it('should keep every info column frozen on a wide screen', () => {
    expect(pinnedColumns(1280)).toEqual(['stt', 'ma', 'ten', 'bp', 'regionId']);
  });

  it('should freeze only code and name below 1280', () => {
    expect(pinnedColumns(1279)).toEqual(['ma', 'ten']);
    expect(pinnedColumns(768)).toEqual(['ma', 'ten']);
  });

  it('should freeze only the name on a phone, leaving room for the days', () => {
    expect(pinnedColumns(390)).toEqual(['ten']);
  });
});

describe('centering a column', () => {
  it('should leave the column fully clear of the frozen columns', () => {
    const left = centeredScrollLeft({ columnStart: 620, columnSize: 62, viewport: 984, pinnedWidth: 248 });
    const shownAt = 620 - left;
    expect(shownAt).toBeGreaterThanOrEqual(0);
    expect(shownAt + 62).toBeLessThanOrEqual(984 - 248);
  });

  it('should not scroll past the start for an early column', () => {
    expect(centeredScrollLeft({ columnStart: 0, columnSize: 62, viewport: 1398, pinnedWidth: 512 })).toBe(0);
  });
});

describe('grid height', () => {
  it('should stop at the bottom of the window when many people do not fit', () => {
    expect(fitGridHeight({ rowCount: 30, rowHeight: 36, top: 300, viewportHeight: 720 })).toBe(408);
  });

  it('should hug a short list', () => {
    expect(fitGridHeight({ rowCount: 2, rowHeight: 36, top: 300, viewportHeight: 1080 })).toBe(176);
  });

  it('should stay usable on a very short window', () => {
    expect(fitGridHeight({ rowCount: 30, rowHeight: 36, top: 500, viewportHeight: 600 })).toBe(320);
  });
});

describe('filtering people', () => {
  it('should find a name typed without Vietnamese marks', () => {
    expect(filterRows(people, { query: 'nguyen', regions: [], depts: [] }).map((r) => r.ma)).toEqual(['TF001']);
    expect(filterRows(people, { query: 'cuong', regions: [], depts: [] }).map((r) => r.ma)).toEqual(['TF003']);
  });

  it('should combine search, region and department', () => {
    expect(filterRows(people, { query: 'van', regions: ['hn'], depts: ['Kinh doanh'] }).map((r) => r.ma)).toEqual(['TF003']);
    expect(filterRows(people, { query: 'van', regions: ['hn'], depts: ['Kế toán'] })).toEqual([]);
  });
});

describe('describing a failed save', () => {
  const staff = [{ employeeId: 'e1', fullName: 'Lê Văn Cường' }] as unknown as TimesheetRowDto[];

  it('should name the person, the day and the code', () => {
    expect(describeFailedCells([{ employeeId: 'e1', day: '2026-11-04', code: 'KL' }], staff)).toBe('Lê Văn Cường 04/11 → KL');
  });

  it('should count the cells when several failed', () => {
    const cells = [{ employeeId: 'e1', day: '2026-11-04', code: 'P' as const }, { employeeId: 'e1', day: '2026-11-05', code: 'P' as const }];
    expect(describeFailedCells(cells, staff)).toBe('2 ô, từ Lê Văn Cường 04/11');
  });
});
