import type { ApplicationDetailDto } from '@careers/shared';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { shortJobTitle } from './ApplicantList';
import { OutcomeActions } from './OutcomeActions';
import { RejectForm } from './RejectForm';

afterEach(cleanup);

const app = (over: Partial<ApplicationDetailDto>) => ({ ...over }) as ApplicationDetailDto;
const past = '2026-01-01T02:00:00.000Z';
const future = '2099-01-01T02:00:00.000Z';

function show(over: Partial<ApplicationDetailDto>) {
  const onStatus = vi.fn();
  const onReject = vi.fn();
  render(<OutcomeActions app={app(over)} busy={false} onStatus={onStatus} onReject={onReject} />);
  return { onStatus, onReject };
}

describe('OutcomeActions', () => {
  it('should ask for the result once the interview time has passed', async () => {
    // Arrange
    const { onStatus } = show({ status: 'interview', interviewAt: past });

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Đạt' }));

    // Assert
    expect(onStatus).toHaveBeenCalledWith('passed');
  });

  it('should ask nothing before the interview', () => {
    show({ status: 'interview', interviewAt: future });

    expect(screen.queryByRole('button', { name: 'Đạt' })).toBeNull();
  });

  it('should ask nothing when no time is set', () => {
    show({ status: 'interview', interviewAt: null });

    expect(screen.queryByRole('button', { name: 'Đạt' })).toBeNull();
  });

  it('should record "Không đến" with its reason in one press', async () => {
    // Arrange
    const { onReject } = show({ status: 'interview', interviewAt: past });

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Không đến' }));

    // Assert
    expect(onReject).toHaveBeenCalledWith('no_show');
  });

  it('should open the list of reasons for "Không đạt"', async () => {
    // Arrange
    const { onReject } = show({ status: 'interview', interviewAt: past });

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Không đạt' }));

    // Assert
    expect(onReject).toHaveBeenCalledWith();
  });

  it('should offer the next step to someone who passed', async () => {
    // Arrange
    const { onStatus, onReject } = show({ status: 'passed', interviewAt: past });

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Đã nhận việc' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ứng viên từ chối' }));

    // Assert
    expect(onStatus).toHaveBeenCalledWith('hired');
    expect(onReject).toHaveBeenCalledWith('candidate_declined');
  });

  it('should show why an application was turned down', () => {
    show({ status: 'rejected', rejectReason: 'salary', rejectNote: 'Muốn 20 triệu' });

    expect(screen.getByText('Lương không khớp')).toBeTruthy();
    expect(screen.getByText(/Muốn 20 triệu/)).toBeTruthy();
  });
});

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
