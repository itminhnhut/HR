import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { chooseOption } from '../../../test/choose';
import { Calendar } from './Calendar';
import { useConfirm, type ConfirmOptions } from './Confirm';
import { SelectField } from './Select';
import { Tip } from './Tip';

afterEach(cleanup);

function Pick({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <SelectField
      label="Nguồn"
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        onChange(e.target.value);
      }}
    >
      <option value="">Mọi nguồn</option>
      <option value="zalo">Zalo</option>
      <option value="old" disabled>
        Đã ẩn
      </option>
    </SelectField>
  );
}

describe('SelectField', () => {
  it('should show the choice for an empty value and give back an empty value for it', async () => {
    // Arrange
    const onChange = vi.fn();
    render(<Pick onChange={onChange} />);
    expect(screen.getByRole('combobox', { name: 'Nguồn' }).textContent).toContain('Mọi nguồn');

    // Act
    await chooseOption(screen.getByRole('combobox', { name: 'Nguồn' }), 'zalo');
    await chooseOption(screen.getByRole('combobox', { name: 'Nguồn' }), '');

    // Assert
    expect(onChange.mock.calls).toEqual([['zalo'], ['']]);
  });

  it('should say what is chosen', async () => {
    // Arrange
    render(<Pick onChange={vi.fn()} />);

    // Act
    await chooseOption(screen.getByRole('combobox', { name: 'Nguồn' }), 'zalo');

    // Assert
    expect(screen.getByRole<HTMLButtonElement>('combobox', { name: 'Nguồn' }).value).toBe('zalo');
    expect(screen.getByRole('combobox', { name: 'Nguồn' }).textContent).toContain('Zalo');
  });

  it('should use the words of an option that has no value', async () => {
    // Arrange
    render(
      <SelectField label="Ngày làm" value="Thứ 2 – Thứ 6">
        <option>Thứ 2 – Thứ 6</option>
        <option>Thứ 2 – Thứ 7</option>
      </SelectField>,
    );

    // Assert
    expect(screen.getByRole('combobox', { name: 'Ngày làm' }).textContent).toContain('Thứ 2 – Thứ 6');
  });

  it('should not pick a disabled option', async () => {
    // Arrange
    render(<Pick onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Nguồn' }));

    // Assert
    expect(screen.getByRole('option', { name: 'Đã ẩn' }).getAttribute('aria-disabled')).toBe('true');
  });
});

function Ask({ options, onAnswer }: { options: ConfirmOptions; onAnswer: (agreed: boolean) => void }) {
  const [confirm, dialog] = useConfirm();
  return (
    <>
      <button type="button" onClick={() => void confirm(options).then(onAnswer)}>
        Hỏi
      </button>
      {dialog}
    </>
  );
}

describe('useConfirm', () => {
  const options = { title: 'Xoá nguồn?', description: 'Không hoàn tác được.', action: 'Xoá', isDanger: true };

  it('should answer yes on the action, with the question shown', async () => {
    // Arrange
    const onAnswer = vi.fn();
    render(<Ask options={options} onAnswer={onAnswer} />);

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Hỏi' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Xoá nguồn?' });
    await userEvent.click(screen.getByRole('button', { name: 'Xoá' }));

    // Assert
    expect(dialog).toBeTruthy();
    expect(onAnswer).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('should answer no on cancel and on Esc', async () => {
    // Arrange
    const onAnswer = vi.fn();
    render(<Ask options={options} onAnswer={onAnswer} />);

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Hỏi' }));
    await userEvent.click(screen.getByRole('button', { name: 'Huỷ' }));
    await userEvent.click(screen.getByRole('button', { name: 'Hỏi' }));
    await userEvent.keyboard('{Escape}');

    // Assert
    expect(onAnswer.mock.calls).toEqual([[false], [false]]);
  });
});

describe('Tip', () => {
  it('should say what an icon does on keyboard focus', async () => {
    // Arrange
    render(
      <Tip label="Sửa tin">
        <button type="button" aria-label="Sửa tin A" />
      </Tip>,
    );

    // Act
    await userEvent.tab();

    // Assert
    expect((await screen.findByRole('tooltip')).textContent).toContain('Sửa tin');
  });
});

describe('Calendar', () => {
  it('should title the month in short Vietnamese and give back the pressed day', async () => {
    // Arrange
    const onSelect = vi.fn();
    render(<Calendar mode="single" defaultMonth={new Date(2026, 11, 1)} onSelect={onSelect} />);

    // Act
    const day = screen.getAllByRole('button').find((b) => b.textContent === '4');
    if (!day) throw new Error('no day 4');
    await userEvent.click(day);

    // Assert
    expect(screen.getByText('Tháng 12, 2026')).toBeTruthy();
    expect((onSelect.mock.calls[0]?.[0] as Date).getDate()).toBe(4);
  });

  it('should paint the picked day, with nothing left to hide its number', () => {
    // Act
    render(<Calendar mode="single" defaultMonth={new Date(2026, 11, 1)} selected={new Date(2026, 11, 4)} />);

    // Assert
    const picked = screen.getAllByRole('button').find((b) => b.textContent === '4');
    expect(picked?.className).toContain('bg-primary');
    expect(picked?.className).not.toContain('bg-transparent');
  });

  it('should not let a day out of range be pressed', () => {
    // Act
    render(
      <Calendar mode="single" defaultMonth={new Date(2026, 11, 1)} disabled={{ before: new Date(2026, 11, 10) }} />,
    );

    // Assert
    const days = screen.getAllByRole<HTMLButtonElement>('button').filter((b) => b.textContent === '4');
    expect(days.every((b) => b.disabled)).toBe(true);
  });
});
