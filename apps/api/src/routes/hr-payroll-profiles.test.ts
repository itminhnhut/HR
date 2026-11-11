import type {
  EmployeeDto,
  PayrollPersonDto,
  PayrollProfileDto,
  PayrollProfileListDto,
  PayrollProfileMonthDto,
  PayrollProfilePrefillDto,
  PayrollProfileVersionSavedDto,
} from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { payrollLog } from '../db/schema.js';
import { addSetting, approvedMonth, givePayrollRight } from '../test/payroll-flow.js';
import { createFlow, type Flow } from '../test/timesheet-flow.js';

/**
 * Hồ sơ lương: pay levels by the date they take effect (spec-luong.md 10.2, 11.5, R1, R5; docs/test-cases-luong.md
 * L-B01–L-B15, L-A23). People and amounts are fake.
 */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
  await givePayrollRight(flow);
});

const base = (over: Record<string, unknown> = {}) => ({
  contractTypeId: 'khong-thoi-han',
  amounts: { luong: 10_000_000, com: 1_000_000 },
  kpiAmount: 2_000_000,
  ...over,
});

const addVersion = (person: EmployeeDto, body: Record<string, unknown>, expected = 201) =>
  flow.payroll<PayrollProfileVersionSavedDto>('POST', `/profiles/${person.id}/versions`, body, expected);

const profileOf = (person: EmployeeDto) => flow.payroll<PayrollProfileDto>('GET', `/profiles/${person.id}`);
const monthOf = (person: EmployeeDto, month: string) =>
  flow.payroll<PayrollProfileMonthDto>('GET', `/profiles/${person.id}/month/${month}`);

const component = (id: string, name: string, defaultAmount: number) => ({
  id,
  name,
  order: 1,
  perDay: true,
  probationRate: true,
  insured: id === 'luong',
  contractPay: id === 'luong',
  overtimeBase: true,
  tax: { kind: 'taxable' },
  defaultAmount,
  regulatedCap: null,
  stoppedFrom: null,
});

describe('L-B01, L-B15 a person in Chấm công without a profile', () => {
  it('L-B01: should list the person as missing a profile, from the day they joined', async () => {
    // Arrange
    await flow.addPerson({ code: 'NV01', fullName: 'NV A', joinedOn: '2026-01-05' });
    const newcomer = await flow.addPerson({ code: 'NV13', fullName: 'NV M', joinedOn: '2026-11-03' });
    await addVersion(await flow.addPerson({ code: 'NV02', fullName: 'NV B' }), base({ effectiveOn: '2026-01-01' }));

    // Act
    const list = await flow.payroll<PayrollProfileListDto>('GET', '/profiles');

    // Assert
    expect(list.missing.map((p: PayrollPersonDto) => [p.code, p.joinedOn])).toEqual([
      ['NV01', '2026-01-05'],
      ['NV13', '2026-11-03'],
    ]);
    expect(list.people.find((p) => p.employeeId === newcomer.id)?.hasProfile).toBe(false);
    expect(list.people.find((p) => p.code === 'NV02')?.hasProfile).toBe(true);
  });

  it('L-B01: should prefill a new profile with the components’ default amounts, from the day they joined', async () => {
    // Arrange
    const newcomer = await flow.addPerson({ code: 'NV13', fullName: 'NV M', joinedOn: '2026-11-03' });
    await addSetting(flow, {
      key: 'khoan.danh-sach',
      from: '2026-01',
      value: [component('luong', 'Lương thời gian', 0), component('com', 'Tiền cơm', 1_000_000)],
    });
    await addSetting(flow, { key: 'khoan.com.muc-mac-dinh', from: '2026-11', value: 1_200_000 });

    // Act
    const prefill = await flow.payroll<PayrollProfilePrefillDto>('GET', `/profiles/${newcomer.id}/prefill`);

    // Assert
    expect(prefill).toEqual({
      effectiveOn: '2026-11-03',
      contractTypeId: 'khong-thoi-han',
      probationDays: null,
      amounts: { luong: 0, com: 1_200_000 },
      suggestedOfficialOn: null,
    });
  });

  it('L-B01: should prefill from the engine’s default components when none is stored', async () => {
    // Arrange
    const newcomer = await flow.addPerson({ code: 'NV13', fullName: 'NV M', joinedOn: '2026-11-03' });

    // Act
    const prefill = await flow.payroll<PayrollProfilePrefillDto>('GET', `/profiles/${newcomer.id}/prefill`);

    // Assert
    expect(prefill.amounts).toMatchObject({ luong: 0, com: 1_200_000, 'chuyen-can': 1_200_000 });
  });

  it('L-B15: should suggest the official date as the day joined plus the probation days', async () => {
    // Arrange
    const trainee = await flow.addPerson({
      code: 'NV05',
      fullName: 'NV E',
      employment: 'probation',
      joinedOn: '2026-09-01',
    });

    // Act
    const prefill = await flow.payroll<PayrollProfilePrefillDto>('GET', `/profiles/${trainee.id}/prefill`);

    // Assert
    expect(prefill).toMatchObject({ contractTypeId: 'thu-viec', suggestedOfficialOn: '2026-10-31' });
  });
});

