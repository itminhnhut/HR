import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DRAFT, goldenCells, goldenExportMonth } from './goldenExport.fixture';
import { PayslipCard } from './PayslipCard';
import { payslipsOf } from './payslip';

/** The payslip on the web and in print (spec 11.7): no signature block (Q4), NHÁP across a draft. */

describe('PayslipCard', () => {
  it('L-L34: should show the payslip without a signature block', () => {
    // Arrange
    const [slip] = payslipsOf(goldenExportMonth());
    if (!slip) throw new Error('No payslip');

    // Act
    const { container } = render(<PayslipCard slip={slip} />);

    // Assert
    expect(screen.getByRole('heading', { name: 'PHIẾU LƯƠNG THÁNG 10/2026' })).toBeTruthy();
    // NV A: BH on lương thời gian only (K3); the net is written with dot thousands, as in HR's file
    const net = screen.getByTestId('payslip-net').textContent ?? '';
    expect(net).toMatch(/^\d{1,3}(\.\d{3})+$/);
    expect(Number(net.replace(/\./g, ''))).toBe(goldenCells('NV A').netPay);
    expect(container.textContent).not.toMatch(/NGƯỜI LẬP BIỂU|KẾ TOÁN TRƯỞNG|GIÁM ĐỐC|Ký, ghi rõ/);
    expect(screen.queryByText('NHÁP')).toBeNull();
  });

  it('L-F19: should lay NHÁP across a draft payslip and offer no send button', () => {
    // Arrange
    const [slip] = payslipsOf(goldenExportMonth({ month: 11, stamp: DRAFT }));
    if (!slip) throw new Error('No payslip');

    // Act
    render(<PayslipCard slip={slip} />);

    // Assert
    expect(screen.getByText('NHÁP').getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
