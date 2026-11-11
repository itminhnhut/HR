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

export function payrollConfigFor(
  rows: readonly SettingRow[],
  personId: string | null,
  dates: PayrollDates,
): PayrollConfig {
  const used: Resolved<unknown>[] = [];
  const get = <K extends SettingKey>(key: K): SettingValue<K> => {
    const resolved = settingFor(rows, key, personId, dates.monthKey);
    used.push(resolved);
    return resolved.value;
  };
  const rules = {
    probationRate: get('quy-tac.ty-le-thu-viec'),
    hoursPerDay: get('quy-tac.gio-mot-ngay'),
    overtimeRates: get('quy-tac.he-so-lam-them'),
    restDayHours: get('quy-tac.gio-cong-ngay-nghi'),
    insuranceCount: get('quy-tac.dem-ngay-bh'),
    kpiByBlock: get('quy-tac.kpi-theo-khoi'),
    kpiOfficialByDays: get('quy-tac.kpi-chinh-thuc-theo-ngay'),
    grossWithKpi: get('quy-tac.gross-gom-kpi'),
  };
  const options = {
    rounding: get('tuy-chon.d01'),
    flatBase: get('tuy-chon.d02'),
    unionFund: get('tuy-chon.d03'),
    healthWhenNotSocial: get('tuy-chon.d04'),
    overtimeExempt: get('tuy-chon.d05'),
    kpiSplit: get('tuy-chon.d06'),
    workingDays: get('tuy-chon.d07'),
    leavePayout: get('tuy-chon.d08'),
    commitment: get('tuy-chon.d09'),
    afterLeaving: get('tuy-chon.d10'),
    sundayWork: get('tuy-chon.d12'),
    insuranceAgreed: get('tuy-chon.d15'),
  };
  return {
    personId,
    rows,
    dates,
    components: componentsFor(rows, personId, dates.monthKey),
    contractTypes: contractTypesFor(rows, personId, dates.monthKey),
    law: lawParamsFor(rows, dates, personId),
    rules,
    options,
    used,
  };
}
