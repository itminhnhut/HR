import type { IconName } from '../../../ui/icons';
import type { Tone } from './tone';

/** One area of the admin: the menu and the page heading read the same icon and colour from here. */
export interface HrSection {
  to: string;
  label: string;
  icon: IconName;
  tone: Tone;
  /** Match only the exact path (the overview). */
  end?: boolean;
  /** Shows how many new applications wait. */
  badge?: boolean;
  /** Only for HR with the payroll right (spec-luong.md 2 (1)). */
  needsPayroll?: boolean;
}

export const HR_SECTIONS: readonly HrSection[] = [
  { to: '/hr', label: 'Tổng quan', icon: 'layout', tone: 'blue', end: true },
  { to: '/hr/tin', label: 'Tin tuyển dụng', icon: 'briefcase', tone: 'orange' },
  { to: '/hr/ho-so', label: 'Hồ sơ ứng viên', icon: 'inbox', tone: 'sky', badge: true },
  { to: '/hr/duyet', label: 'Sếp duyệt', icon: 'checkSquare', tone: 'green' },
  { to: '/hr/cham-cong', label: 'Chấm công', icon: 'calendar', tone: 'red' },
  { to: '/hr/luong', label: 'Lương', icon: 'money', tone: 'lime', needsPayroll: true },
  { to: '/hr/tin-tuc', label: 'Tin tức', icon: 'newspaper', tone: 'rose' },
  { to: '/hr/mau-tin', label: 'Mẫu tin', icon: 'fileText', tone: 'teal' },
  { to: '/hr/mau-thu', label: 'Mẫu thư', icon: 'mail', tone: 'amber' },
  { to: '/hr/tai-khoan', label: 'Tài khoản HR', icon: 'users', tone: 'slate' },
];

/** The menu one HR sees: Lương only with the payroll right. */
export const visibleSections = (canPayroll: boolean): readonly HrSection[] =>
  HR_SECTIONS.filter((section) => !section.needsPayroll || canPayroll);

/** "Tin tuyển dụng" stays active while editing a job under /hr/tin/…. */
export function isSectionActive(section: HrSection, pathname: string): boolean {
  if (section.end) return pathname === section.to || pathname === `${section.to}/`;
  // A whole path segment: /hr/tin-tuc is not under /hr/tin.
  return pathname === section.to || pathname.startsWith(`${section.to}/`);
}

export function sectionOf(pathname: string): HrSection | null {
  return [...HR_SECTIONS].reverse().find((section) => isSectionActive(section, pathname)) ?? null;
}
