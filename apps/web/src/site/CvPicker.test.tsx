import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CvPicker } from './CvPicker';

afterEach(cleanup);

describe('CV picker', () => {
  it('should refuse a file that is not a PDF and report nothing usable', async () => {
    // Arrange
    const onChange = vi.fn();
    render(<CvPicker onChange={onChange} />);

    // Act
    await userEvent.upload(
      screen.getByLabelText(/Chọn file CV/),
      new File(['x'], 'cv.docx', { type: 'application/msword' }),
      {
        applyAccept: false,
      },
    );

    // Assert
    expect(screen.getByText('CV cần là file PDF.')).toBeTruthy();
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('should report a PDF, a link, or the saved CV', async () => {
    const onChange = vi.fn();
    render(<CvPicker onChange={onChange} savedFileName="CV-cu.pdf" />);
    const pdf = new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByLabelText(/Chọn file CV/), pdf);
    expect(onChange).toHaveBeenLastCalledWith({ file: pdf });
    await userEvent.click(screen.getByRole('button', { name: 'Dán link' }));
    await userEvent.type(screen.getByLabelText('Link CV'), 'https://drive.test/cv');
    expect(onChange).toHaveBeenLastCalledWith({ link: 'https://drive.test/cv' });
    await userEvent.click(screen.getByRole('button', { name: 'Dùng CV đã lưu' }));
    expect(onChange).toHaveBeenLastCalledWith({ useSaved: true });
  });
});
