import { errorMessage } from '../../parts';

/** One fact saved for many people (owner's rule c): one request per person, in order, never stopping at a refusal. */

export interface BulkPerson {
  employeeId: string;
  code: string;
  fullName: string;
}

export interface BulkResult {
  total: number;
  saved: number;
  /** Who was not saved, with the API's reason. */
  failed: { employeeId: string; name: string; message: string }[];
}

export async function saveForPeople(
  people: readonly BulkPerson[],
  ids: readonly string[],
  run: (employeeId: string) => Promise<unknown>,
): Promise<BulkResult> {
  const nameOf = (id: string) => {
    const person = people.find((p) => p.employeeId === id);
    return person ? `${person.code} ${person.fullName}` : id;
  };
  const failed: BulkResult['failed'] = [];
  for (const employeeId of ids) {
    try {
      await run(employeeId);
    } catch (error) {
      failed.push({ employeeId, name: nameOf(employeeId), message: errorMessage(error) });
    }
  }
  return { total: ids.length, saved: ids.length - failed.length, failed };
}

export const bulkSummary = (result: BulkResult) => `Đã lưu ${result.saved}/${result.total} người`;

/** NĐ 253/2026 Đ.8, as the yellow notice of Rà soát says it. */
export const INSURANCE_PAID_LAW =
  'File lương tháng 10 không tính thuế khoản này. Theo NĐ 253/2026 Đ.8, khoản lợi ích do người sử dụng lao động trả thay là thu nhập chịu thuế: bật "Tính thuế" để tính vào (34) và (48).';
