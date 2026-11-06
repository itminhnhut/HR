import type { AbsenceRowDto } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../api';
import { TooltipProvider } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { AbsenceTable } from './AbsenceTable';

const base = { reason: 'annual', note: '', handover: '', createdBy: 'Lan', employeeId: 'e1', employeeCode: 'A', fullName: 'Người A' };
const registered: AbsenceRowDto = { ...base, id: 'a1', source: 'absence', code: 'P', from: '2026-11-10', to: '2026-11-10', days: 1, label: 'Nghỉ phép năm', approvedBy: 'Giám đốc' };
const typed: AbsenceRowDto = { ...base, id: 'sheet-e1-2026-11-05', source: 'sheet', reason: 'sheet', code: 'P', from: '2026-11-05', to: '2026-11-09', days: 3, label: 'Nghỉ phép', approvedBy: null };

function open() {
  vi.spyOn(api, 'hrAllAbsences').mockResolvedValue([registered, typed]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><TooltipProvider><AbsenceTable editingId={null} isRemoving={false} removeError={null} onEdit={() => undefined} onRemove={() => undefined} /></TooltipProvider></MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the leave list', () => {
  it('should show leave typed into the sheet, marked as such, with a way to open the sheet instead of edit', async () => {
    // Act
    open();

    // Assert
    expect(await screen.findByText('Gõ trên bảng công')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Mở bảng công Người A 05\/11/ }).getAttribute('href')).toBe('/hr/cham-cong?ky=2026-11');
    expect(screen.queryByRole('button', { name: /Sửa Người A 05\/11/ })).toBeNull();
  });

  it('should not count leave typed into the sheet as waiting for approval', async () => {
    // Act
    open();

    // Assert
    await screen.findByText('Gõ trên bảng công');
    expect(screen.queryByText(/chờ duyệt/i)).toBeNull();
  });
});
