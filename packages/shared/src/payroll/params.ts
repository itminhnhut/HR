import { standardPeriod, type TimesheetPeriodRange } from '../timesheet.js';
import { LAW_SETTINGS, type Zone } from './defaults-law.js';
import { resolveSetting } from './resolve.js';
import type { LawGroup, Resolved, SettingDef, SettingRow } from './setting-core.js';

const pad = (n: number) => String(n).padStart(2, '0');

/** The dates a payroll month reads its settings by (spec R2). */
export interface PayrollDates {
  year: number;
  month: number;
  /** `YYYY-MM`: company settings, rules, options, overrides. */
  monthKey: string;
  period: TimesheetPeriodRange;
  /** Insurance month T is calendar month T; its parameters are those of day 1. */
  insuranceMonth: string;
  insuranceDate: string;
  /** Tax parameters, dependants and commitments go by the pay date; the tax year is its year. */
  payDate: string;
  taxYear: number;
}

/** Payroll month T/YYYY: period 26/(T−1)–25/T, paid on `payDay` of T+1 unless HR set a pay date. */
export function payrollDates(year: number, month: number, payDate?: string, payDay = 5): PayrollDates {
  const next = new Date(Date.UTC(year, month, payDay));
  const pay = payDate ?? `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
  const monthKey = `${year}-${pad(month)}`;
  return {
    year,
    month,
    monthKey,
    period: standardPeriod(year, month),
    insuranceMonth: monthKey,
    insuranceDate: `${monthKey}-01`,
    payDate: pay,
    taxYear: Number(pay.slice(0, 4)),
  };
}

type LawKey = keyof typeof LAW_SETTINGS;

const groupOf = (key: LawKey): LawGroup | undefined => LAW_SETTINGS[key].group;
type LawValue<K extends LawKey> = (typeof LAW_SETTINGS)[K] extends { defaults: readonly { value: infer T }[] }
  ? T
  : never;

/** Indexing the registry with a generic key widens it to a union of definitions; each entry holds its own type. */
const lawDef = <K extends LawKey>(key: K) => LAW_SETTINGS[key] as SettingDef<unknown> as SettingDef<LawValue<K>>;

const law = <K extends LawKey>(rows: readonly SettingRow[], key: K, personId: string | null, date: string) =>
  resolveSetting(rows, lawDef(key), personId, date);

/** Every law parameter in force on one date. */
export function paramsOn(rows: readonly SettingRow[], date: string, personId: string | null = null) {
  const pick = <K extends LawKey>(key: K) => law(rows, key, personId, date);
  return {
    baseSalary: pick('luat.luong-co-so'),
    zoneMinimums: pick('luat.luong-toi-thieu-vung'),
    capMultipliers: pick('luat.he-so-tran'),
    employeeRates: pick('luat.bh-nld'),
    companyRates: pick('luat.bh-cty'),
    unionFund: pick('luat.kpcd'),
    unionFee: pick('luat.doan-phi'),
    deductions: pick('luat.giam-tru'),
    brackets: pick('luat.bieu-thue'),
    mealCap: pick('luat.tran-tien-an'),
    clothingCap: pick('luat.tran-trang-phuc'),
    probationLimits: pick('luat.thu-viec-toi-da'),
    flat: pick('luat.khau-tru-10'),
    overtimeLimits: pick('luat.gioi-han-lam-them'),
  };
}

export interface TaxBracket {
  upTo: number | null;
  rate: number;
}

/** The law parameters of one payroll month, each read on its own reference date (R2). */
export interface LawParams {
  baseSalary: number;
  zoneMinimums: Record<Zone, number>;
  /** BHXH, BHYT cap: 20 × base salary. The BHTN cap depends on the zone: 20 × that zone's minimum. */
  socialCap: number;
  unemploymentCapMultiplier: number;
  employeeRates: { social: number; health: number; unemployment: number };
  companyRates: { social: number; health: number; unemployment: number };
  unionFund: number;
  unionFee: number;
  deductions: { personal: number; dependant: number };
  brackets: TaxBracket[];
  mealCap: number;
  /** Clothing paid in cash, exempt up to this much in a tax year. */
  clothingCap: number;
  probationLimits: { manager: number; college: number; intermediate: number; other: number };
  flatRate: number;
  flatThreshold: number;
  overtimeLimits: { month: number; year: number };
  /** Every version used, for the approval snapshot and the "Tham số áp dụng" sheet (R4, R8). */
  used: Resolved<unknown>[];
}

export function lawParamsFor(
  rows: readonly SettingRow[],
  dates: PayrollDates,
  personId: string | null = null,
): LawParams {
  const at = (key: LawKey) => (groupOf(key) === 'tax' ? dates.payDate : dates.insuranceDate);
  const get = <K extends LawKey>(key: K) => law(rows, key, personId, at(key));
  const base = get('luat.luong-co-so');
  const caps = get('luat.he-so-tran');
  const flat = get('luat.khau-tru-10');
  const resolved = {
    zoneMinimums: get('luat.luong-toi-thieu-vung'),
    employeeRates: get('luat.bh-nld'),
    companyRates: get('luat.bh-cty'),
    unionFund: get('luat.kpcd'),
    unionFee: get('luat.doan-phi'),
    deductions: get('luat.giam-tru'),
    brackets: get('luat.bieu-thue'),
    mealCap: get('luat.tran-tien-an'),
    clothingCap: get('luat.tran-trang-phuc'),
    probationLimits: get('luat.thu-viec-toi-da'),
    overtimeLimits: get('luat.gioi-han-lam-them'),
  };
  return {
    baseSalary: base.value,
    socialCap: caps.value.social * base.value,
    unemploymentCapMultiplier: caps.value.unemployment,
    flatRate: flat.value.rate,
    flatThreshold: flat.value.threshold,
    zoneMinimums: resolved.zoneMinimums.value,
    employeeRates: resolved.employeeRates.value,
    companyRates: resolved.companyRates.value,
    unionFund: resolved.unionFund.value,
    unionFee: resolved.unionFee.value,
    deductions: resolved.deductions.value,
    brackets: resolved.brackets.value,
    mealCap: resolved.mealCap.value,
    clothingCap: resolved.clothingCap.value,
    probationLimits: resolved.probationLimits.value,
    overtimeLimits: resolved.overtimeLimits.value,
    used: [base, caps, flat, ...Object.values(resolved)],
  };
}
