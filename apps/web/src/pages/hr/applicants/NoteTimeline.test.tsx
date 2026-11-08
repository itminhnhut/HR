import type { ApplicationNoteDto } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { api } from '../../../api';
import { application } from './AddApplicationFlow.helpers';
import { NoteTimeline } from './NoteTimeline';

const note = (over: Partial<ApplicationNoteDto> = {}): ApplicationNoteDto => ({
  id: 'n1',
  body: 'T7 gọi chưa được',
  createdBy: 'Lan',
  createdAt: '2026-10-18T02:00:00.000Z',
  updatedAt: '2026-10-18T02:00:00.000Z',
  ...over,
});

function open(notes: ApplicationNoteDto[] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onError = vi.fn();
  const view = render(
    <QueryClientProvider client={client}>
      <NoteTimeline app={application({ notes })} onError={onError} />
    </QueryClientProvider>,
  );
  return { ...view, onError };
}

const box = () => screen.getByLabelText(/Ghi chú nội bộ/);
const entries = () => within(screen.getByRole('list', { name: 'Các ghi chú' })).queryAllByRole('listitem');

beforeAll(() => {
  // jsdom has no <dialog> methods.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Ghi chú nội bộ as a timeline', () => {
  it('should list the notes newest first, each with who wrote it and when', () => {
    // Arrange + Act
    open([note({ id: 'n2', body: 'T2 gọi chưa được', createdAt: '2026-10-20T03:00:00.000Z' }), note()]);

    // Assert
    expect(entries().map((li) => li.querySelector('p')?.textContent)).toEqual(['T2 gọi chưa được', 'T7 gọi chưa được']);
    expect(within(entries()[0] as HTMLElement).getByText(/Lan · 10:00 20\/10/)).toBeTruthy();
  });

  it('should mark a note someone edited', () => {
    // Arrange + Act
    open([note({ updatedAt: '2026-10-19T02:00:00.000Z' })]);

    // Assert
    expect(screen.getByText(/đã sửa/)).toBeTruthy();
  });

  it('should add the typed note on Enter and empty the box', async () => {
    // Arrange
    const add = vi
      .spyOn(api, 'hrAddNote')
      .mockResolvedValue(application({ notes: [note({ body: 'Ứng viên hẹn T3' })] }));
    open();

    // Act
    await userEvent.type(box(), 'Ứng viên hẹn T3{Enter}');

    // Assert
    await waitFor(() => expect(add).toHaveBeenCalledWith('a1', 'Ứng viên hẹn T3'));
    await waitFor(() => expect((box() as HTMLTextAreaElement).value).toBe(''));
  });

  it('should add the note with the Ghi button, and keep Shift+Enter as a new line', async () => {
    // Arrange
    const add = vi.spyOn(api, 'hrAddNote').mockResolvedValue(application());
    open();

    // Act
    await userEvent.type(box(), 'Dòng một{Shift>}{Enter}{/Shift}Dòng hai');
    await userEvent.click(screen.getByRole('button', { name: 'Ghi' }));

    // Assert
    expect(add).toHaveBeenCalledWith('a1', 'Dòng một\nDòng hai');
  });

  it('should not offer Ghi while the box is empty', () => {
    // Arrange + Act
    open();

    // Assert
    expect(screen.getByRole('button', { name: 'Ghi' }).hasAttribute('disabled')).toBe(true);
  });

  it('should edit a note in place and save it', async () => {
    // Arrange
    const edit = vi.spyOn(api, 'hrEditNote').mockResolvedValue(application({ notes: [note({ body: 'Hẹn gọi T4' })] }));
    open([note({ body: 'Hẹn gọi T3' })]);

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Sửa ghi chú' }));
    const field = screen.getByLabelText('Sửa ghi chú');
    await userEvent.clear(field);
    await userEvent.type(field, 'Hẹn gọi T4');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    // Assert
    expect(edit).toHaveBeenCalledWith('a1', 'n1', 'Hẹn gọi T4');
  });

  it('should leave the note as it was on Huỷ', async () => {
    // Arrange
    const edit = vi.spyOn(api, 'hrEditNote');
    open([note()]);

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Sửa ghi chú' }));
    await userEvent.type(screen.getByLabelText('Sửa ghi chú'), ' thêm');
    await userEvent.click(screen.getByRole('button', { name: 'Huỷ' }));

    // Assert
    expect(edit).not.toHaveBeenCalled();
    expect(screen.getByText('T7 gọi chưa được')).toBeTruthy();
  });

  it('should delete a note after asking once more', async () => {
    // Arrange
    const remove = vi.spyOn(api, 'hrDeleteNote').mockResolvedValue(application());
    open([note()]);

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Xoá ghi chú' }));
    expect(remove).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Xoá' }));

    // Assert
    await waitFor(() => expect(remove).toHaveBeenCalledWith('a1', 'n1'));
  });

  it('should save a note still in the box when the application closes', async () => {
    // Arrange
    const patch = vi.spyOn(api, 'hrUpdateApplication').mockResolvedValue(application());
    const { unmount } = open();
    await userEvent.type(box(), 'Đã gọi');

    // Act
    unmount();

    // Assert
    await waitFor(() => expect(patch).toHaveBeenCalledWith('a1', { note: 'Đã gọi' }));
  });

  it('should say what went wrong when a note could not be saved', async () => {
    // Arrange
    vi.spyOn(api, 'hrAddNote').mockRejectedValue(new Error('mất mạng'));
    const { onError } = open();

    // Act
    await userEvent.type(box(), 'Đã gọi{Enter}');

    // Assert
    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect((box() as HTMLTextAreaElement).value).toBe('Đã gọi');
  });
});
