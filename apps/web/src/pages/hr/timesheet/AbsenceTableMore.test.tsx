import { todayInVietnam, type AbsenceRowDto, type EmployeeDto } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../api';
import { TooltipProvider } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { AbsenceTable } from './AbsenceTable';

const exported = vi.hoisted(() => ({ calls: [] as { rows: readonly AbsenceRowDto[]; year: number; period: number | null }[] }));
vi.mock('./exportLeave', async (original) => ({
  ...(await original<typeof import('./exportLeave')>()),
  exportLeaveList: async (rows: readonly AbsenceRowDto[], _departmentOf: unknown, year: number, period: number | null) => { exported.calls.push({ rows, year, period }); },
}));

const personOf = (id: string, fullName: string, department: string) => ({ id, code: id.toUpperCase(), fullName, department, title: '', regionId: 'r1', employment: 'official', staffKindId: null, joinedOn: null, officialOn: null, leftOn: null, openingLeave: 0 }) as EmployeeDto;
const rowOf = (id: string, employeeId: string, fullName: string, from: string, over: Partial<AbsenceRowDto> = {}): AbsenceRowDto => ({
  id, source: 'absence', reason: 'annual', code: 'P', from, to: from, days: 1, note: '', label: 'Nghỉ phép năm', approvedBy: 'HR', handover: '', createdBy: 'Lan',
  files: [], needsPaper: false, employeeId, employeeCode: employeeId.toUpperCase(), fullName, ...over,
});

function open(rows: AbsenceRowDto[]) {
  vi.spyOn(api, 'hrAllAbsences').mockResolvedValue(rows);
  vi.spyOn(api, 'hrEmployees').mockResolvedValue([personOf('a', 'Người A', 'Sales Engineering'), personOf('b', 'Người B', 'Sales Engineering'), personOf('c', 'Người C', 'Kế toán')]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter><TooltipProvider><AbsenceTable editingId={null} isRemoving={false} removeError={null} onEdit={() => undefined} onRemove={() => undefined} onPapers={() => undefined} /></TooltipProvider></MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  exported.calls = [];
});

const today = todayInVietnam();

describe('the leave list, more', () => {
  it('should mark a day when two people of one department are away', async () => {
    // Act
    open([rowOf('1', 'a', 'Người A', today), rowOf('2', 'b', 'Người B', today), rowOf('3', 'c', 'Người C', today)]);

    // Assert
    const chip = await screen.findByText('Sales Engineering · 2');
    expect(chip.getAttribute('title')).toMatch(/Sales Engineering có 2 người nghỉ/);
    expect(screen.queryByText('Kế toán · 1')).toBeNull();
  });

  it('should download exactly the lines the filters show', async () => {
    // Arrange: one line today, one in another month
    open([rowOf('1', 'a', 'Người A', today), rowOf('2', 'b', 'Người B', `${today.slice(0, 4)}-01-02`)]);
    await screen.findByRole('button', { name: /^Sửa Người A/ });

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Tải Excel' }));

    // Assert
    await vi.waitFor(() => expect(exported.calls).toHaveLength(1));
    expect(exported.calls[0]?.rows.map((r) => r.id)).toEqual(['1']);
    expect(exported.calls[0]?.year).toBe(Number(today.slice(0, 4)));
  });

  it('should mark a line a company day off wrote, link to it, and leave its changes to that tab', async () => {
    // Act
    open([rowOf('1', 'a', 'Người A', today, { reason: 'other-paid', code: 'CL', label: 'Nghỉ có lương khác', batch: { id: 'b1', name: 'Tết thêm' } })]);

    // Assert
    const link = await screen.findByRole('link', { name: 'Đợt nghỉ công ty: Tết thêm' });
    expect(link.getAttribute('href')).toBe(`/hr/cham-cong/nghi-cong-ty?dot=b1&nam=${today.slice(0, 4)}`);
    const line = link.closest('tr');
    expect(line && within(line).queryByRole('button', { name: /^Sửa/ })).toBeNull();
    expect(line && within(line).queryByRole('button', { name: /^Huỷ/ })).toBeNull();
  });
});
