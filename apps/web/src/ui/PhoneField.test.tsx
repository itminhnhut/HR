import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { PhoneField } from './PhoneField';

afterEach(cleanup);

function Harness() {
  const [phone, setPhone] = useState('');
  return (
    <>
      <PhoneField label="Số điện thoại" value={phone} onChange={setPhone} />
      <button type="button">khác</button>
    </>
  );
}

describe('PhoneField', () => {
  it('does not complain while the number is still being typed', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText('Số điện thoại'), '0912');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('checks the number only after leaving the field', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText('Số điện thoại'), '0912');
    await userEvent.click(screen.getByRole('button', { name: 'khác' }));
    expect(screen.getByRole('alert').textContent).toMatch(/chưa đúng/);
  });

  it('clears the message as soon as the number becomes valid', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('Số điện thoại');
    await userEvent.type(input, '0912');
    await userEvent.click(screen.getByRole('button', { name: 'khác' }));
    await userEvent.type(input, '345678');
    expect(screen.queryByRole('alert')).toBeNull();
    expect((input as HTMLInputElement).value).toBe('0912 345 678');
  });

  it('uses the phone keypad and offers the saved number', () => {
    render(<Harness />);
    const input = screen.getByLabelText('Số điện thoại');
    expect(input.getAttribute('type')).toBe('tel');
    expect(input.getAttribute('inputmode')).toBe('tel');
    expect(input.getAttribute('autocomplete')).toBe('tel');
  });
});
