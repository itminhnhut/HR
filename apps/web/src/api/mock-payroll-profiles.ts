import {
  DEFAULT_COMPONENTS,
  fieldErrors,
  listedAccountOf,
  PAYROLL_DEFAULT_CONTRACT,
  PAYROLL_PERSON_CHECK_ITEMS,
  payrollBankSchema,
  payrollCommitmentSchema,
  payrollDependantSchema,
  payrollOpeningSchema,
  payrollProfileVersionSchema,
  payrollRecurringSchema,
  PAYROLL_INSURANCE_PAID,
  periodMonthOf,
  standardPeriod,
  todayInVietnam,
  type PayrollBankAccountDto,
  type PayrollChecklistDto,
  type PayrollFirstMonthCheckInput,
  type PayrollPersonCheckDto,
  type PayrollPersonCheckItem,
  type PayrollPersonDto,
  type PayrollProfileDto,
  type PayrollProfileVersionDto,
} from '@careers/shared';
import type { z } from 'zod';
import { DEMO_HR } from './demo-accounts';
import type { MockDb, MockPayrollProfile } from './mock-seed';
import { delay, fail, load, requireHr, save, uid } from './mock-store';
import type { PayrollFactKind, PayrollLineDto } from './types';

/**
 * The demo's Hồ sơ lương: the people of the golden month, each with the level the month is computed on, but the last
 * one, who has none yet ("Thiếu hồ sơ", L-B01). Saves are checked by the API's own schemas, so a field error on the
 * demo reads as it would on the server. Account numbers are made up; only the last four digits leave this module,
 * except on "Hiện đủ".
 */

const FIRST_MONTH = '2026-10';
const START = standardPeriod(2026, 10).from;
const CREATED_AT = '2026-11-01T02:00:00.000Z';
const FAKE_ACCOUNT = '0001234567';

type Lines = () => readonly PayrollLineDto[];

const joinedOf = (index: number) => `2025-${String((index % 12) + 1).padStart(2, '0')}-0${(index % 8) + 1}`;

function peopleOf(lines: Lines): PayrollPersonDto[] {
  return lines().map((l, i) => ({
    employeeId: l.employeeId,
    code: l.code,
    fullName: l.fullName,
    employment: l.probation ? 'probation' : 'official',
    block: l.block,
    joinedOn: joinedOf(i),
    leftOn: null,
  }));
}

function seedLevel(l: PayrollLineDto): PayrollProfileVersionDto {
  return {
    id: `lv-${l.employeeId}`,
    effectiveOn: START,
    contractTypeId: l.contractTypeId,
    probationDays: null,
    managesBusiness: false,
    unionMember: false,
    kpiAmount: l.kpiAmount,
    amounts: { ...l.amounts },
    createdBy: DEMO_HR.name,
    createdAt: CREATED_AT,
  };
}

const empty = (): MockPayrollProfile => ({
  versions: [],
  dependants: [],
  commitments: [],
  recurring: [],
  banks: [],
  openings: [],
});

function seedProfiles(lines: Lines): Record<string, MockPayrollProfile> {
  const all = lines();
  return Object.fromEntries(
    all.map((l, i) => {
      if (i === all.length - 1) return [l.employeeId, empty()];
      const banks =
        i === 0
          ? [
              {
                id: 'bank-1',
                bank: 'Ngân hàng Demo',
                last4: FAKE_ACCOUNT.slice(-4),
                changedOn: START,
                accountNumber: FAKE_ACCOUNT,
              },
            ]
          : [];
      return [l.employeeId, { ...empty(), versions: [seedLevel(l)], banks }];
    }),
  );
}

function profilesOf(db: MockDb, lines: Lines): Record<string, MockPayrollProfile> {
  db.payrollProfiles ??= seedProfiles(lines);
  return db.payrollProfiles;
}

/** The signed-in HR with the payroll right, the person and their stored profile. */
function access(lines: Lines, employeeId: string) {
  const db = load();
  const me = requireHr(db);
  if (me.canPayroll === false) throw new Error('403');
  const person = peopleOf(lines).find((p) => p.employeeId === employeeId);
  const profiles = profilesOf(db, lines);
  return { db, person, profile: profiles[employeeId] ?? empty(), profiles };
}

async function guarded<T>(lines: Lines, employeeId: string, run: (a: ReturnType<typeof access>) => T): Promise<T> {
  let a: ReturnType<typeof access>;
  try {
    a = access(lines, employeeId);
  } catch (error) {
    if (error instanceof Error && error.message === '403') return fail(403, 'Bạn không có quyền xem lương.');
    throw error;
  }
  if (!a.person) return fail(404, 'Không tìm thấy nhân viên.');
  return delay(run(a));
}

