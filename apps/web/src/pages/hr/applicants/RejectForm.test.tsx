import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { shortJobTitle } from './ApplicantList';
import { RejectForm } from './RejectForm';

afterEach(cleanup);

describe('RejectForm', () => {
  const confirm = () => screen.getByRole('button', { name: 'Xác nhận chưa phù hợp' }) as HTMLButtonElement;

  it('should wait for a reason', () => {
    render(<RejectForm busy={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(confirm().disabled).toBe(true);
  });

  it('should send the reason chosen', async () => {
    // Arrange
    const onConfirm = vi.fn();
    render(<RejectForm busy={false} onConfirm={onConfirm} onCancel={vi.fn()} />);

    // Act
    await userEvent.click(screen.getByRole('radio', { name: 'Thiếu kinh nghiệm' }));
    await userEvent.click(confirm());

    // Assert
    expect(onConfirm).toHaveBeenCalledWith('lacks_experience', null);
  });

  it('should ask for the details when the reason is "Khác"', async () => {
    // Arrange
    const onConfirm = vi.fn();
    render(<RejectForm busy={false} onConfirm={onConfirm} onCancel={vi.fn()} />);

    // Act
    await userEvent.click(screen.getByRole('radio', { name: 'Khác' }));
    const waits = confirm().disabled;
    await userEvent.type(screen.getByRole('textbox', { name: 'Ghi thêm về lý do' }), 'Đã nhận nơi khác');
    await userEvent.click(confirm());

    // Assert
    expect(waits).toBe(true);
    expect(onConfirm).toHaveBeenCalledWith('other', 'Đã nhận nơi khác');
  });

  it('should offer no reason about age, gender, marriage or health', () => {
    render(<RejectForm busy={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByRole('radio', { name: /tuổi|giới tính|hôn nhân|sức khoẻ|thai/i })).toBeNull();
  });
});

describe('shortJobTitle', () => {
  it('should leave a note in brackets at the end out of the list', () => {
    expect(shortJobTitle('Nhân Viên Chứng Từ - Logistics ( Yêu Cầu Kinh Nghiệm 1 Năm )')).toBe(
      'Nhân Viên Chứng Từ - Logistics',
    );
  });

  it('should keep a title with nothing else to show', () => {
    expect(shortJobTitle('(Thực tập)')).toBe('(Thực tập)');
  });
});
