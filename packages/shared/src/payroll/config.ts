import { componentsFor, contractTypesFor } from './components.js';
import type { ContractType, PayComponent } from './defaults-company.js';
import { lawParamsFor, type LawParams, type PayrollDates } from './params.js';
import type { RoundingMode } from './rational.js';
import type { Resolved, SettingRow } from './setting-core.js';
import { settingFor, type SettingKey, type SettingValue } from './settings.js';

/** Everything the engine reads for one person in one payroll month, each value from its versioned setting. */
export interface PayrollConfig {
  personId: string | null;
  /** The rows this was read from, so a review can tell a person's override from everyone's value. */
  rows: readonly SettingRow[];
  dates: PayrollDates;
  components: PayComponent[];
  contractTypes: ContractType[];
  law: LawParams;
  rules: {
    probationRate: number;
    hoursPerDay: number;
    overtimeRates: { weekday: number; restDay: number; holiday: number };
    /** Hours one rest-day or holiday overtime day counts for the hour limits. */
    restDayHours: number;
    insuranceCount: SettingValue<'quy-tac.dem-ngay-bh'>;
    /** (19) by block when HR typed nothing; a person without a block goes by KD. */
    kpiByBlock: SettingValue<'quy-tac.kpi-theo-khoi'>;
    kpiOfficialByDays: boolean;
    grossWithKpi: boolean;
  };
  options: {
    rounding: RoundingMode;
    flatBase: SettingValue<'tuy-chon.d02'>;
    unionFund: SettingValue<'tuy-chon.d03'>;
    healthWhenNotSocial: SettingValue<'tuy-chon.d04'>;
    overtimeExempt: SettingValue<'tuy-chon.d05'>;
    kpiSplit: SettingValue<'tuy-chon.d06'>;
    workingDays: SettingValue<'tuy-chon.d07'>;
    leavePayout: SettingValue<'tuy-chon.d08'>;
    commitment: SettingValue<'tuy-chon.d09'>;
    afterLeaving: SettingValue<'tuy-chon.d10'>;
    sundayWork: SettingValue<'tuy-chon.d12'>;
    insuranceAgreed: SettingValue<'tuy-chon.d15'>;
  };
  /** Every company setting version used, for the approval snapshot (R4). */
  used: Resolved<unknown>[];
}

const RULE_KEYS = {
  probationRate: 'quy-tac.ty-le-thu-viec',
  hoursPerDay: 'quy-tac.gio-mot-ngay',
  overtimeRates: 'quy-tac.he-so-lam-them',
  restDayHours: 'quy-tac.gio-cong-ngay-nghi',
  insuranceCount: 'quy-tac.dem-ngay-bh',
  kpiByBlock: 'quy-tac.kpi-theo-khoi',
  kpiOfficialByDays: 'quy-tac.kpi-chinh-thuc-theo-ngay',
  grossWithKpi: 'quy-tac.gross-gom-kpi',
} as const satisfies Record<keyof PayrollConfig['rules'], SettingKey>;

const OPTION_KEYS = {
  rounding: 'tuy-chon.d01',
  flatBase: 'tuy-chon.d02',
  unionFund: 'tuy-chon.d03',
  healthWhenNotSocial: 'tuy-chon.d04',
  overtimeExempt: 'tuy-chon.d05',
  kpiSplit: 'tuy-chon.d06',
  workingDays: 'tuy-chon.d07',
  leavePayout: 'tuy-chon.d08',
  commitment: 'tuy-chon.d09',
  afterLeaving: 'tuy-chon.d10',
  sundayWork: 'tuy-chon.d12',
  insuranceAgreed: 'tuy-chon.d15',
} as const satisfies Record<keyof PayrollConfig['options'], SettingKey>;

type ValuesOf<T extends Readonly<Record<string, SettingKey>>> = { -readonly [F in keyof T]: SettingValue<T[F]> };

/** Each field's setting read once: the values by field, and the versions read, in field order. */
function readAll<T extends Readonly<Record<string, SettingKey>>>(
  keys: T,
  read: (key: SettingKey) => Resolved<unknown>,
): { values: ValuesOf<T>; used: Resolved<unknown>[] } {
  const pairs = Object.entries(keys).map(([field, key]) => [field, read(key)] as const);
  return {
    values: Object.fromEntries(pairs.map(([field, resolved]) => [field, resolved.value])) as ValuesOf<T>,
    used: pairs.map(([, resolved]) => resolved),
  };
}

export function payrollConfigFor(
  rows: readonly SettingRow[],
  personId: string | null,
  dates: PayrollDates,
): PayrollConfig {
  const read = (key: SettingKey) => settingFor(rows, key, personId, dates.monthKey);
  const rules = readAll(RULE_KEYS, read);
  const options = readAll(OPTION_KEYS, read);
  return {
    personId,
    rows,
    dates,
    components: componentsFor(rows, personId, dates.monthKey),
    contractTypes: contractTypesFor(rows, personId, dates.monthKey),
    law: lawParamsFor(rows, dates, personId),
    rules: rules.values,
    options: options.values,
    used: [...rules.used, ...options.used],
  };
}