describe('L-B03 – L-B06 the date a level takes effect', () => {
  it('L-B03: should warn when the first level starts after the day joined, and keep what HR chose', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'NV03', fullName: 'NV C', joinedOn: '2026-10-07' });

    // Act
    const saved = await addVersion(person, base({ effectiveOn: '2026-10-15' }));

    // Assert
    expect(saved.version.effectiveOn).toBe('2026-10-15');
    expect(saved.warnings).toEqual([
      '07/10/2026–14/10/2026 có công nhưng chưa có mức. Đề nghị lùi ngày hiệu lực về 07/10/2026.',
    ]);
  });

  it('L-B06: should save a month as the first day of its period, and say when another date splits the month', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'NV03', fullName: 'NV C', joinedOn: '2026-01-05' });
    await addVersion(person, base({ effectiveOn: '2026-01-05' }));

    // Act
    const byMonth = await addVersion(person, base({ fromMonth: '2026-12', amounts: { luong: 11_000_000 } }));
    const midMonth = await addVersion(person, base({ effectiveOn: '2027-01-01', amounts: { luong: 12_000_000 } }));

    // Assert
    expect([byMonth.version.effectiveOn, byMonth.splitsMonth]).toEqual(['2026-11-26', null]);
    expect([midMonth.version.effectiveOn, midMonth.splitsMonth]).toEqual(['2027-01-01', '2027-01']);
  });

  it.todo(
    'L-B04, L-B05: a level from the first day of a period is one segment, from mid-period two (draft months, step 15)',
  );
  it.todo('L-B07: a raise dated in an approved month creates back pay in the next draft (step 17)');
});

