import { periodMonthOf, todayInVietnam, type AbsenceRowDto } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../api';
import { TooltipProvider } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { AbsenceTable } from './AbsenceTable';

const base = { reason: 'annual', note: '', handover: '', createdBy: 'Lan', files: [], needsPaper: false, employeeId: 'e1', employeeCode: 'A', fullName: 'Người A' };
const registered: AbsenceRowDto = { ...base, id: 'a1', source: 'absence', code: 'P', from: '2026-11-10', to: '2026-11-10', days: 1, label: 'Nghỉ phép năm', approvedBy: 'Giám đốc' };
const typed: AbsenceRowDto = { ...base, id: 'sheet-e1-2026-11-05', source: 'sheet', reason: 'sheet', code: 'P', from: '2026-11-05', to: '2026-11-09', days: 3, label: 'Nghỉ phép', approvedBy: null };

function open(rows: AbsenceRowDto[] = [registered, typed]) {
  vi.spyOn(api, 'hrAllAbsences').mockResolvedValue(rows);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><TooltipProvider><AbsenceTable editingId={null} isRemoving={false} removeError={null} onEdit={() => undefined} onRemove={() => undefined} onPapers={() => undefined} /></TooltipProvider></MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the leave list', () => {
  it('TC-NG-07: should let HR edit and remove leave typed into the sheet, as any line', async () => {
    // Act
    open();

    // Assert
    expect(await screen.findByRole('button', { name: 'Sửa Người A 05/11' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Xoá Người A 05/11' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Mở bảng công ngày 05/11' }).getAttribute('href')).toBe('/hr/cham-cong?ky=2026-11&ngay=2026-11-05&nv=e1');
    expect(screen.queryByText('Gõ trên bảng công')).toBeNull();
  });

  it('should not count leave typed into the sheet as waiting for approval', async () => {
    // Act
    open();

    // Assert
    await screen.findByRole('button', { name: 'Xoá Người A 05/11' });
    expect(screen.queryByRole('button', { name: /chờ duyệt/i })).toBeNull();
  });
});

describe('absences on the same days, together', () => {
  const on = (id: string, fullName: string, from: string, to = from): AbsenceRowDto => ({ ...registered, id, employeeId: `e-${id}`, fullName, from, to });

  it('TC-NG-01: should put the people away on the same days under one line that says how many', async () => {
    // Act: two away on Tuesday 10/11, one on 09/11–11/11
    open([on('a1', 'Người A', '2026-11-10'), on('a2', 'Người B', '2026-11-10'), on('a3', 'Người C', '2026-11-09', '2026-11-11')]);

    // Assert
    const groups = await screen.findAllByRole('rowgroup', { name: /người nghỉ/ });
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['10/11: 2 người nghỉ', '09/11 – 11/11: 1 người nghỉ']);
    const lines = within(groups[0] as HTMLElement).getAllByRole('row').map((r) => r.textContent);
    expect(lines).toEqual([expect.stringMatching(/Người A.*10\/11.*2 người/), expect.stringContaining('Người B')]);
    expect(screen.getAllByRole('link', { name: 'Mở bảng công ngày 10/11' })).toHaveLength(1);
  });

  it('TC-NG-02: should open the sheet on that day from the line', async () => {
    // Act
    open([on('a1', 'Người A', '2026-11-10'), on('a2', 'Người B', '2026-11-10')]);

    // Assert
    const link = await screen.findByRole('link', { name: 'Mở bảng công ngày 10/11' });
    expect(link.getAttribute('href')).toBe('/hr/cham-cong?ky=2026-11&ngay=2026-11-10&nv=e-a1');
  });
});

describe('who approved, in one column (TC-NG-04)', () => {
  it('should say in "Người duyệt" who approved, what waits, and leave out a "Trạng thái" column', async () => {
    // Arrange
    const waitingOne: AbsenceRowDto = { ...registered, id: 'a2', fullName: 'Người B', approvedBy: null };
    const late: AbsenceRowDto = { ...registered, id: 'a3', fullName: 'Người C', code: 'M', approvedBy: null, from: '2026-11-12', to: '2026-11-12' };

    // Act
    open([registered, waitingOne, late, typed]);
    const header = (await screen.findAllByRole('columnheader')).map((h) => h.textContent);
    const cellOf = (name: string) => screen.getByText(name).closest('tr')?.textContent ?? '';

    // Assert
    expect(header).not.toContain('Trạng thái');
    expect(cellOf('Người B')).toContain('Chờ duyệt');
    expect(cellOf('Người C')).toContain('Không cần duyệt');
    expect(screen.getAllByText('Giám đốc').length).toBeGreaterThan(0);
  });
});

