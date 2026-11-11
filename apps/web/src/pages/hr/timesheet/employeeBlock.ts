import { EMPLOYEE_BLOCKS, matchesQuery, type EmployeeBlock, type EmployeeDto, type EmployeeInput } from '@careers/shared';

/** Khối of a person (BO / KD): its words, the suggestion from the department, and the bulk change. */

export const BLOCK_LABELS: Record<EmployeeBlock, string> = { BO: 'BO — Văn phòng', KD: 'KD — Kinh doanh' };
export const BLOCK_OPTIONS = EMPLOYEE_BLOCKS.map((value) => ({ value, label: BLOCK_LABELS[value] }));
export const BLOCK_HINT = 'Dùng để tính % KPI ở bảng lương: BO tự tính theo ngày công, KD do HR nhập';
export const MISSING_BLOCK = 'Thiếu khối';

export const asBlock = (value: string): EmployeeBlock | null => EMPLOYEE_BLOCKS.find((b) => b === value) ?? null;

/** How a department name suggests a block: the first rule with a word in the name wins, else `otherwise`. */
export interface BlockRule {
  rules: readonly { block: EmployeeBlock; words: readonly string[] }[];
  otherwise: EmployeeBlock;
}

/** Owner's default: a sales department is KD, every other one BO. Change the words here. */
export const DEFAULT_BLOCK_RULE: BlockRule = { rules: [{ block: 'KD', words: ['kinh doanh', 'sale'] }], otherwise: 'BO' };

/** The block a department suggests, case and tones ignored ("Phòng KINH DOANH", "Sales" → KD). Only ever a suggestion. */
export function suggestBlock(department: string, rule: BlockRule = DEFAULT_BLOCK_RULE): EmployeeBlock {
  const hit = rule.rules.find((r) => r.words.some((w) => matchesQuery(department, w)));
  return hit?.block ?? rule.otherwise;
}

/** What the Khối field of the form holds. */
export interface BlockChoice {
  isNew: boolean;
  /** HR picked something in the field. */
  isTouched: boolean;
  picked: string;
  department: string;
}

/** A new person nobody touched shows the suggestion, prefilled; anyone else shows what was picked. */
export const isBlockSuggested = (c: BlockChoice) => c.isNew && !c.isTouched;

/** The block the form saves: the prefilled suggestion for a new person, never a suggestion for an existing one. */
export const blockToSave = (c: BlockChoice): EmployeeBlock | null => (isBlockSuggested(c) ? suggestBlock(c.department) : asBlock(c.picked));

/** Everything the API asks for on a save, as the person is now, with another block. */
export const inputWithBlock = (p: EmployeeDto, block: EmployeeBlock): EmployeeInput => ({
  code: p.code,
  fullName: p.fullName,
  department: p.department,
  title: p.title,
  regionId: p.regionId,
  employment: p.employment,
  staffKindId: p.staffKindId,
  joinedOn: p.joinedOn,
  officialOn: p.officialOn,
  leftOn: p.leftOn,
  openingLeave: p.openingLeave,
  block,
});

export interface BulkBlockResult {
  saved: number;
  total: number;
  /** Full names of those not saved, with the reason. */
  failed: string[];
}

/** One save per person, one after the other, so a failure stops nobody else. */
export async function changeBlocks(people: readonly EmployeeDto[], block: EmployeeBlock, save: (id: string, input: EmployeeInput) => Promise<unknown>, reasonOf: (error: unknown) => string): Promise<BulkBlockResult> {
  const failed: string[] = [];
  for (const p of people) {
    try {
      await save(p.id, inputWithBlock(p, block));
    } catch (error) {
      failed.push(`${p.fullName}: ${reasonOf(error)}`);
    }
  }
  return { saved: people.length - failed.length, total: people.length, failed };
}

export const bulkResultWords = (r: BulkBlockResult) => `Đã lưu ${r.saved}/${r.total} người`;
