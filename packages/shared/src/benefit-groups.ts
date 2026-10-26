import { foldVietnamese } from './format.js';

/**
 * Sorts a job's benefits ("Quyền lợi") into a few themes so a long list reads at a glance. Matching is by
 * keywords (no accents, whole words), so HR keeps typing benefits as before.
 */

export type BenefitGroupKey = 'income' | 'insurance' | 'leave' | 'growth' | 'activities' | 'equipment' | 'other';

export interface BenefitGroup {
  key: BenefitGroupKey;
  title: string;
  items: string[];
}

const TITLES: Record<BenefitGroupKey, string> = {
  income: 'Thu nhập',
  insurance: 'Bảo hiểm & sức khoẻ',
  leave: 'Nghỉ ngơi',
  growth: 'Phát triển',
  activities: 'Hoạt động',
  equipment: 'Thiết bị & phụ cấp',
  other: 'Khác',
};

/** Display order. */
const ORDER: BenefitGroupKey[] = ['income', 'insurance', 'leave', 'growth', 'activities', 'equipment', 'other'];

/**
 * Checked in this order, first match wins: pay before insurance ("BHXH trên lương" is insurance, but
 * "Lương tháng 13, thưởng Tết" is pay), and leave last ("Nghỉ" words are common elsewhere).
 */
const KEYWORDS: [BenefitGroupKey, string[]][] = [
  ['income', ['luong', 'thuong', 'hoa hong', 'thu nhap', 'bonus', 'kpi', 'tang luong']],
  ['insurance', ['bao hiem', 'bhxh', 'bhyt', 'bhtn', 'suc khoe', 'kham']],
  ['growth', ['dao tao', 'hoc', 'hoc phi', 'lo trinh', 'thang tien', 'phat trien', 'khoa hoc', 'mentor']],
  [
    'activities',
    ['du lich', 'team building', 'teambuilding', 'hoat dong', 'su kien', 'party', 'sinh nhat', 'nghi mat'],
  ],
  ['equipment', ['laptop', 'may tinh', 'dien thoai', 'phu cap', 'an trua', 'com trua', 'gui xe', 'di lai', 'xang xe']],
  ['leave', ['nghi', 'phep', 'le', 'tet']],
];

const words = (text: string) =>
  ` ${foldVietnamese(text)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;

/** The theme of one benefit line. */
export function benefitGroupOf(benefit: string): BenefitGroupKey {
  const text = words(benefit);
  // "Lương ..." items belong to income even when they also mention BHXH; "BHXH ... trên lương" is insurance.
  if (/^ (bhxh|bhyt|bhtn|bao hiem)\b/.test(text)) return 'insurance';
  for (const [key, list] of KEYWORDS) {
    if (list.some((kw) => text.includes(` ${kw} `))) return key;
  }
  return 'other';
}

/** Themed groups in display order; an empty list when grouping would not help (5 benefits or fewer). */
export function groupBenefits(benefits: readonly string[]): BenefitGroup[] {
  if (benefits.length <= 5) return [];
  const byKey = new Map<BenefitGroupKey, string[]>();
  for (const benefit of benefits) {
    const key = benefitGroupOf(benefit);
    byKey.set(key, [...(byKey.get(key) ?? []), benefit]);
  }
  return ORDER.filter((key) => byKey.has(key)).map((key) => ({ key, title: TITLES[key], items: byKey.get(key) ?? [] }));
}
