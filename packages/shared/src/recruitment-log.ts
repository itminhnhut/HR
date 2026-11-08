import { z } from 'zod';
import { NOTE_MAX } from './validation.js';

/** "Nhật ký tuyển dụng" (spec-nhat-ky-ho-so.md): the groups its filter offers, as they read in the address. */
export const RECRUITMENT_LOG_GROUPS = [
  'ho-so',
  'trang-thai',
  'phong-van',
  'ghi-chu',
  'lien-he',
  'sep-duyet',
  'cham-cv',
  'nguon',
] as const;

export type RecruitmentLogGroup = (typeof RECRUITMENT_LOG_GROUPS)[number];

export const RECRUITMENT_LOG_GROUP_LABEL: Record<RecruitmentLogGroup, string> = {
  'ho-so': 'Hồ sơ',
  'trang-thai': 'Trạng thái',
  'phong-van': 'Lịch phỏng vấn',
  'ghi-chu': 'Ghi chú',
  'lien-he': 'Liên hệ',
  'sep-duyet': 'Sếp duyệt',
  'cham-cv': 'Chấm CV',
  nguon: 'Nguồn',
};

/** One thing done in the applicants area: who, what, on which application, from what to what. */
export interface RecruitmentLogLineDto {
  id: string;
  /** Null for a source, and once the application is deleted. */
  applicationId: string | null;
  /** Dropped when the application is deleted: the line then reads "Ứng viên đã xoá". */
  candidateName: string | null;
  jobTitle: string | null;
  /** The application this line was about has been deleted. */
  isDeleted: boolean;
  group: RecruitmentLogGroup;
  action: string;
  actor: string;
  from: string | null;
  to: string | null;
  detail: string | null;
  at: string;
}

export interface RecruitmentLogPageDto {
  lines: RecruitmentLogLineDto[];
  hasMore: boolean;
}

/** One entry of "Ghi chú nội bộ"; anyone in HR may edit or delete it, the log keeps the old words. */
export interface ApplicationNoteDto {
  id: string;
  body: string;
  /** Null for an old note whose author was never written down. */
  createdBy: string | null;
  createdAt: string;
  /** Equals createdAt until someone edits it. */
  updatedAt: string;
}

export const noteInputSchema = z.object({
  body: z.string().trim().min(1, 'Ghi chú đang trống.').max(NOTE_MAX, `Ghi chú tối đa ${NOTE_MAX} ký tự.`),
});

export type NoteInput = z.infer<typeof noteInputSchema>;

/** "Gọi" and "Zalo" open the phone's own apps; the press itself is what the log can keep. */
export const reachSchema = z.object({ via: z.enum(['call', 'zalo'], { message: 'Chọn gọi hoặc Zalo.' }) });
export type ReachInput = z.input<typeof reachSchema>;