describe('a line opens its sheet (TC-NG-05)', () => {
  it('should open the sheet on that person and day when HR presses anywhere on the line', async () => {
    // Arrange
    vi.spyOn(api, 'hrAllAbsences').mockResolvedValue([registered]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const Where = () => <p>{useLocation().pathname + useLocation().search}</p>;
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/hr/cham-cong/nghi']}>
          <TooltipProvider>
            <Routes>
              <Route path="/hr/cham-cong/nghi" element={<AbsenceTable editingId={null} isRemoving={false} removeError={null} onEdit={() => undefined} onRemove={() => undefined} onPapers={() => undefined} />} />
              <Route path="/hr/cham-cong" element={<Where />} />
            </Routes>
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Act
    await userEvent.click(await screen.findByText('Nghỉ phép năm'));

    // Assert
    expect(await screen.findByText('/hr/cham-cong?ky=2026-11&ngay=2026-11-10&nv=e1')).toBeTruthy();
  });

  it('should still edit, not open the sheet, on "Sửa"', async () => {
    // Arrange
    const onEdit = vi.fn();
    vi.spyOn(api, 'hrAllAbsences').mockResolvedValue([registered]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><TooltipProvider><AbsenceTable editingId={null} isRemoving={false} removeError={null} onEdit={onEdit} onRemove={() => undefined} onPapers={() => undefined} /></TooltipProvider></MemoryRouter></QueryClientProvider>);

    // Act
    await userEvent.click(await screen.findByRole('button', { name: /^Sửa Người A/ }));

    // Assert
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

describe('the filter bar (TC-NG-17)', () => {
  it('should narrow the list by period, person and approval, say how many show, and clear', async () => {
    // Arrange
    const novB: AbsenceRowDto = { ...registered, id: 'b1', employeeId: 'e2', fullName: 'Người B', from: '2026-11-03', to: '2026-11-03', approvedBy: null };
    const dec: AbsenceRowDto = { ...registered, id: 'c1', from: '2026-12-01', to: '2026-12-01' };
    open([registered, novB, dec]);
    const names = () => within(screen.getByRole('table')).queryAllByRole('row').map((r) => r.textContent ?? '').filter((t) => /Người [A-Z]/.test(t));
    await screen.findByRole('table');

    // Act: the list opens on the period running today
    const opened = (screen.getByLabelText('Kỳ công') as HTMLSelectElement).value;
    await userEvent.selectOptions(screen.getByLabelText('Kỳ công'), '11');
    await userEvent.selectOptions(screen.getByLabelText('Duyệt'), 'waiting');
    const narrowed = names();
    await userEvent.click(screen.getByRole('button', { name: /Xoá lọc/ }));
    const back = (screen.getByLabelText('Kỳ công') as HTMLSelectElement).value;
    await userEvent.selectOptions(screen.getByLabelText('Kỳ công'), '');

    // Assert
    expect(opened).toBe(String(periodMonthOf(todayInVietnam()).month));
    expect(narrowed).toEqual([expect.stringContaining('Người B')]);
    expect(back).toBe(opened);
    expect(names()).toHaveLength(3);
  });

  it('TC-GT-13: should mark an absence that asks for papers and has none, and only that one', async () => {
    // Arrange
    const file = { id: 'f1', name: 'giay-om.jpg', contentType: 'image/jpeg' as const, size: 800_000, createdBy: 'Lan', createdAt: '2026-11-06T03:00:00.000Z' };
    const missing: AbsenceRowDto = { ...registered, id: 'a2', reason: 'sick', code: 'OM', label: 'Ốm có giấy BHXH', fullName: 'Người B', needsPaper: true };
    const kept: AbsenceRowDto = { ...missing, id: 'a3', fullName: 'Người C', files: [file] };

    // Act
    open([missing, kept, { ...typed, needsPaper: true }]);

    // Assert
    expect(await screen.findAllByText('Thiếu giấy')).toHaveLength(1);
    expect(screen.getByText('Thiếu giấy').closest('tr')?.textContent).toContain('Người B');
  });
});
