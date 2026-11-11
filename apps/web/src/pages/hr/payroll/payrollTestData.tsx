import { EMPTY_MONTH_INPUTS, type HrMe } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import type { PayrollLineDto, PayrollMonthDto } from '../../../api';
import { PayrollPage } from './PayrollPage';

/** Shared by the Lương page tests: the signed-in HR, a two-row month and the page in a router. */

export const ME: HrMe = {
  id: 'u1',
  email: 'hr@congty.vn',
  name: 'Phòng Nhân sự',
  phone: null,
  contactEmail: null,
  jobTitle: null,
  alias: null,
  canPayroll: true,
  canApprovePayroll: true,
};

export const person = (over: Partial<PayrollLineDto>): PayrollLineDto => ({
  employeeId: 'nv-a',
  code: 'NV01',
  fullName: 'NV A',
  department: 'Hành chính',
  regionId: 'hcm',
  contractTypeId: 'khong-thoi-han',
  block: 'BO',
  probation: false,
  norm: 22,
  amounts: { luong: 6_400_000 },
  kpiAmount: 0,
  cells: { netPay: 18_516_850 } as PayrollLineDto['cells'],
  explain: {},
  overrides: [],
  personSettings: [],
  note: '',
  inputs: EMPTY_MONTH_INPUTS,
  ...over,
});

export const month = (over: Partial<PayrollMonthDto> = {}): PayrollMonthDto => ({
  year: 2026,
  month: 10,
  monthKey: '2026-10',
  period: { from: '2026-09-26', to: '2026-10-25' },
  payDate: '2026-11-05',
  status: 'draft',
  computedAt: '2026-11-03T02:00:00.000Z',
  approval: null,
  paidOn: null,
  components: [{ id: 'luong', name: 'Lương thời gian' }],
  regions: [{ id: 'hcm', name: 'Hồ Chí Minh', tone: 'blue' }],
  contractTypes: [{ id: 'khong-thoi-han', name: 'Không thời hạn' }],
  lines: [
    person({
      personSettings: [
        { key: 'khoan.com.thue', text: 'Tiền cơm chịu thuế', from: 'T10/2026', cells: ['exempt'], area: 'khoan-luong' },
      ],
    }),
    person({
      employeeId: 'nv-j',
      code: 'NV10',
      fullName: 'NV J',
      block: 'KD',
      department: 'Kinh doanh',
      overrides: [
        {
          cell: 'kpiPercent',
          computed: 0.53,
          typed: 0,
          reason: 'Vào giữa kỳ',
          by: 'HR',
          at: '2026-11-03T02:00:00.000Z',
        },
      ],
    }),
  ],
  totals: { netPay: 37_033_700 },
  review: [],
  ...over,
});

function Address() {
  const { pathname, search } = useLocation();
  return <output aria-label="địa chỉ">{`${pathname}${search}`}</output>;
}

export function open(start: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[start]}>
        <Routes>
          <Route path="/hr/luong/*" element={<PayrollPage />} />
        </Routes>
        <Address />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

export const address = () => screen.getByLabelText('địa chỉ').textContent ?? '';
