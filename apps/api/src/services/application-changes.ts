import { rejectReasonLabel, type applicationUpdateSchema, type HrMe } from '@careers/shared';
import type { Db } from '../db/index.js';
import type { Application } from '../db/schema.js';
import { actorOf, logActivity } from './activity.js';
import { logRecruitment } from './recruitment-log.js';

type ApplicationUpdate = ReturnType<typeof applicationUpdateSchema.parse>;

const MODE_WORD: Record<string, string> = { onsite: 'Tại văn phòng', online: 'Online' };
const modeWord = (mode: string | null) => (mode ? (MODE_WORD[mode] ?? mode) : 'Chưa chọn');

/** "Lương: không phù hợp" plus what HR wrote, or nothing. */
function reasonText(app: Pick<Application, 'rejectReason' | 'rejectNote'>): string {
  const label = app.rejectReason ? rejectReasonLabel(app.rejectReason) : 'Chưa ghi lý do';
  return app.rejectNote ? `${label}: ${app.rejectNote}` : label;
}

interface Change {
  before: Application;
  after: Application;
  input: ApplicationUpdate;
  actor: string;
  at: Date;
}

/** What only "Nhật ký tuyển dụng" keeps: how and where the interview is, and a new reason while it stays rejected. */
async function logDetails(db: Db, { before, after, input, actor, at }: Change): Promise<void> {
  const base = { applicationId: before.id, actor, at };
  if (input.interviewMode !== undefined && !input.isUndo && before.interviewMode !== after.interviewMode) {
    const words = { from: modeWord(before.interviewMode), to: modeWord(after.interviewMode) };
    await logRecruitment(db, { ...base, group: 'phong-van', action: 'Đổi hình thức phỏng vấn', ...words });
  }
  if (input.meetingUrl !== undefined && !input.isUndo && before.meetingUrl !== after.meetingUrl) {
    const words = { from: before.meetingUrl ?? 'Trống', to: after.meetingUrl ?? 'Trống' };
    await logRecruitment(db, { ...base, group: 'phong-van', action: 'Đổi link phỏng vấn', ...words });
  }
  const staysRejected = before.status === 'rejected' && after.status === 'rejected';
  if (staysRejected && reasonText(before) !== reasonText(after)) {
    const words = { from: reasonText(before), to: reasonText(after) };
    await logRecruitment(db, { ...base, group: 'trang-thai', action: 'Sửa lý do chưa phù hợp', ...words });
  }
}

/** What a PATCH of an application did, for "Nhật ký hồ sơ" and "Nhật ký tuyển dụng". A note logs itself. */
export async function logChanges(
  db: Db,
  before: Application,
  after: Application,
  input: ApplicationUpdate,
  hr: HrMe,
  now: Date,
): Promise<void> {
  const base = { applicationId: before.id, actor: actorOf(hr), at: now };
  if (after.status !== before.status) {
    const detail = input.isUndo ? 'undo' : (after.rejectReason ?? null);
    await logActivity(db, { ...base, kind: 'status', from: before.status, to: after.status, detail });
  }
  const timeBefore = before.interviewAt?.toISOString() ?? null;
  const timeAfter = after.interviewAt?.toISOString() ?? null;
  if (input.interviewAt !== undefined && !input.isUndo && timeBefore !== timeAfter) {
    await logActivity(db, { ...base, kind: 'interview', from: timeBefore, to: timeAfter });
  }
  await logDetails(db, { before, after, input, actor: base.actor, at: now });
}