function store(a: ReturnType<typeof access>, employeeId: string, next: MockPayrollProfile) {
  a.db.payrollProfiles = { ...a.profiles, [employeeId]: next };
  save();
}

function parsed<S extends z.ZodType>(schema: S, raw: unknown): z.infer<S> {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  const errors = fieldErrors(result.error);
  throw Object.assign(new Error('422'), { errors });
}

async function checked<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof Error && error.message === '422' && 'errors' in error) {
      const errors = error.errors as Record<string, string>;
      return fail(422, Object.values(errors)[0] ?? 'Kiểm tra lại.', errors);
    }
    throw error;
  }
}

const bankDto = ({ accountNumber: _, ...dto }: MockPayrollProfile['banks'][number]): PayrollBankAccountDto => dto;
const monthKey = (day: string) => {
  const { year, month } = periodMonthOf(day);
  return `${year}-${String(month).padStart(2, '0')}`;
};

function dtoOf(person: PayrollPersonDto, p: MockPayrollProfile): PayrollProfileDto {
  return {
    person,
    leavingFrom: null,
    versions: [...p.versions].sort((a, b) => a.effectiveOn.localeCompare(b.effectiveOn)),
    dependants: p.dependants,
    commitments: p.commitments,
    recurring: p.recurring,
    bankAccounts: [...p.banks].sort((a, b) => b.changedOn.localeCompare(a.changedOn)).map(bankDto),
    openings: p.openings,
    overrides: [],
  };
}

function checkItems(person: PayrollPersonDto, p: MockPayrollProfile, confirmed: Set<string>): PayrollPersonCheckDto[] {
  const level = p.versions[p.versions.length - 1];
  const facts: Record<PayrollPersonCheckItem, { value: string; isDefault: boolean }> = {
    'loai-hd': level
      ? { value: level.contractTypeId, isDefault: false }
      : { value: `${PAYROLL_DEFAULT_CONTRACT[person.employment]} (mặc định)`, isDefault: true },
    'thu-viec': { value: `${level?.probationDays ?? 60} ngày`, isDefault: level?.probationDays == null },
    ngay: {
      value: person.joinedOn ? `Vào ${person.joinedOn.split('-').reverse().join('/')}` : 'Chưa có ngày',
      isDefault: false,
    },
    'cam-ket-thue': p.commitments.some((c) => c.year === 2026)
      ? { value: 'Đã có cam kết 2026', isDefault: false }
      : { value: 'Chưa có cam kết năm 2026', isDefault: true },
    'nguoi-phu-thuoc': {
      value: String(p.dependants.reduce((s, d) => s + d.count, 0)),
      isDefault: p.dependants.length === 0,
    },
    'doan-vien': { value: level?.unionMember ? 'Có' : 'Không', isDefault: !level },
    'khoan-32': {
      value: p.recurring.length ? `${p.recurring.length} khoản` : 'Không có',
      isDefault: p.recurring.length === 0,
    },
    'muc-dien-thoai-trang-phuc': { value: level ? 'Theo hồ sơ' : 'Chưa có hồ sơ', isDefault: !level },
    'so-du-dau-nam': { value: p.openings.length ? 'Đã nhập' : '0', isDefault: p.openings.length === 0 },
  };
  return PAYROLL_PERSON_CHECK_ITEMS.map((item) => {
    const isConfirmed = confirmed.has(`${person.employeeId}:${item}`);
    const isYellow = item === 'cam-ket-thue' || item === 'khoan-32';
    return {
      item,
      ...facts[item],
      confirmed: isConfirmed,
      confirmedBy: isConfirmed ? DEMO_HR.name : null,
      confirmedAt: isConfirmed ? CREATED_AT : null,
      level: isConfirmed ? null : isYellow ? 'yellow' : 'red',
    };
  });
}

type SaveInput = { employeeId: string; id: string | null };

function saveFact<K extends PayrollFactKind, S extends z.ZodType>(lines: Lines, kind: K, schema: S) {
  return ({ employeeId, id }: SaveInput, raw: unknown) =>
    checked(() =>
      guarded(lines, employeeId, (a) => {
        const data = parsed(schema, raw) as object;
        const row = { ...data, id: id ?? uid('f'), toMonth: 'toMonth' in data ? (data.toMonth ?? null) : undefined };
        const clean = Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined));
        const rows = a.profile[kind] as { id: string }[];
        const next = id ? rows.map((r) => (r.id === id ? clean : r)) : [...rows, clean];
        store(a, employeeId, { ...a.profile, [kind]: next });
        return clean as never;
      }),
    );
}

