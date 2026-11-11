import type {
  PayrollChecklistDto,
  PayrollProfileDto,
  PayrollProfileListDto,
  PayrollProfileVersionDto,
} from '@careers/shared';
import { spyOnApi } from '../../../../test/apiSpy';
import { ME, month } from '../payrollTestData';

/** Made-up people for the Hồ sơ lương tests: NV A and NV J have a profile, NV M joined and has none, NV Z left. */

const person = (employeeId: string, code: string, fullName: string, block: 'BO' | 'KD', over = {}) => ({
  employeeId,
  code,
  fullName,
  employment: 'official' as const,
  block,
  joinedOn: '2025-03-02',
  leftOn: null,
  ...over,
});

export const LIST: PayrollProfileListDto = {
  people: [
    { ...person('nv-a', 'NV01', 'NV A', 'BO'), hasProfile: true, hasOverrides: true },
    { ...person('nv-j', 'NV10', 'NV J', 'KD'), hasProfile: true, hasOverrides: false },
    {
      ...person('nv-m', 'NV13', 'NV M', 'KD', { employment: 'probation', joinedOn: '2026-11-03' }),
      hasProfile: false,
      hasOverrides: false,
    },
    { ...person('nv-z', 'NV20', 'NV Z', 'BO', { leftOn: '2026-10-09' }), hasProfile: true, hasOverrides: false },
  ],
  missing: [person('nv-m', 'NV13', 'NV M', 'KD', { employment: 'probation', joinedOn: '2026-11-03' })],
};

export const LEVEL: PayrollProfileVersionDto = {
  id: 'lv-1',
  effectiveOn: '2026-09-26',
  contractTypeId: 'khong-thoi-han',
  probationDays: null,
  managesBusiness: false,
  unionMember: true,
  kpiAmount: 2_000_000,
  amounts: { luong: 6_400_000, com: 1_100_000 },
  createdBy: 'HR',
  createdAt: '2026-11-01T02:00:00.000Z',
};

export const profile = (over: Partial<PayrollProfileDto> = {}): PayrollProfileDto => ({
  person: person('nv-a', 'NV01', 'NV A', 'BO'),
  leavingFrom: null,
  versions: [LEVEL],
  dependants: [{ id: 'd-1', fromMonth: '2026-01', toMonth: '2026-12', count: 2 }],
  commitments: [{ id: 'c-1', year: 2026, signedOn: '2026-01-05' }],
  recurring: [],
  bankAccounts: [{ id: 'b-1', bank: 'Ngân hàng Demo', last4: '4567', payslipEmail: null, changedOn: '2026-09-26' }],
  openings: [],
  overrides: [],
  ...over,
});

export const CHECKLIST: PayrollChecklistDto = {
  month: '2026-10',
  unconfirmed: 2,
  people: [
    {
      employeeId: 'nv-a',
      code: 'NV01',
      fullName: 'NV A',
      items: [
        {
          item: 'cam-ket-thue',
          value: 'Ký 05/01/2026',
          isDefault: false,
          confirmed: true,
          confirmedBy: 'HR',
          confirmedAt: '2026-11-01T02:00:00.000Z',
          level: null,
        },
        {
          item: 'so-du-dau-nam',
          value: '0',
          isDefault: true,
          confirmed: false,
          confirmedBy: null,
          confirmedAt: null,
          level: 'red',
        },
        {
          item: 'khoan-32',
          value: 'Không có',
          isDefault: true,
          confirmed: false,
          confirmedBy: null,
          confirmedAt: null,
          level: 'yellow',
        },
      ],
    },
  ],
};

/** The page's own reads, answered; returns the spies a test may look at. */
export function answerReads(one: PayrollProfileDto = profile()) {
  spyOnApi('hrMe').mockResolvedValue(ME);
  spyOnApi('hrPayrollMonth').mockResolvedValue(month());
  spyOnApi('hrEmployees').mockRejectedValue(new Error('Không có Chấm công'));
  spyOnApi('hrRegions').mockResolvedValue([]);
  spyOnApi('hrPayrollChecklist').mockResolvedValue(CHECKLIST);
  return {
    list: spyOnApi('hrPayrollProfiles').mockResolvedValue(LIST),
    profile: spyOnApi('hrPayrollProfile').mockResolvedValue(one),
  };
}
