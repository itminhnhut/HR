import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CopyValue } from './CopyValue';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function withClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
}

describe('copying a value out of the sheet', () => {
  it('should put exactly that value on the clipboard, and say so', async () => {
    // Arrange
    const writeText = vi.fn(() => Promise.resolve());
    withClipboard(writeText);
    render(<CopyValue text="Sales Engineer" label="bộ phận">Sales Engineer</CopyValue>);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép bộ phận' }));

    // Assert
    expect(writeText).toHaveBeenCalledWith('Sales Engineer');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Đã sao chép bộ phận' })).toBeTruthy());
  });

  it('should say it could not copy when the browser refuses', async () => {
    // Arrange
    withClipboard(() => Promise.reject(new Error('denied')));
    render(<CopyValue text="9,5" label="công thực tế">9,5</CopyValue>);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép công thực tế' }));

    // Assert
    await waitFor(() => expect(screen.getByRole('button', { name: 'Chưa sao chép được công thực tế' })).toBeTruthy());
  });

  it('should not start a selection in the grid when pressed', () => {
    // Arrange
    withClipboard(() => Promise.resolve());
    const onMouseDown = vi.fn();
    render(<div onMouseDown={onMouseDown}><CopyValue text="A" label="mã">A</CopyValue></div>);

    // Act
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Sao chép mã' }));

    // Assert
    expect(onMouseDown).not.toHaveBeenCalled();
  });

  it('should offer nothing to copy for an empty value', () => {
    // Act
    render(<CopyValue text="" label="ghi chú">-</CopyValue>);

    // Assert
    expect(screen.queryByRole('button')).toBeNull();
  });
});