export function profileMockApi(lines: Lines) {
  const dependant = saveFact(lines, 'dependants', payrollDependantSchema);
  const commitment = saveFact(lines, 'commitments', payrollCommitmentSchema);
  const saveRecurring = saveFact(lines, 'recurring', payrollRecurringSchema);
  // As the API: the insurance is paid back once a month, so two such items never share a month.
  const recurring = async (target: SaveInput, raw: unknown) => {
    const stored = load().payrollProfiles?.[target.employeeId]?.recurring ?? [];
    const next = payrollRecurringSchema.safeParse(raw);
    const clashes =
      next.success &&
      next.data.kind === PAYROLL_INSURANCE_PAID &&
      stored.some(
        (r) =>
          r.id !== target.id &&
          r.kind === PAYROLL_INSURANCE_PAID &&
          (!r.toMonth || next.data.fromMonth <= r.toMonth) &&
          (!next.data.toMonth || r.fromMonth <= next.data.toMonth),
      );
    if (clashes) return fail(409, 'Đã có khoản công ty trả thay BH trong các tháng này.');
    return saveRecurring(target, raw);
  };
  return {
    async hrPayrollProfiles() {
      const db = load();
      if (requireHr(db).canPayroll === false) return fail(403, 'Bạn không có quyền xem lương.');
      const profiles = profilesOf(db, lines);
      const people = peopleOf(lines).map((p) => ({
        ...p,
        hasProfile: (profiles[p.employeeId]?.versions.length ?? 0) > 0,
        hasOverrides: p.fullName === 'NV A',
        account: listedAccountOf(profiles[p.employeeId]?.banks ?? [], todayInVietnam(new Date())),
      }));
      return delay({
        people,
        missing: people
          .filter((p) => !p.hasProfile)
          .map(({ hasProfile: _, hasOverrides: __, account: ___, ...p }) => p),
      });
    },
    hrPayrollProfile: (employeeId: string) =>
      guarded(lines, employeeId, (a) => dtoOf(a.person ?? peopleOf(lines)[0], a.profile)),
    hrPayrollProfilePrefill: (employeeId: string) =>
      guarded(lines, employeeId, (a) => ({
        effectiveOn: a.person?.joinedOn ?? null,
        contractTypeId: PAYROLL_DEFAULT_CONTRACT[a.person?.employment ?? 'official'],
        probationDays: null,
        amounts: Object.fromEntries(
          DEFAULT_COMPONENTS.filter((c) => c.defaultAmount > 0).map((c) => [c.id, c.defaultAmount]),
        ),
        suggestedOfficialOn: null,
      })),
    hrPayrollDeleteProfile: (employeeId: string) =>
      guarded(lines, employeeId, (a) => {
        store(a, employeeId, empty());
        return { ok: true as const };
      }),
    hrPayrollSaveLevel: (employeeId: string, id: string | null, raw: unknown) =>
      checked(() =>
        guarded(lines, employeeId, (a) => {
          const { fromMonth, effectiveOn, ...data } = parsed(payrollProfileVersionSchema, raw);
          const [y, m] = (fromMonth ?? '').split('-').map(Number);
          const day = effectiveOn ?? standardPeriod(y ?? 2026, m ?? 1).from;
          if (a.profile.versions.some((v) => v.effectiveOn === day && v.id !== id))
            throw Object.assign(new Error('422'), { errors: { effectiveOn: 'Đã có mức cùng ngày hiệu lực.' } });
          const version: PayrollProfileVersionDto = {
            ...data,
            probationDays: data.probationDays ?? null,
            effectiveOn: day,
            id: id ?? uid('lv'),
            createdBy: DEMO_HR.name,
            createdAt: new Date().toISOString(),
          };
          const rest = a.profile.versions.filter((v) => v.id !== id);
          store(a, employeeId, { ...a.profile, versions: [...rest, version] });
          const key = monthKey(day);
          const [ky, km] = key.split('-').map(Number);
          const splitsMonth = standardPeriod(ky ?? 2026, km ?? 1).from === day ? null : key;
          return { version, warnings: [], splitsMonth, approvedMonthsTouched: [] };
        }),
      ),
    hrPayrollDeleteLevel: (employeeId: string, id: string) =>
      guarded(lines, employeeId, (a) => {
        store(a, employeeId, { ...a.profile, versions: a.profile.versions.filter((v) => v.id !== id) });
        return { ok: true as const };
      }),
    hrPayrollSaveDependant: (employeeId: string, id: string | null, raw: unknown) => dependant({ employeeId, id }, raw),
    hrPayrollSaveCommitment: (employeeId: string, id: string | null, raw: unknown) =>
      commitment({ employeeId, id }, raw),
    hrPayrollSaveRecurring: (employeeId: string, id: string | null, raw: unknown) => recurring({ employeeId, id }, raw),
    hrPayrollDeleteFact: (employeeId: string, kind: PayrollFactKind, id: string) =>
      guarded(lines, employeeId, (a) => {
        const rows = a.profile[kind] as { id: string }[];
        store(a, employeeId, { ...a.profile, [kind]: rows.filter((r) => r.id !== id) });
        return { ok: true as const };
      }),
    hrPayrollSaveOpening: (employeeId: string, taxYear: number, raw: unknown) =>
      checked(() =>
        guarded(lines, employeeId, (a) => {
          const opening = { taxYear, ...parsed(payrollOpeningSchema, raw) };
          const rest = a.profile.openings.filter((o) => o.taxYear !== taxYear);
          store(a, employeeId, { ...a.profile, openings: [...rest, opening] });
          return opening;
        }),
      ),
    hrPayrollDeleteOpening: (employeeId: string, taxYear: number) =>
      guarded(lines, employeeId, (a) => {
        store(a, employeeId, { ...a.profile, openings: a.profile.openings.filter((o) => o.taxYear !== taxYear) });
        return { ok: true as const };
      }),
    hrPayrollAddBank: (employeeId: string, raw: unknown) =>
      checked(() =>
        guarded(lines, employeeId, (a) => {
          const data = parsed(payrollBankSchema, raw);
          if (a.profile.banks.some((b) => b.changedOn === data.changedOn))
            throw Object.assign(new Error('422'), { errors: { changedOn: 'Đã có tài khoản đổi ngày này.' } });
          const account = {
            id: uid('bank'),
            bank: data.bank,
            last4: data.accountNumber.slice(-4),
            changedOn: data.changedOn,
            accountNumber: data.accountNumber,
          };
          store(a, employeeId, { ...a.profile, banks: [...a.profile.banks, account] });
          return bankDto(account);
        }),
      ),
    hrPayrollDeleteBank: (employeeId: string, id: string) =>
      guarded(lines, employeeId, (a) => {
        store(a, employeeId, { ...a.profile, banks: a.profile.banks.filter((b) => b.id !== id) });
        return { ok: true as const };
      }),
    hrPayrollRevealBank: (employeeId: string, id: string) =>
      guarded(lines, employeeId, (a) => {
        const account = a.profile.banks.find((b) => b.id === id);
        if (!account) throw new Error('Không tìm thấy tài khoản.');
        return { accountNumber: account.accountNumber };
      }),
    async hrPayrollChecklist(): Promise<PayrollChecklistDto> {
      const db = load();
      if (requireHr(db).canPayroll === false) return fail(403, 'Bạn không có quyền xem lương.');
      const profiles = profilesOf(db, lines);
      const confirmed = new Set(db.payrollChecks ?? []);
      const people = peopleOf(lines).map((p) => ({
        employeeId: p.employeeId,
        code: p.code,
        fullName: p.fullName,
        items: checkItems(p, profiles[p.employeeId] ?? empty(), confirmed),
      }));
      const unconfirmed = people.flatMap((p) => p.items).filter((i) => !i.confirmed).length;
      return delay({ month: FIRST_MONTH, people, unconfirmed });
    },
    async hrPayrollConfirmCheck(input: PayrollFirstMonthCheckInput) {
      const db = load();
      if (requireHr(db).canPayroll === false) return fail(403, 'Bạn không có quyền xem lương.');
      const key = `${input.employeeId ?? ''}:${input.item}`;
      const rest = (db.payrollChecks ?? []).filter((k) => k !== key);
      db.payrollChecks = input.confirmed ? [...rest, key] : rest;
      save();
      return delay({
        id: key,
        item: input.item,
        employeeId: input.employeeId ?? null,
        closingId: null,
        confirmed: input.confirmed,
        confirmedAt: new Date().toISOString(),
        confirmedBy: DEMO_HR.name,
      });
    },
  };
}
