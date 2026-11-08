import type { AbsenceRowDto } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { sheetLineForm } from './sheetLineForm';

/** "Sửa" on a line typed on the sheet starts the form from it (TC-NG-06). */
const line = (code: string, over: Partial<AbsenceRowDto> = {}): AbsenceRowDto => ({
  id: 'sheet-e1-2026-11-05', source: 'sheet', reason: 'sheet', code, from: '2026-11-05', to: '2026-11-06', days: 2, note: 'Nhà có việc', label: '',
  approvedBy: 'HR', handover: '', createdBy: 'Lan', files: [], needsPaper: false, employeeId: 'e1', employeeCode: 'A', fullName: 'Người A', ...over,
});

describe('a typed line as a form', () => {
  it.each([
    ['P', 'annual', 'P', false],
    ['P/2', 'annual', 'P', true],
    ['KL', 'unpaid', 'KL', false],
    ['KL/2', 'unpaid', 'KL', true],
    ['M', 'late', 'M', false],
    ['OM', 'sick', 'OM', false],
    ['TS', 'maternity', 'TS', false],
    ['CL', 'other-paid', 'CL', false],
  ])('should read %s as reason %s, counting %s', (code, reason, counting, isHalf) => {
    expect(sheetLineForm(line(code))).toMatchObject({ reason, code: counting, isHalf, approvedBy: 'HR', personId: 'e1', from: '2026-11-05', to: '2026-11-06', note: 'Nhà có việc', replaces: { code, from: '2026-11-05', to: '2026-11-06' } });
  });

  it('should not offer a form for leave taken without permission (KP), which no reason registers', () => {
    expect(sheetLineForm(line('KP'))).toBeNull();
  });
});