describe('L-B08 – L-B11 changing a level (R5)', () => {
  it('L-B08: should refuse to change a level an approved month used and point to a new one from the next draft', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'NV03', fullName: 'NV C', joinedOn: '2026-01-05' });
    const { version } = await addVersion(person, base({ effectiveOn: '2026-07-26' }));
    await approvedMonth(flow, 2026, 10);

    // Act
    const res = await flow.payroll<{ error: string }>(
      'PUT',
      `/profiles/${person.id}/versions/${version.id}`,
      base({ effectiveOn: '2026-07-26', amounts: { luong: 9_000_000 } }),
      409,
    );

    // Assert
    expect(res.error).toBe('Đã dùng ở T10/2026 đã duyệt. Thêm mức mới từ 26/10/2026 hoặc Sửa lỗi.');
  });

  it('should keep the lock on a level that was there when the month was approved', async () => {
    // Arrange: the level dated inside October exists before the approval of October.
    const person = await flow.addPerson({ code: 'NV03', fullName: 'NV C', joinedOn: '2026-01-05' });
    await flow.at('2026-11-01');
    await addVersion(person, base({ effectiveOn: '2026-07-26' }));
    const { version } = await addVersion(person, base({ effectiveOn: '2026-10-10' }));
    await approvedMonth(flow, 2026, 10, 'approved', new Date('2026-11-05T03:00:00.000Z'));
    await flow.at('2026-11-11');
    const path = `/profiles/${person.id}/versions/${version.id}`;

    // Act
    const edited = await flow.payroll<{ error: string }>('PUT', path, base({ effectiveOn: '2026-10-10' }), 409);
    const deleted = await flow.payroll<{ error: string }>('DELETE', path, undefined, 409);

    // Assert
    expect(edited.error).toBe('Đã dùng ở T10/2026 đã duyệt. Thêm mức mới từ 26/10/2026 hoặc Sửa lỗi.');
    expect(deleted.error).toBe(edited.error);
  });

  it('should let HR change and delete a level added after the approval: the approval never used it', async () => {
    // Arrange: October is approved on the first level; a level dated inside October is added afterwards.
    const person = await flow.addPerson({ code: 'NV03', fullName: 'NV C', joinedOn: '2026-01-05' });
    await flow.at('2026-11-01');
    const first = await addVersion(person, base({ effectiveOn: '2026-07-26' }));
    await approvedMonth(flow, 2026, 10, 'approved', new Date('2026-11-05T03:00:00.000Z'));
    await flow.at('2026-11-11');
    const late = await addVersion(person, base({ effectiveOn: '2026-10-10', amounts: { luong: 12_000_000 } }));
    const path = `/profiles/${person.id}/versions/${late.version.id}`;

    // Act
    const saved = await flow.payroll<PayrollProfileVersionSavedDto>(
      'PUT',
      path,
      base({ effectiveOn: '2026-10-10', amounts: { luong: 11_000_000 } }),
    );
    await flow.payroll(
      'PUT',
      `/profiles/${person.id}/versions/${first.version.id}`,
      base({ effectiveOn: '2026-07-26' }),
      409,
    );
    await flow.payroll('DELETE', path);

    // Assert
    expect(late.approvedMonthsTouched).toEqual(['2026-10']);
    expect(saved.version.amounts).toEqual({ luong: 11_000_000 });
    expect((await profileOf(person)).versions.map((v) => v.effectiveOn)).toEqual(['2026-07-26']);
  });

  it.todo('L-B08: "Sửa lỗi" on a level an approved month used goes through the retroactive flow (step 17)');

  it('L-B09: should change a level only drafts use, and log old → new', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'NV03', fullName: 'NV C', joinedOn: '2026-01-05' });
    await approvedMonth(flow, 2026, 10);
    const { version } = await addVersion(person, base({ effectiveOn: '2026-10-26' }));

    // Act
    const saved = await flow.payroll<PayrollProfileVersionSavedDto>(
      'PUT',
      `/profiles/${person.id}/versions/${version.id}`,
      base({ effectiveOn: '2026-10-26', amounts: { luong: 11_000_000, com: 1_000_000 } }),
    );

    // Assert
    expect(saved.version.amounts).toEqual({ luong: 11_000_000, com: 1_000_000 });
    const lines = (await flow.t.db.select().from(payrollLog)).map((l) => [l.area, l.detail]);
    expect(lines).toContainEqual(['ho-so', 'Sửa hồ sơ của NV03 NV C, từ 26/10/2026: luong 10.000.000 → 11.000.000']);
  });

  it('L-B10: should delete a future level and an unused profile, and refuse a profile an approved month used', async () => {
    // Arrange
    const used = await flow.addPerson({ code: 'NV03', fullName: 'NV C', joinedOn: '2026-01-05' });
    const unused = await flow.addPerson({ code: 'NV04', fullName: 'NV D', joinedOn: '2026-11-03' });
    await addVersion(used, base({ effectiveOn: '2026-01-05' }));
    const future = await addVersion(used, base({ effectiveOn: '2026-11-26' }));
    await addVersion(unused, base({ effectiveOn: '2026-11-03' }));
    await approvedMonth(flow, 2026, 10);

    // Act
    await flow.payroll('DELETE', `/profiles/${used.id}/versions/${future.version.id}`);
    const refused = await flow.payroll<{ error: string }>('DELETE', `/profiles/${used.id}`, undefined, 409);
    await flow.payroll('DELETE', `/profiles/${unused.id}`);

    // Assert
    expect(refused.error).toContain('Đã dùng ở T10/2026 đã duyệt');
    expect((await profileOf(used)).versions.map((v) => v.effectiveOn)).toEqual(['2026-01-05']);
    expect((await profileOf(unused)).versions).toEqual([]);
  });

  it('L-B11: should refuse a second level on the same date', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'NV03', fullName: 'NV C' });
    await addVersion(person, base({ effectiveOn: '2026-11-01' }));

    // Act
    const res = await addVersion(person, base({ effectiveOn: '2026-11-01' }), 409);

    // Assert
    expect(res).toMatchObject({ error: 'Đã có mức từ 01/11/2026.' });
  });
});

