import { todayInVietnam, type AbsenceKindDto, type AbsenceRowDto, type EmployeeDto, type TimesheetRegionDto } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../api';
import { TooltipProvider } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { leaveApi } from './leaveApi';
import { LeaveTab } from './LeaveTab';

/** The leave form: the balance while entering annual leave, and who of the same department is already away. */

const region: TimesheetRegionDto = { id: 'r1', name: 'HCM', saturdays: 2, tone: 'blue', employees: 2, hidden: false, saturdayChanges: [] };
const personOf = (id: string, fullName: string) => ({ id, code: id.toUpperCase(), fullName, department: 'Sales Engineering', title: '', regionId: 'r1', employment: 'official', staffKindId: null, joinedOn: null, officialOn: null, leftOn: null, openingLeave: 3 }) as EmployeeDto;
const annual: AbsenceKindDto = { key: 'annual', name: 'Nghỉ phép năm', code: 'P', days: null, isOwn: false, needsPaper: false };
const today = todayInVietnam();
const away: AbsenceRowDto = {
  id: 'x1', source: 'absence', reason: 'annual', code: 'P', from: today, to: today, days: 1, label: 'Nghỉ phép năm', note: '', handover: '', approvedBy: null, createdBy: 'Lan',
  files: [], needsPaper: false, employeeId: 'b', employeeCode: 'B', fullName: 'Người B',
};

function open(link: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[link]}><TooltipProvider><LeaveTab /></TooltipProvider></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.spyOn(api, 'hrEmployees').mockResolvedValue([personOf('a', 'Người A'), personOf('b', 'Người B')]);
  vi.spyOn(api, 'hrRegions').mockResolvedValue([region]);
  vi.spyOn(api, 'hrHolidays').mockResolvedValue([]);
  vi.spyOn(api, 'hrApprovers').mockResolvedValue([]);
  vi.spyOn(api, 'hrAbsenceKinds').mockResolvedValue([annual]);
  vi.spyOn(api, 'hrAllAbsences').mockResolvedValue([away]);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('entering leave for a person', () => {
  it('should show the balance once a person is picked, and keep Lưu open when it runs over', async () => {
    // Arrange
    vi.spyOn(leaveApi, 'balance').mockResolvedValue({ now: 0.5, after: -0.5, overdrawn: 1 });

    // Act
    open('/?nv=a');

    // Assert
    expect(await screen.findByText('Phép còn: 0,5 ngày (tính đến hôm nay)')).toBeTruthy();
    expect(screen.getByText('Vượt 1 ngày, phần vượt không lương')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lưu' }).hasAttribute('disabled')).toBe(false);
  });

  it('should name who of the same department is already away on the chosen day', async () => {
    // Arrange
    vi.spyOn(leaveApi, 'balance').mockResolvedValue({ now: 3, after: 2, overdrawn: 0 });

    // Act
    open('/?nv=a');

    // Assert
    const day = today.split('-').reverse().slice(0, 2).join('/');
    expect(await screen.findByText(`Ngày ${day}: Sales Engineering đã có 1 người nghỉ: Người B`)).toBeTruthy();
  });
});
