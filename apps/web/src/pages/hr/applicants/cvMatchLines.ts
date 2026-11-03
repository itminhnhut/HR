import type { MatchItem } from '@careers/shared';

/**
 * A line of a result. `counted` (false for soft lines, bonuses and repeats) arrives with the scoring rules of
 * fix/cv-match-accuracy and is absent on older results, so a line without it simply goes by its verdict.
 */
export type MatchLine = MatchItem & { counted?: boolean; section?: 'duties' | 'preferred' };

export type MatchTab = 'met' | 'unmet' | 'skipped';

export const MATCH_TABS: { key: MatchTab; label: string; short: string; empty: string }[] = [
  { key: 'met', label: 'Đạt', short: 'đạt', empty: 'Chưa có yêu cầu nào đạt.' },
  { key: 'unmet', label: 'Không đạt', short: 'không đạt', empty: 'Không có yêu cầu nào không đạt.' },
  { key: 'skipped', label: 'Không chấm', short: 'không chấm', empty: 'Hệ thống đã chấm hết các yêu cầu.' },
];

export function tabOf(line: MatchLine): MatchTab {
  if (line.verdict === 'unknown') return 'skipped';
  // Job description lines and bonuses stay out of the percent, yet still say what the CV shows.
  if (line.counted === false && !line.section) return 'skipped';
  return line.verdict;
}

/** One tab's lines by the part of the job they come from: "Yêu cầu" first, the part that decides. */
export function bySection(lines: readonly MatchLine[]): { title: string; lines: MatchLine[] }[] {
  return [
    { title: 'Yêu cầu', lines: lines.filter((l) => !l.section) },
    { title: 'Mô tả công việc', lines: lines.filter((l) => l.section === 'duties') },
    { title: 'Điểm cộng', lines: lines.filter((l) => l.section === 'preferred') },
  ].filter((part) => part.lines.length > 0);
}

export function groupLines(lines: readonly MatchLine[]): Record<MatchTab, MatchLine[]> {
  return {
    met: lines.filter((l) => tabOf(l) === 'met'),
    unmet: lines.filter((l) => tabOf(l) === 'unmet'),
    skipped: lines.filter((l) => tabOf(l) === 'skipped'),
  };
}

/** What HR most needs to see first: why not, if there is any. */
export const defaultTab = (groups: Record<MatchTab, MatchLine[]>): MatchTab =>
  groups.unmet.length > 0 ? 'unmet' : 'met';

/** The explanation under a line. Every line left out says why, even if the scorer gave no reason. */
export function reasonOf(line: MatchLine): string | null {
  // For a judged met line the CV quote says it all ("CV có Excel" adds nothing).
  if (tabOf(line) === 'met' && line.evidence) return null;
  if (line.reason) return line.reason;
  if (line.counted === false) return 'Không tính vào %: kỹ năng mềm, điểm cộng hoặc dòng lặp lại.';
  return line.verdict === 'unknown' ? 'Không chấm được từ CV, HR tự đánh giá.' : null;
}

/** How many of the requirements a CV can show were judged; null for results stored before lines were marked. */
export function coverageOf(lines: readonly MatchLine[]): { judged: number; total: number } | null {
  if (lines.every((l) => l.counted === undefined)) return null;
  const counted = lines.filter((l) => l.counted);
  return { judged: counted.filter((l) => l.verdict !== 'unknown').length, total: counted.length };
}
