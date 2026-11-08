import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api';
import { PaperDrop } from './PaperDrop';

/** Choosing, taking and dropping papers, each with its own progress (spec-giay-to-nghi.md). Cases TC-GT-41..46. */

const photo = (name: string) => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], name, { type: 'image/jpeg' });
const same = async (f: File) => f;

afterEach(cleanup);

function show(onUpload: (file: File, onProgress: (percent: number) => void) => Promise<void>, room = 10) {
  return render(<PaperDrop room={room} onUpload={onUpload} shrink={same} />);
}

describe('sending papers', () => {
  it('TC-GT-41: should send the chosen files one after another and say each went', async () => {
    // Arrange
    const sent: string[] = [];
    show(async (file) => { sent.push(file.name); });

    // Act
    await userEvent.upload(screen.getByLabelText('Chọn file giấy tờ'), [photo('trang-1.jpg'), photo('trang-2.jpg')]);

    // Assert
    await waitFor(() => expect(sent).toEqual(['trang-1.jpg', 'trang-2.jpg']));
    const list = screen.getByRole('list', { name: 'File đang gửi' });
    await waitFor(() => expect(within(list).getAllByText('Đã gửi')).toHaveLength(2));
  });

  it('TC-GT-42: should show how far a file has gone', async () => {
    // Arrange
    let finish: () => void = () => undefined;
    show((_file, onProgress) => new Promise<void>((resolve) => { onProgress(40); finish = resolve; }));

    // Act
    await userEvent.upload(screen.getByLabelText('Chọn file giấy tờ'), photo('giay-om.jpg'));

    // Assert
    expect(await screen.findByText('40%')).toBeTruthy();
    finish();
    expect(await screen.findByText('Đã gửi')).toBeTruthy();
  });

  it('TC-GT-43: should say why a file was refused, and send it again on "Gửi lại"', async () => {
    // Arrange
    const onUpload = vi.fn().mockRejectedValueOnce(new ApiError(0, 'Mất mạng khi gửi file. Thử gửi lại.')).mockResolvedValueOnce(undefined);
    show(onUpload);
    await userEvent.upload(screen.getByLabelText('Chọn file giấy tờ'), photo('giay-om.jpg'));
    await screen.findByText('Mất mạng khi gửi file. Thử gửi lại.');

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Gửi lại giay-om.jpg' }));

    // Assert
    expect(await screen.findByText('Đã gửi')).toBeTruthy();
    expect(onUpload).toHaveBeenCalledTimes(2);
  });

  it('TC-GT-44: should take files dropped on it', async () => {
    // Arrange
    const sent: string[] = [];
    show(async (file) => { sent.push(file.name); });

    // Act
    fireEvent.drop(screen.getByRole('group', { name: 'Gửi giấy tờ' }), { dataTransfer: { files: [photo('keo-tha.jpg')], types: ['Files'] } });

    // Assert
    await waitFor(() => expect(sent).toEqual(['keo-tha.jpg']));
  });

  it('TC-GT-45: should open the camera on a phone for "Chụp ảnh"', () => {
    // Act
    show(async () => undefined);
    const camera = screen.getByLabelText('Chụp ảnh giấy tờ');

    // Assert
    expect(camera.getAttribute('capture')).toBe('environment');
    expect(camera.getAttribute('accept')).toBe('image/*');
  });

  it('TC-GT-46: should send no more than the room left, and say how many it left out', async () => {
    // Arrange
    const sent: string[] = [];
    show(async (file) => { sent.push(file.name); }, 1);

    // Act
    await userEvent.upload(screen.getByLabelText('Chọn file giấy tờ'), [photo('1.jpg'), photo('2.jpg'), photo('3.jpg')]);

    // Assert
    await waitFor(() => expect(sent).toEqual(['1.jpg']));
    expect(screen.getByText(/bỏ qua 2 file/)).toBeTruthy();
  });
});
