import type { ContractType } from './defaults-company.js';

/** D13 (câu 26): region, then contract type in the order of Cấu hình › Loại HĐ, then block (BO before KD), then code. */

export interface OrderedRow {
  code: string;
  /** The region's position in the timesheet's region list (HCM before HN). */
  regionOrder: number;
  contractTypeId: string | null;
  block: string | null;
}

const BLOCK_ORDER = ['BO', 'KD'];

const rank = (list: readonly string[], value: string | null) => {
  const i = value === null ? -1 : list.indexOf(value);
  return i === -1 ? list.length : i;
};

export function sortPayrollRows<T extends OrderedRow>(rows: readonly T[], contractTypes: readonly ContractType[]): T[] {
  const typeIds = contractTypes.map((t) => t.id);
  return [...rows].sort(
    (a, b) =>
      a.regionOrder - b.regionOrder ||
      rank(typeIds, a.contractTypeId) - rank(typeIds, b.contractTypeId) ||
      rank(BLOCK_ORDER, a.block) - rank(BLOCK_ORDER, b.block) ||
      a.code.localeCompare(b.code, undefined, { numeric: true }),
  );
}
