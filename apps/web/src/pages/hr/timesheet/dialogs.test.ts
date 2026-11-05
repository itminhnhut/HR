import { describe, expect, it } from 'vitest';
import { shortProblem } from './dialogs';
import type { TimesheetProblem } from './timesheetModel';

const problem = (kind: TimesheetProblem['kind'], text: string): TimesheetProblem => ({ id: 'x', group: 'Cần xử lý', kind, employeeId: 'e', columnId: 'd1', text });

describe('a problem line in the review', () => {
  it('should keep who and how many Saturdays, the group title says the rest', () => {
    expect(shortProblem(problem('saturday', 'An: 0/2 thứ Bảy, không còn đủ ngày để đạt định mức'))).toBe('An: 0/2 thứ Bảy');
  });

  it('should keep how much leave went over', () => {
    expect(shortProblem(problem('leave', 'An: nghỉ 3 ngày phép, vượt 1 ngày, phần vượt không được trả lương'))).toBe('An: nghỉ 3 ngày phép, vượt 1 ngày');
  });

  it('should keep the leaving day and the days left', () => {
    expect(shortProblem(problem('left', 'An: nghỉ việc 12/11, còn 0,5 ngày phép cần thanh toán'))).toBe('An: nghỉ việc 12/11, còn 0,5 ngày phép');
  });

  it('should keep an adjustment whole because the reason matters', () => {
    expect(shortProblem(problem('adjustment', 'An: điều chỉnh -0,5 công (Đi muộn)'))).toBe('An: điều chỉnh -0,5 công (Đi muộn)');
  });
});
