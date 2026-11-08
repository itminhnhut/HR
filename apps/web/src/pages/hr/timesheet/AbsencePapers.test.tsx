import type { AbsenceFileDto, AbsenceRowDto } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../api';
import { TooltipProvider } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { PapersDialog, type PaperTarget } from './AbsencePapers';
import { AbsenceTable } from './AbsenceTable';

/** The Giấy tờ dialog: seeing, adding and removing the papers of one absence (spec-giay-to-nghi.md). Cases TC-GT-50..56. */

const paper = (id: string, name: string, contentType: AbsenceFileDto['contentType'] = 'image/jpeg'): AbsenceFileDto => ({ id, name, contentType, size: 800_000, createdBy: 'Lan', createdAt: '2026-11-06T03:00:00.000Z' });
const base: AbsenceRowDto = {
  id: 'a1', source: 'absence', reason: 'sick', code: 'OM', from: '2026-11-03', to: '2026-11-04', days: 2, label: 'Ốm có giấy BHXH', note: '', handover: '', approvedBy: 'Giám đốc', createdBy: 'Lan',
  files: [], needsPaper: true, employeeId: 'e1', employeeCode: 'NV01', fullName: 'Người B',
};
const three = [paper('f1', 'trang-1.jpg'), paper('f2', 'trang-2.jpg'), paper('f3', 'don-thuoc.jpg')];
const photo = (name: string) => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2])], name, { type: 'image/jpeg' });

/** The table and the dialog as the Nghỉ tab puts them together. */
function Tab() {
  const [target, setTarget] = useState<PaperTarget | null>(null);
  return (
    <>
      <AbsenceTable editingId={null} isRemoving={false} removeError={null} onEdit={() => undefined} onRemove={() => undefined} onPapers={setTarget} />
      <PapersDialog target={target} onClose={() => setTarget(null)} />
    </>
  );
}

function show(row: AbsenceRowDto) {
  vi.spyOn(api, 'hrAllAbsences').mockResolvedValue([row]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter><TooltipProvider><Tab /></TooltipProvider></MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openPapers(row: AbsenceRowDto) {
  show(row);
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(`Giấy tờ \\(${row.files.length}\\) Người B`) }));
  return screen.findByRole('dialog', { name: /Giấy tờ: Người B/ });
}

async function openPhoto(row: AbsenceRowDto, name: string) {
  const dialog = await openPapers(row);
  await userEvent.click(within(dialog).getByRole('button', { name: `Xem ảnh ${name}` }));
  return screen.findByRole('dialog', { name: new RegExp(name) });
}

