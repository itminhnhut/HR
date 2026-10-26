import { foldVietnamese } from '@careers/shared';
import type { CategoryColor } from '../../lib/colors';
import type { IconName } from '../../ui/icons';

/**
 * An icon (and colour) for one line of a job's lists, picked by keywords (no accents, whole words), so HR keeps
 * typing the lists as before. First matching rule wins; lines no rule knows get the fallback.
 */
export interface ItemLook {
  icon: IconName;
  color: CategoryColor;
}

type Rule = [IconName, CategoryColor, string[]];

const REQUIREMENT_RULES: Rule[] = [
  ['globe', 'teal', ['tieng anh', 'ngoai ngu', 'tieng nhat', 'tieng trung', 'tieng han', 'ielts', 'toeic', 'english']],
  ['cap', 'violet', ['tot nghiep', 'bang', 'dai hoc', 'cao dang', 'trung cap', 'chuyen nganh', 'chung chi']],
  ['briefcase', 'blue', ['kinh nghiem', 'nam', 'da tung', 'tung lam']],
  ['laptop', 'teal', ['excel', 'tin hoc', 'word', 'may tinh', 'phan mem', 'crm', 'office', 'google sheets']],
  ['chat', 'rose', ['giao tiep', 'thuyet phuc', 'dam phan', 'thuyet trinh', 'ky nang mem', 'trinh bay']],
  ['pin', 'emerald', ['xe may', 'di lai', 'cong tac', 'khu vuc', 'gan']],
  [
    'star',
    'amber',
    ['chu dong', 'trach nhiem', 'cham chi', 'cau tien', 'nhiet tinh', 'ap luc', 'tinh than', 'trung thuc'],
  ],
];

const BENEFIT_RULES: Rule[] = [
  ['award', 'emerald', ['thuong', 'hoa hong', 'bonus', 'kpi', 'thang 13']],
  ['money', 'emerald', ['luong', 'thu nhap', 'phu cap', 'gui xe', 'xang xe', 'di lai']],
  ['shield', 'blue', ['bao hiem', 'bhxh', 'bhyt', 'bhtn']],
  ['heart', 'rose', ['suc khoe', 'kham']],
  ['plane', 'teal', ['du lich', 'nghi mat']],
  ['users', 'rose', ['team building', 'teambuilding', 'hoat dong', 'su kien', 'party']],
  ['gift', 'rose', ['sinh nhat', 'qua']],
  ['cap', 'violet', ['dao tao', 'hoc', 'khoa hoc', 'mentor']],
  ['trend', 'violet', ['thang tien', 'lo trinh', 'phat trien', 'tang luong']],
  ['laptop', 'teal', ['laptop', 'may tinh']],
  ['phone', 'teal', ['dien thoai']],
  ['coffee', 'amber', ['an trua', 'com trua', 'tra', 'ca phe', 'an uong']],
  ['clock', 'amber', ['linh hoat', 'gio lam']],
  ['calendar', 'amber', ['nghi', 'phep', 'le']],
];

const words = (text: string) =>
  ` ${foldVietnamese(text)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;

function pick(rules: Rule[], text: string, fallback: ItemLook): ItemLook {
  const folded = words(text);
  const rule = rules.find(([, , keywords]) => keywords.some((kw) => folded.includes(` ${kw} `)));
  return rule ? { icon: rule[0], color: rule[1] } : fallback;
}

export const requirementLook = (text: string): ItemLook =>
  pick(REQUIREMENT_RULES, text, { icon: 'check', color: 'emerald' });

/**
 * Benefits: pay rules before "tăng lương" (growth) on purpose, as "Lương tháng 13" is pay; a line that starts
 * with the insurance ("BHXH ... đóng trên lương") is insurance even though it mentions pay.
 */
export function benefitLook(text: string): ItemLook {
  if (/^ (bhxh|bhyt|bhtn|bao hiem)\b/.test(words(text))) return { icon: 'shield', color: 'blue' };
  return pick(BENEFIT_RULES, text, { icon: 'check', color: 'emerald' });
}