describe('L-B12 – L-B14 the person in Chấm công', () => {
  it('L-B12: should warn when the salary is under the regional minimum of the person’s region', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'NV03', fullName: 'NV C', regionId: flow.hcm.id });
    await addSetting(flow, {
      key: 'luat.luong-toi-thieu-vung',
      from: '2026-01-01',
      value: { I: 5_310_000, II: 4_730_000, III: 4_140_000, IV: 3_700_000 },
    });

    // Act
    const saved = await addVersion(person, base({ effectiveOn: '2026-11-01', amounts: { luong: 5_000_000 } }));

    // Assert
    expect(saved.warnings).toEqual(['Lương thời gian 5.000.000 dưới lương tối thiểu vùng I 5.310.000.']);
  });

  it('L-B12: should warn under the engine’s regional minimum when none is stored', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'NV03', fullName: 'NV C', regionId: flow.hcm.id });

    // Act
    const saved = await addVersion(person, base({ effectiveOn: '2026-11-01', amounts: { luong: 5_000_000 } }));

    // Assert
    expect(saved.warnings).toEqual(['Lương thời gian 5.000.000 dưới lương tối thiểu vùng I 5.310.000.']);
  });

  it.todo('L-B12: raise the insurance salary to the floor and flag it in Rà soát (engine, step 15)');

  it('L-B13: should show the first day without work of a person who left', async () => {
    // Arrange
    const person = await flow.addPerson({
      code: 'NV03',
      fullName: 'NV C',
      joinedOn: '2026-01-05',
      leftOn: '2026-10-09',
    });

    // Act
    const profile = await profileOf(person);

    // Assert
    expect(profile.leavingFrom).toBe('2026-10-10');
  });

  it.todo(
    'L-B13: levels after the last day are ignored inside the leaving month (no row from T11: hr-payroll-month.test.ts)',
  );

  it('L-B14: should keep a returning person’s new profile apart from the old one', async () => {
    // Arrange
    const before = await flow.addPerson({
      code: 'NV03',
      fullName: 'NV C',
      joinedOn: '2025-01-05',
      leftOn: '2025-12-31',
    });
    await addVersion(before, base({ effectiveOn: '2025-01-05' }));
    const back = await flow.addPerson({ code: 'NV31', fullName: 'NV C', joinedOn: '2026-11-03' });

    // Act
    await addVersion(back, base({ effectiveOn: '2026-11-03', amounts: { luong: 12_000_000 } }));

    // Assert
    expect((await profileOf(before)).versions.map((v) => v.amounts.luong)).toEqual([10_000_000]);
    expect((await profileOf(back)).versions.map((v) => v.amounts.luong)).toEqual([12_000_000]);
  });

  it.todo(
    'L-B16, L-B17, L-B27: dates and regions come from the timesheet close (steps 15, 17; L-B25 in hr-payroll-month.test.ts)',
  );
});

describe('L-A23 a new default amount for a component', () => {
  it('L-A23: should leave profiles as they are, and move the people on the old default when HR agrees', async () => {
    // Arrange
    const a = await flow.addPerson({ code: 'NV01', fullName: 'NV A' });
    const b = await flow.addPerson({ code: 'NV02', fullName: 'NV B' });
    const c = await flow.addPerson({ code: 'NV03', fullName: 'NV C' });
    await addVersion(a, base({ effectiveOn: '2026-01-01' }));
    await addVersion(b, base({ effectiveOn: '2026-01-01' }));
    await addVersion(c, base({ effectiveOn: '2026-01-01', amounts: { luong: 10_000_000, com: 900_000 } }));
    await addSetting(flow, { key: 'khoan.com.muc-mac-dinh', from: '2026-12', value: 1_200_000 });

    // Act
    const unchanged = await monthOf(a, '2026-12');
    const onDefault = await flow.payroll<PayrollPersonDto[]>(
      'GET',
      '/components/com/default-users?ngay=2026-11-26&muc=1000000',
    );
    const applied = await flow.payroll<{ applied: number }>('POST', '/components/com/apply-default', {
      fromOn: '2026-11-26',
      oldAmount: 1_000_000,
      newAmount: 1_200_000,
    });

    // Assert
    expect(unchanged.versions.map((v) => v.amounts.com)).toEqual([1_000_000]);
    expect(onDefault.map((p) => p.code)).toEqual(['NV01', 'NV02']);
    expect(applied.applied).toBe(2);
    expect((await monthOf(a, '2026-12')).versions.at(-1)?.amounts).toEqual({ luong: 10_000_000, com: 1_200_000 });
    expect((await monthOf(c, '2026-12')).versions.map((v) => v.amounts.com)).toEqual([900_000]);
  });
});
