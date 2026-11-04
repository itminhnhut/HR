import { optionNames } from '../../../test/choose';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => vi.stubEnv('VITE_API_URL', '/api'));
import {
  addPosts,
  box,
  byRealRules,
  clickSave,
  DRIVE_LINK,
  duplicateReply,
  fillForm,
  mocks,
  pasteLink,
  pickJob,
  pickSource,
  reply,
  show,
  useFlowServer,
} from './AddApplicationFlow.helpers';

useFlowServer();

describe('Contact details', () => {
  it('should ask for the source before sending anything', async () => {
    // Arrange
    show();
    await pickJob();

    // Act
    await clickSave();

    // Assert
    expect(screen.getByText('Chọn nguồn hồ sơ.')).toBeTruthy();
    expect(addPosts()).toEqual([]);
  });

  it('should ask for the empty name in Vietnamese', async () => {
    // Arrange
    show();
    await pickJob();
    await pickSource();

    // Act
    await clickSave();

    // Assert
    expect(await screen.findByText('Nhập họ và tên.')).toBeTruthy();
    expect(screen.queryByText(/Invalid input/)).toBeNull();
  });

  it('should ask for the empty phone in Vietnamese', async () => {
    // Arrange
    show();
    await pickJob();
    await pickSource();

    // Act
    await clickSave();

    // Assert
    expect(await screen.findByText('Nhập số điện thoại (Zalo).')).toBeTruthy();
  });

  it('should ask for the job when none is picked', async () => {
    // Arrange
    show();
    await pickSource();
    await userEvent.type(box('Họ và tên'), 'Trần Khoa');
    await userEvent.type(box('Số điện thoại'), '0912345678');

    // Act
    await clickSave();

    // Assert
    expect(await screen.findByText('Chọn vị trí ứng tuyển.')).toBeTruthy();
  });

  it('should show why an email is wrong', async () => {
    // Arrange
    show();
    await fillForm();
    await userEvent.type(box(/^Email/), 'khoa@');

    // Act
    await clickSave();

    // Assert
    expect(await screen.findByText('Email chưa đúng.')).toBeTruthy();
  });

  it('should show why a phone is wrong when HR leaves the box', async () => {
    // Arrange
    show();

    // Act
    await userEvent.type(box('Số điện thoại'), '09123');
    await userEvent.tab();

    // Assert
    expect(screen.getByText(/Số điện thoại chưa đúng/)).toBeTruthy();
  });

  it.each([
    ['+84912345678', '0912 345 678'],
    ['+84 912 345 678', '0912 345 678'],
    ['84 912 345 678', '0912 345 678'],
    ['(+84) 912 345 678', '0912 345 678'],
    ['0912.345.678', '0912 345 678'],
  ])('should turn a pasted %s into the whole number', async (pasted, shown) => {
    // Arrange
    show();
    const phone = box('Số điện thoại');
    await userEvent.click(phone);
    // user-event skips maxlength for type="tel" (it lists "telephone"); a real browser cuts the paste to it.
    const limit = Number(phone.getAttribute('maxlength') ?? pasted.length);

    // Act
    await userEvent.paste(pasted.slice(0, limit));

    // Assert
    expect(box('Số điện thoại').value).toBe(shown);
  });

  it('should ask who referred only for a referral', async () => {
    // Arrange
    show();
    expect(screen.queryByLabelText('Ai giới thiệu')).toBeNull();

    // Act
    await pickSource('referral');

    // Assert
    expect(screen.getByLabelText('Ai giới thiệu')).toBeTruthy();
  });

  it('should offer closed and expired jobs marked as such, and no draft', async () => {
    // Act
    show();
    const names = await optionNames(await screen.findByLabelText('Vị trí ứng tuyển'), 'Kế toán');

    // Assert
    expect(names).toEqual(['Chọn vị trí…', 'Kế toán', 'Lái xe (đã đóng)', 'Thủ kho (đã đóng)']);
  });

  it('should tell HR when the job was deleted meanwhile, keeping the form', async () => {
    // Arrange
    mocks.addReply = () => reply(404, { error: 'Không tìm thấy tin tuyển dụng.' });
    show();
    await fillForm();

    // Act
    await clickSave();

    // Assert
    expect(await screen.findByText('Không tìm thấy tin tuyển dụng.')).toBeTruthy();
    expect(box('Họ và tên').value).toBe('Trần Khoa');
  });

  it('should show how much of the note limit is used', async () => {
    // Arrange
    show();

    // Act
    await userEvent.type(box(/Ghi chú nội bộ/), 'Gửi');

    // Assert
    expect(screen.getByText('3/2000')).toBeTruthy();
  });

  it('should show the error of a note that is too long', async () => {
    // Arrange
    show();
    await fillForm();
    await userEvent.click(box(/Ghi chú nội bộ/));
    await userEvent.paste('a'.repeat(2001));

    // Act
    await clickSave();

    // Assert
    expect(await screen.findByText('Ghi chú tối đa 2000 ký tự.')).toBeTruthy();
  });
});

describe('A duplicate', () => {
  it('should offer to put the pasted link on the existing profile', async () => {
    // Arrange
    mocks.addReply = duplicateReply;
    const onAdded = show();
    await fillForm();
    await pasteLink(DRIVE_LINK);
    await clickSave();

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Cập nhật CV vào hồ sơ đó' }));

    // Assert
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith('old-id'));
    const put = mocks.sent.find((s) => s.method === 'PUT');
    expect(put?.url).toBe('/api/hr/applications/old-id/cv');
    expect(put?.body?.get('cvLink')).toBe(DRIVE_LINK);
  });

  it('should not offer to update a CV when HR gave none', async () => {
    // Arrange
    mocks.addReply = duplicateReply;
    show();
    await fillForm();

    // Act
    await clickSave();

    // Assert
    await screen.findByRole('button', { name: 'Mở hồ sơ đó' });
    expect(screen.queryByRole('button', { name: 'Cập nhật CV vào hồ sơ đó' })).toBeNull();
  });

  it('should keep the warning and say why when updating that CV fails', async () => {
    // Arrange
    mocks.addReply = duplicateReply;
    mocks.replaceReply = () => reply(500, { error: 'Có lỗi xảy ra, thử lại sau.' });
    const onAdded = show();
    await fillForm();
    await pasteLink(DRIVE_LINK);
    await clickSave();

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Cập nhật CV vào hồ sơ đó' }));

    // Assert
    expect(await screen.findByText('Có lỗi xảy ra, thử lại sau.')).toBeTruthy();
    expect(onAdded).not.toHaveBeenCalled();
    expect(screen.getByText(/Đã có hồ sơ của/)).toBeTruthy();
  });

  it('should save once HR corrects the phone', async () => {
    // Arrange
    mocks.addReply = duplicateReply;
    const onAdded = show();
    await fillForm();
    await clickSave();
    await screen.findByRole('button', { name: 'Mở hồ sơ đó' });
    mocks.addReply = byRealRules;
    await userEvent.clear(box('Số điện thoại'));
    await userEvent.type(box('Số điện thoại'), '0987654321');

    // Act
    await clickSave();

    // Assert
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith('new-id'));
  });
});
