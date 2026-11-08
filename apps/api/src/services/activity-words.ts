import {
  APPLICATION_STATUS_LABEL,
  REJECT_REASON_KEYS,
  rejectReasonLabel,
  type ActivityKind,
  type ApplicationStatus,
  type RejectReason,
} from '@careers/shared';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { applicationSources } from '../db/schema.js';
import type { RecruitmentEntry } from './recruitment-log.js';
import { viTime } from './review-model.js';

/** A line of "Nhật ký hồ sơ" said in the words of "Nhật ký tuyển dụng" (spec-nhat-ky-ho-so.md). */

export interface ActivityFacts {
  kind: ActivityKind;
  from?: string | null;
  to?: string | null;
  detail?: string | null;
}

type Words = Pick<RecruitmentEntry, 'group' | 'action' | 'from' | 'to' | 'detail'>;

const isStatus = (v: string | null | undefined): v is ApplicationStatus =>
  !!v && Object.hasOwn(APPLICATION_STATUS_LABEL, v);
const isRejectReason = (v: string | null | undefined): v is RejectReason => REJECT_REASON_KEYS.some((k) => k === v);

export const statusWord = (v: string | null | undefined) => (isStatus(v) ? APPLICATION_STATUS_LABEL[v] : (v ?? null));
export const timeWord = (iso: string | null | undefined) => (iso ? viTime(new Date(iso)) : 'Chưa chọn');
export const reasonWord = (v: string | null | undefined) =>
  isRejectReason(v) ? `Lý do: ${rejectReasonLabel(v)}` : null;

const CONTACT_ACTION: Record<string, string> = {
  fullName: 'Sửa họ tên',
  phone: 'Sửa số điện thoại',
  gender: 'Sửa giới tính',
  email: 'Sửa email',
  source: 'Sửa nguồn hồ sơ',
};

/** detail of a note line: what was done to the entry. */
const NOTE_ACTION: Record<string, string> = { add: 'Thêm ghi chú', edit: 'Sửa ghi chú', delete: 'Xoá ghi chú' };

const genderWord = (v: string | null | undefined) => (v === 'male' ? 'Nam' : v === 'female' ? 'Nữ' : 'Theo CV');

export async function sourceName(db: Pick<Db, 'select'>, key: string | null | undefined): Promise<string | null> {
  if (!key) return null;
  const [row] = await db
    .select({ name: applicationSources.name })
    .from(applicationSources)
    .where(eq(applicationSources.key, key));
  return row?.name ?? key;
}

async function contactWords(db: Pick<Db, 'select'>, facts: ActivityFacts): Promise<Words> {
  const field = facts.detail ?? '';
  const action = CONTACT_ACTION[field] ?? 'Sửa thông tin liên hệ';
  if (field === 'gender') return { group: 'ho-so', action, from: genderWord(facts.from), to: genderWord(facts.to) };
  if (field === 'source') {
    return { group: 'ho-so', action, from: await sourceName(db, facts.from), to: await sourceName(db, facts.to) };
  }
  return { group: 'ho-so', action, from: facts.from || 'Trống', to: facts.to || 'Trống' };
}

export async function activityWords(db: Pick<Db, 'select'>, facts: ActivityFacts): Promise<Words> {
  if (facts.kind === 'status') {
    const action = facts.detail === 'undo' ? 'Hoàn tác trạng thái' : 'Đổi trạng thái';
    return {
      group: 'trang-thai',
      action,
      from: statusWord(facts.from),
      to: statusWord(facts.to),
      detail: reasonWord(facts.detail),
    };
  }
  if (facts.kind === 'interview') {
    return { group: 'phong-van', action: 'Đổi giờ phỏng vấn', from: timeWord(facts.from), to: timeWord(facts.to) };
  }
  if (facts.kind === 'contact') return contactWords(db, facts);
  return { group: 'ghi-chu', action: NOTE_ACTION[facts.detail ?? ''] ?? 'Sửa ghi chú', from: facts.from, to: facts.to };
}