beforeEach(() => {
  vi.spyOn(api, 'hrAbsenceFileUrl').mockImplementation((id) => `/files/${id}`);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the papers of an absence', () => {
  it('TC-GT-50: should show photos as small pictures read from the file address, and a PDF as a tile that opens in a new tab', async () => {
    // Arrange
    const row = { ...base, files: [paper('f1', 'giay-om.jpg'), paper('f2', 'giay-ra-vien.pdf', 'application/pdf')] };

    // Act
    const dialog = await openPapers(row);

    // Assert
    expect(within(dialog).getByRole('img', { name: 'giay-om.jpg' }).getAttribute('src')).toBe('/files/f1');
    const pdf = within(dialog).getByRole('link', { name: 'Mở giay-ra-vien.pdf' });
    expect(pdf.getAttribute('href')).toBe('/files/f2');
    expect(pdf.getAttribute('target')).toBe('_blank');
  });

  it('TC-GT-51: should take "Thiếu giấy" off the line once a paper is sent, and count it on the button', async () => {
    // Arrange
    vi.spyOn(api, 'hrUploadAbsenceFile').mockImplementation(async (_id, _file, onProgress) => {
      onProgress?.(100);
      return [paper('f9', 'giay-om.jpg')];
    });
    const dialog = await openPapers(base);
    expect(screen.getByText('Thiếu giấy')).toBeTruthy();

    // Act
    await userEvent.upload(within(dialog).getByLabelText('Chọn file giấy tờ'), photo('giay-om.jpg'));

    // Assert
    await waitFor(() => expect(screen.queryByText('Thiếu giấy')).toBeNull());
    expect(api.hrUploadAbsenceFile).toHaveBeenCalledWith('a1', expect.any(File), expect.any(Function));
    expect(within(dialog).getByRole('img', { name: 'giay-om.jpg' })).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    expect(await screen.findByRole('button', { name: /Giấy tờ \(1\) Người B/ })).toBeTruthy();
  });

  it('TC-GT-52: should go to the next and previous photo with the buttons and the ← → keys', async () => {
    // Arrange
    const viewer = await openPhoto({ ...base, files: three }, 'trang-1.jpg');

    // Act + Assert
    fireEvent.keyDown(viewer, { key: 'ArrowRight' });
    expect(await screen.findByRole('dialog', { name: /trang-2\.jpg \(2\/3\)/ })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Ảnh sau' }));
    expect(await screen.findByRole('dialog', { name: /don-thuoc\.jpg \(3\/3\)/ })).toBeTruthy();

    fireEvent.keyDown(screen.getByRole('dialog', { name: /don-thuoc/ }), { key: 'ArrowLeft' });
    await userEvent.click(await screen.findByRole('button', { name: 'Ảnh trước' }));
    expect(await screen.findByRole('dialog', { name: /trang-1\.jpg \(1\/3\)/ })).toBeTruthy();
  });

  it('TC-GT-53: should turn the photo a quarter at a time and make it bigger, and offer it to download', async () => {
    // Arrange
    const viewer = await openPhoto({ ...base, files: three }, 'trang-1.jpg');
    const big = () => within(viewer).getByRole('img', { name: 'trang-1.jpg' });

    // Act
    await userEvent.click(within(viewer).getByRole('button', { name: 'Xoay' }));
    await userEvent.click(within(viewer).getByRole('button', { name: 'Phóng to' }));

    // Assert
    expect(big().style.transform).toBe('rotate(90deg)');
    expect(big().style.width).toBe('150%');
    const download = within(viewer).getByRole('link', { name: 'Tải về' });
    expect(download.getAttribute('href')).toBe('/files/f1');
    expect(download.getAttribute('download')).toBe('trang-1.jpg');
  });

  it('TC-GT-54: should delete a photo only after HR confirms, and mark the line "Thiếu giấy" again when none is left', async () => {
    // Arrange
    vi.spyOn(api, 'hrRemoveAbsenceFile').mockResolvedValue([]);
    const viewer = await openPhoto({ ...base, files: [paper('f1', 'giay-om.jpg')] }, 'giay-om.jpg');
    await userEvent.click(within(viewer).getByRole('button', { name: 'Xoá' }));
    expect(api.hrRemoveAbsenceFile).not.toHaveBeenCalled();

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Xoá file' }));

    // Assert
    await waitFor(() => expect(api.hrRemoveAbsenceFile).toHaveBeenCalledWith('f1'));
    expect(await screen.findByText('Thiếu giấy')).toBeTruthy();
    expect(await screen.findByText(/Chưa có giấy tờ\./)).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    expect(await screen.findByRole('button', { name: /Giấy tờ \(0\) Người B/ })).toBeTruthy();
  });

  it('TC-GT-55: should delete a PDF from its tile after HR confirms', async () => {
    // Arrange
    vi.spyOn(api, 'hrRemoveAbsenceFile').mockResolvedValue([]);
    const dialog = await openPapers({ ...base, files: [paper('f2', 'giay-ra-vien.pdf', 'application/pdf')] });

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xoá giay-ra-vien.pdf' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Xoá file' }));

    // Assert
    await waitFor(() => expect(api.hrRemoveAbsenceFile).toHaveBeenCalledWith('f2'));
    expect(await screen.findByText(/Chưa có giấy tờ\./)).toBeTruthy();
  });

  it('TC-GT-56: should keep no "Giấy tờ" button on leave typed into the sheet', async () => {
    // Act
    show({ ...base, id: 'sheet-e1-2026-11-03', source: 'sheet' });

    // Assert
    await within(await screen.findByRole('table')).findByText('Người B');
    expect(screen.queryByRole('button', { name: /Giấy tờ/ })).toBeNull();
  });
});
