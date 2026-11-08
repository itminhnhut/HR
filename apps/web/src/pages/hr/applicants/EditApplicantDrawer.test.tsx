import type { ApplicationDetailDto } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { api } from '../../../api';
import { application } from './AddApplicationFlow.helpers';
import { ContactOrigin } from './ContactOrigin';

/** "Sửa thông tin": name, phone, email and gender of any application, in a drawer (spec-sua-ho-so.md). */

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

const sent = (over: Partial<ApplicationDetailDto> = {}) =>
  application({
    fullName: 'Nguyen Van An',
    phone: '0987654321',
    email: 'an@mail.vn',
    addedBy: null,
    source: 'website',
    ...over,
  });

function show(app: ApplicationDetailDto) {
  vi.spyOn(api, 'hrSources').mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ContactOrigin app={app} />
    </QueryClientProvider>,
  );
}

const drawer = () => within(screen.getByRole('dialog', { name: 'Sửa thông tin' }));

describe('fixing what an application says', () => {
  it('TC-SH-10: should fix the name of one the candidate sent and send no source for it', async () => {
    // Arrange
    const update = vi.spyOn(api, 'hrUpdateContact').mockResolvedValue(sent({ fullName: 'Nguyễn Văn An' }));
    show(sent());

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Sửa thông tin' }));
    const name = drawer().getByLabelText('Họ tên');
    await userEvent.clear(name);
    await userEvent.type(name, 'Nguyễn Văn An');
    await userEvent.click(drawer().getByRole('radio', { name: 'Nữ' }));
    expect(drawer().queryByText('Nguồn')).toBeNull();
    await userEvent.click(drawer().getByRole('button', { name: 'Lưu' }));

    // Assert
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('a1', {
        fullName: 'Nguyễn Văn An',
        phone: '0987654321',
        email: 'an@mail.vn',
        gender: 'female',
      }),
    );
  });

  it('TC-SH-11: should also offer the source on one HR added', async () => {
    // Act
    show(sent({ addedBy: 'Lan', source: 'zalo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sửa thông tin' }));

    // Assert
    expect(drawer().getByText('Nguồn')).toBeTruthy();
  });

  it('TC-SH-13: should warn that the old number no longer finds the application, when the phone of one the candidate sent changes', async () => {
    // Arrange
    show(sent());
    await userEvent.click(screen.getByRole('button', { name: 'Sửa thông tin' }));

    // Act
    const phone = drawer().getByLabelText(/Số điện thoại/);
    await userEvent.clear(phone);
    await userEvent.type(phone, '0912000333');

    // Assert
    expect(drawer().getByText(/tra cứu bằng số cũ/)).toBeTruthy();
  });

  it('TC-SH-14: should ask before dropping changes not saved', async () => {
    // Arrange
    show(sent());
    await userEvent.click(screen.getByRole('button', { name: 'Sửa thông tin' }));
    await userEvent.type(drawer().getByLabelText('Họ tên'), ' B');

    // Act
    await userEvent.click(drawer().getByRole('button', { name: 'Huỷ' }));

    // Assert
    expect(drawer().getByText('Chưa lưu thay đổi.')).toBeTruthy();
    await userEvent.click(drawer().getByRole('button', { name: 'Bỏ thay đổi' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Sửa thông tin' })).toBeNull());
  });
});
