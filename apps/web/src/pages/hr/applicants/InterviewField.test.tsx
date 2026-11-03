import { addDays, todayInVietnam } from '@careers/shared';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { InterviewField } from './InterviewField';

const DAY_AFTER = addDays(todayInVietnam(), 2);
const SAVED = `${DAY_AFTER}T10:30:00+07:00`;

function Harness({ start, onChange }: { start: string | null; onChange: (iso: string | null) => void }) {
  const [value, setValue] = useState(start);
  return (
    <InterviewField
      value={value}
      onChange={(iso) => {
        setValue(iso);
        onChange(iso);
      }}
    />
  );
}

const field = () => screen.getByRole('button', { name: /^Giờ phỏng vấn/ });
const picker = () => screen.getByRole('dialog', { name: 'Chọn ngày giờ phỏng vấn' });

async function openWith(start: string | null = null) {
  const onChange = vi.fn();
  render(<Harness start={start} onChange={onChange} />);
  await userEvent.click(field());
  return onChange;
}

beforeAll(() => {
  // jsdom has no <dialog> methods.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});

afterEach(cleanup);

describe('The interview time field', () => {
  it('should be one field with a placeholder and nothing else while closed', () => {
    // Act
    render(<Harness start={null} onChange={() => undefined} />);

    // Assert
    expect(field().textContent).toBe('Chọn ngày giờ phỏng vấn');
    expect(screen.queryByRole('grid')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ngày mai' })).toBeNull();
  });

  it('should show the whole value in Vietnam time', () => {
    // Act
    render(<Harness start="2026-11-05T02:00:00.000Z" onChange={() => undefined} />);

    // Assert
    expect(field().textContent).toBe('Thứ Năm, 05/11/2026 · 09:00');
  });

  it('should open with the month, the hour and minute, and Huỷ and Áp dụng', async () => {
    // Act
    await openWith();

    // Assert
    const open = within(picker());
    expect(open.getByRole('grid')).toBeTruthy();
    expect(open.getByRole('combobox', { name: 'Giờ' })).toBeTruthy();
    expect(open.getByRole('combobox', { name: 'Phút' })).toBeTruthy();
    expect(open.getByRole('button', { name: 'Huỷ' })).toBeTruthy();
    expect(open.getByRole('button', { name: 'Áp dụng' })).toBeTruthy();
  });

  it('should not save anything until "Áp dụng", then save in Vietnam time', async () => {
    // Arrange
    const onChange = await openWith();
    await userEvent.click(within(picker()).getByRole('button', { name: 'Ngày kia' }));
    await userEvent.selectOptions(within(picker()).getByRole('combobox', { name: 'Giờ' }), '14');
    await userEvent.selectOptions(within(picker()).getByRole('combobox', { name: 'Phút' }), '15');
    expect(onChange).not.toHaveBeenCalled();

    // Act
    await userEvent.click(within(picker()).getByRole('button', { name: 'Áp dụng' }));

    // Assert
    expect(onChange).toHaveBeenLastCalledWith(`${DAY_AFTER}T14:15:00+07:00`);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('should show the choice in full before it is applied', async () => {
    // Arrange
    await openWith(SAVED);

    // Act
    await userEvent.selectOptions(within(picker()).getByRole('combobox', { name: 'Phút' }), '45');

    // Assert
    expect(picker().textContent).toContain('· 10:45');
  });

  it('should keep "Áp dụng" off until a day is chosen', async () => {
    // Act
    await openWith();

    // Assert
    expect(within(picker()).getByRole<HTMLButtonElement>('button', { name: 'Áp dụng' }).disabled).toBe(true);
    expect(picker().textContent).toContain('Chưa chọn ngày');
  });

  it('should save a day picked in the month', async () => {
    // Arrange
    const onChange = await openWith();
    const days = within(within(picker()).getByRole('grid')).getAllByRole('button');
    const last = days.filter((d) => !d.hasAttribute('disabled')).at(-1);
    if (!last) throw new Error('No day can be picked');

    // Act
    await userEvent.click(last);
    await userEvent.click(within(picker()).getByRole('button', { name: 'Áp dụng' }));

    // Assert
    const iso = String(onChange.mock.lastCall?.[0]);
    expect(iso).toMatch(/T09:00:00\+07:00$/);
    expect(Number(iso.slice(8, 10))).toBe(Number(last.textContent));
  });

  it('should drop the choice on "Huỷ" and start from the saved value next time', async () => {
    // Arrange
    const onChange = await openWith(SAVED);
    await userEvent.selectOptions(within(picker()).getByRole('combobox', { name: 'Giờ' }), '15');

    // Act
    await userEvent.click(within(picker()).getByRole('button', { name: 'Huỷ' }));
    await userEvent.click(field());

    // Assert
    expect(onChange).not.toHaveBeenCalled();
    expect(within(picker()).getByRole<HTMLSelectElement>('combobox', { name: 'Giờ' }).value).toBe('10');
  });

  it('should offer no minutes past 20:00', async () => {
    // Arrange
    await openWith(SAVED);

    // Act
    await userEvent.selectOptions(within(picker()).getByRole('combobox', { name: 'Giờ' }), '20');

    // Assert
    const minute = within(picker()).getByRole<HTMLSelectElement>('combobox', { name: 'Phút' });
    expect(minute.value).toBe('00');
    expect(within(minute).getByRole<HTMLOptionElement>('option', { name: '30' }).disabled).toBe(true);
  });

  it('should not let HR pick a day in the past', async () => {
    // Arrange
    const onChange = await openWith();
    const today = Number(todayInVietnam().slice(8, 10));
    const days = within(within(picker()).getByRole('grid')).getAllByRole('button');

    // Assert
    expect(days.filter((d) => Number(d.textContent) < today).every((d) => d.hasAttribute('disabled'))).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should clear the time from "Xoá giờ hẹn" and close', async () => {
    // Arrange
    const onChange = await openWith(SAVED);

    // Act
    await userEvent.click(within(picker()).getByRole('button', { name: 'Xoá giờ hẹn' }));

    // Assert
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(field().textContent).toBe('Chọn ngày giờ phỏng vấn');
  });

  it('should offer no "Xoá giờ hẹn" while nothing is chosen', async () => {
    // Act
    await openWith();

    // Assert
    expect(within(picker()).queryByRole('button', { name: 'Xoá giờ hẹn' })).toBeNull();
  });

  it('should close on Esc and give the focus back to the field', async () => {
    // Arrange
    await openWith();

    // Act: the browser turns Esc on a modal dialog into a "cancel" event.
    fireEvent(picker(), new Event('cancel', { cancelable: true }));

    // Assert
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(field());
  });

  it('should close on a click outside', async () => {
    // Arrange
    await openWith();

    // Act: a click on the backdrop reaches the dialog element itself.
    fireEvent.click(picker());

    // Assert
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('should not open while disabled', async () => {
    // Arrange
    render(<InterviewField value={null} disabled onChange={() => undefined} />);

    // Act
    await userEvent.click(field());

    // Assert
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
