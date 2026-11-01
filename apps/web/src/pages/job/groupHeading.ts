/**
 * A group heading HR typed in "Mô tả công việc" / "Yêu cầu" ("1. Quản lý đơn hàng", "2) Hải quan", "Kỹ năng"):
 * its leading number goes into the coloured chip, so the page never shows "1" twice. Text stays as HR wrote it.
 */
export interface GroupHeadingParts {
  number: string | null;
  text: string;
}

const NUMBERED = /^(\d{1,2})\s*[.)]\s+(\S.*)$/u;

export function groupHeadingParts(title: string): GroupHeadingParts {
  const match = NUMBERED.exec(title.trim());
  return match ? { number: match[1], text: match[2] } : { number: null, text: title.trim() };
}
