import { linkSite } from './cvLabel';
import {
  APPLICATION_STATUS_LABEL,
  rejectReasonLabel,
  REJECT_REASON_KEYS,
  type ApplicationDetailDto,
  type ApplicationStatus,
  type ActivityDto,
  type RejectReason,
} from '@careers/shared';
import type { IconName } from '../../../ui/icons';
import { interviewLabel } from './InterviewField';

export interface ActivityLine {
  icon: IconName;
  title: string;
  /** "Hẹn phỏng vấn → Đạt", when there is a before and an after. */
  change: string | null;
  note: string | null;
  actor: string;
  at: string;
}

const statusWord = (status: string | null) =>
  status ? (APPLICATION_STATUS_LABEL[status as ApplicationStatus] ?? status) : 'Không có';

const isRejectReason = (value: string | null): value is RejectReason => REJECT_REASON_KEYS.some((key) => key === value);

const CONTACT_FIELD: Record<string, string> = {
  fullName: 'Sửa họ tên',
  gender: 'Sửa giới tính',
  phone: 'Sửa số điện thoại',
  email: 'Sửa email',
  source: 'Sửa nguồn hồ sơ',
};

/** HR's gender over the CV's: none means the CV's own. */
const genderWord = (v: string | null) => (v === 'male' ? 'Nam' : v === 'female' ? 'Nữ' : 'Theo CV');
const timeWord = (iso: string | null) => (iso ? interviewLabel(iso) : 'Chưa chọn');

/** A note line says what was done to the entry; older lines, from before the timeline, have no detail. */
const NOTE_TITLE: Record<string, string> = { add: 'Thêm ghi chú', edit: 'Sửa ghi chú', delete: 'Xoá ghi chú' };

function fromActivity(entry: ActivityDto): ActivityLine {
  const base = { actor: entry.actor, at: entry.at, change: null, note: null };
  if (entry.kind === 'status') {
    return {
      ...base,
      icon: 'layers',
      title: entry.detail === 'undo' ? 'Hoàn tác trạng thái' : 'Đổi trạng thái',
      change: `${statusWord(entry.from)} → ${statusWord(entry.to)}`,
      note: isRejectReason(entry.detail) ? `Lý do: ${rejectReasonLabel(entry.detail)}` : null,
    };
  }
  if (entry.kind === 'interview') {
    return {
      ...base,
      icon: 'calendar',
      title: 'Đổi giờ phỏng vấn',
      change: `${timeWord(entry.from)} → ${timeWord(entry.to)}`,
    };
  }
  if (entry.kind === 'contact') {
    const title = CONTACT_FIELD[entry.detail ?? ''] ?? 'Sửa thông tin liên hệ';
    const word = entry.detail === 'gender' ? genderWord : (v: string | null) => v ?? 'Trống';
    return { ...base, icon: 'user', title, change: `${word(entry.from)} → ${word(entry.to)}` };
  }
  return { ...base, icon: 'fileText', title: NOTE_TITLE[entry.detail ?? ''] ?? 'Sửa ghi chú' };
}

const previousCvWords = (previous: string) => {
  const site = linkSite(previous);
  return site ? `link ${site}` : previous;
};

/** Everything that happened to this application, newest first: the log, CV changes, letters, and how it came in. */
export function activityLines(app: ApplicationDetailDto): ActivityLine[] {
  const empty = { change: null, note: null };
  const lines: ActivityLine[] = [
    ...app.activity.map(fromActivity),
    ...app.cvHistory.map((cv) => ({
      ...empty,
      icon: 'file' as const,
      title: 'Đổi CV',
      note: cv.previous ? `CV trước: ${previousCvWords(cv.previous)}` : null,
      actor: cv.by,
      at: cv.at,
    })),
    ...app.contacts.map((contact) => ({
      ...empty,
      icon: 'mail' as const,
      title: 'Soạn thư',
      actor: contact.hrName,
      at: contact.createdAt,
    })),
    {
      ...empty,
      icon: 'inbox' as const,
      title: app.addedBy ? 'HR thêm hồ sơ' : 'Ứng viên nộp hồ sơ',
      actor: app.addedBy ?? app.fullName,
      at: app.createdAt,
    },
  ];
  return lines.sort((a, b) => b.at.localeCompare(a.at));
}
