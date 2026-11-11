import { describe, expect, it } from 'vitest';
import {
  APPLICANT_TEMPLATE_KEYS,
  DEFAULT_MESSAGE_TEMPLATES,
  outlookComposeUrl,
  TEMPLATE_KEYS,
} from '../message-templates.js';
import { fillPayslipTemplate, payslipFileName, payslipMailDetails, placeholderTokensFor } from './payslip.js';
import { renderMailHtml } from './render-html.js';
import { renderMailText } from './render-text.js';

/** The payslip mail of Mẫu thư, filled for a made-up employee. */
const values = {
  fullName: 'Người Thử A',
  month: '10/2026',
  payDate: '05/11/2026',
  netPay: '9.000.000 đ',
  hrName: 'HR Thử',
  hrPhone: '0900000000',
  company: 'Top Flow',
};
const details = payslipMailDetails({ name: 'HR Thử', phone: '', title: '', alias: '', email: 'hr@example.com' });

describe('payslip mail template', () => {
  it('should fill the name, the month and the pay date, and keep amounts out of the default text', () => {
    // Act
    const { content, missing } = fillPayslipTemplate(DEFAULT_MESSAGE_TEMPLATES.payslip, values);

    // Assert
    expect(content.subject).toBe('[Top Flow] Phiếu lương tháng 10/2026 - Người Thử A');
    expect(content.body).toContain('Thân gửi anh/chị Người Thử A,');
    expect(content.body).toContain('Ngày chi trả: 05/11/2026.');
    expect(missing).toEqual([]);
    expect(renderMailText(content, details)).not.toContain('9.000.000');
  });

  it('should put the net pay in when HR adds {Thực nhận} to the template', () => {
    // Arrange
    const template = { ...DEFAULT_MESSAGE_TEMPLATES.payslip, closing: 'Thực nhận: {Thực nhận}.' };

    // Act
    const { content } = fillPayslipTemplate(template, values);

    // Assert
    expect(content.closing).toBe('Thực nhận: 9.000.000 đ.');
  });

  it('should list a field without a value and leave its token in the text', () => {
    // Act
    const { content, missing } = fillPayslipTemplate(DEFAULT_MESSAGE_TEMPLATES.payslip, { ...values, payDate: '' });

    // Assert
    expect(missing).toEqual(['{Ngày trả}']);
    expect(content.body).toContain('{Ngày trả}');
  });

  it('should not tell an employee that they applied for a job', () => {
    // Arrange
    const { content } = fillPayslipTemplate(DEFAULT_MESSAGE_TEMPLATES.payslip, values);

    // Act
    const text = renderMailText(content, details);
    const html = renderMailHtml(content, details);

    // Assert
    expect(text).not.toContain('ứng tuyển tại');
    expect(html).not.toContain('ứng tuyển tại');
    expect(html).toContain('PHIẾU LƯƠNG');
    expect(text).toContain('Thư này chỉ dành cho người nhận.');
  });

  it('should address the Outlook compose link to the employee with the filled subject', () => {
    // Arrange
    const { content } = fillPayslipTemplate(DEFAULT_MESSAGE_TEMPLATES.payslip, values);

    // Act
    const url = new URL(outlookComposeUrl('nv01@example.com', content.subject));

    // Assert
    expect(url.searchParams.get('to')).toBe('nv01@example.com');
    expect(url.searchParams.get('subject')).toBe('[Top Flow] Phiếu lương tháng 10/2026 - Người Thử A');
  });

  it('should offer the payslip on Mẫu thư but not among the letters to a candidate', () => {
    // Assert
    expect(TEMPLATE_KEYS).toContain('payslip');
    expect(APPLICANT_TEMPLATE_KEYS).not.toContain('payslip');
    expect(placeholderTokensFor('payslip')).toEqual(expect.arrayContaining(['{Họ tên}', '{Tháng}', '{Ngày trả}', '{Thực nhận}']));
    expect(placeholderTokensFor('call')).toContain('{Tên ứng viên}');
  });

  it('should name the file of one person after the month and the code', () => {
    // Assert
    expect(payslipFileName('2026-10', 'NV01')).toBe('Phieu-luong-2026-10-NV01.xlsx');
    expect(payslipFileName('2026-10', 'NV 01/a')).toBe('Phieu-luong-2026-10-NV-01-a.xlsx');
  });
});
