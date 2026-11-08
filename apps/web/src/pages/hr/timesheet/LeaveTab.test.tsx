import { todayInVietnam, type AbsenceKindDto, type AbsenceRowDto, type EmployeeDto, type TimesheetRegionDto } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../api';
import { TooltipProvider } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { papersLink, paperTargetOf } from './AbsencePapers';
import { LeaveTab } from './LeaveTab';

/** Where the Giấy tờ dialog opens from on the Nghỉ tab (spec-giay-to-nghi.md). Cases TC-GT-57..60. */

const region: TimesheetRegionDto = { id: 'r1', name: 'HCM', saturdays: 2, tone: 'blue', employees: 1, hidden: false, saturdayChanges: [] };
const person = { id: 'e1', code: 'NV01', fullName: 'Người B', department: 'Sales', title: '', regionId: 'r1', employment: 'official', staffKindId: null, joinedOn: null, officialOn: null, leftOn: null, openingLeave: 0 } as EmployeeDto;
const sickKind: AbsenceKindDto = { key: 'sick', name: 'Ốm có giấy BHXH', code: 'OM', days: null, isOwn: false, needsPaper: true };
const today = todayInVietnam();
const saved: AbsenceRowDto = {
  id: 'a9', source: 'absence', reason: 'sick', code: 'OM', from: today, to: today, days: 1, label: 'Ốm có giấy BHXH', note: '', handover: '', approvedBy: null, createdBy: 'Lan',
  files: [], needsPaper: true, employeeId: 'e1', employeeCode: 'NV01', fullName: 'Người B',
};
const earlier = { ...saved, id: 'a1', from: '2026-01-05', to: '2026-01-05', needsPaper: false };

function open(link: string, kinds: AbsenceKindDto[] = [sickKind]) {
  vi.spyOn(api, 'hrAbsenceKinds').mockResolvedValue(kinds);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[link]}><TooltipProvider><LeaveTab /></TooltipProvider></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.spyOn(api, 'hrEmployees').mockResolvedValue([person]);
  vi.spyOn(api, 'hrRegions').mockResolvedValue([region]);
  vi.spyOn(api, 'hrHolidays').mockResolvedValue([]);
  vi.spyOn(api, 'hrApprovers').mockResolvedValue([]);
  vi.spyOn(api, 'hrAllAbsences').mockResolvedValue([saved]);
  vi.spyOn(api, 'hrAbsenceFileUrl').mockImplementation((id) => `/files/${id}`);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('opening the papers of an absence', () => {
  it('TC-GT-57: should open Giấy tờ for a new absence whose reason needs papers, right after it is saved', async () => {
    // Arrange
    vi.spyOn(api, 'hrRegisterAbsence').mockResolvedValue([saved, earlier]);
    open('/?nv=e1');

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Lưu' }));

    // Assert
    expect(await screen.findByRole('dialog', { name: /Giấy tờ: Người B, Ốm có giấy BHXH/ })).toBeTruthy();
    expect(screen.getByLabelText('Chọn file giấy tờ')).toBeTruthy();
  });

  it('TC-GT-58: should not open Giấy tờ after saving an absence whose reason needs none', async () => {
    // Arrange
    const annual: AbsenceKindDto = { key: 'annual', name: 'Nghỉ phép năm', code: 'P', days: null, isOwn: false, needsPaper: false };
    vi.spyOn(api, 'hrRegisterAbsence').mockResolvedValue([{ ...saved, reason: 'annual', code: 'P', label: 'Nghỉ phép năm', needsPaper: false }]);
    open('/?nv=e1', [annual]);

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Lưu' }));

    // Assert
    await vi.waitFor(() => expect(api.hrRegisterAbsence).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('TC-GT-59: should open Giấy tờ from the edit form', async () => {
    // Arrange
    open('/');
    await userEvent.click(await screen.findByRole('button', { name: /^Sửa Người B/ }));

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Giấy tờ (0)' }));

    // Assert
    expect(await screen.findByRole('dialog', { name: /Giấy tờ: Người B/ })).toBeTruthy();
  });

  it('TC-GT-60: should open Giấy tờ of the absence a link from Rà soát points to', async () => {
    // Act
    open(papersLink(paperTargetOf(saved)));

    // Assert
    expect(await screen.findByRole('dialog', { name: /Giấy tờ: Người B, Ốm có giấy BHXH/ })).toBeTruthy();
  });
});
