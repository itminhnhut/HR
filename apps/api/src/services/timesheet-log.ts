import type { TimesheetLogArea, TimesheetLogPageDto } from '@careers/shared';
import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { timesheetLog, timesheetPeriods } from '../db/schema.js';
import { invalid } from '../lib/http-error.js';

/** Which tab each kind of change is made in. */
const ACTIONS_OF_TAB: Record<TimesheetLogArea, readonly string[]> = {
  'bang-cong': [
    'Chấm công', 'Sửa định mức',
    'Điều chỉnh công', 'Bỏ điều chỉnh công', 'Điều chỉnh phép', 'Bỏ điều chỉnh phép',
    'Chốt kỳ', 'Chênh lệch khi chốt lại', 'Mở lại kỳ',
  ],
  nghi: ['Đăng ký nghỉ', 'Sửa đăng ký nghỉ', 'Huỷ đăng ký nghỉ'],
  'nhan-vien': ['Thêm nhân viên', 'Sửa nhân viên', 'Xoá nhân viên'],
  'cau-hinh': [
    'Thêm bộ phận', 'Sửa bộ phận', 'Xoá bộ phận',
    'Thêm loại nhân viên', 'Sửa loại nhân viên', 'Xoá loại nhân viên',
    'Thêm khu vực', 'Sửa khu vực', 'Xoá khu vực',
    'Lưu ngày lễ', 'Xoá ngày lễ',
    'Thêm loại nghỉ', 'Sửa loại nghỉ', 'Xoá loại nghỉ',
    'Thêm người duyệt', 'Xoá người duyệt',
  ],
};

const AREAS = Object.keys(ACTIONS_OF_TAB) as [TimesheetLogArea, ...TimesheetLogArea[]];
const areaOf = (action: string): TimesheetLogArea => AREAS.find((area) => ACTIONS_OF_TAB[area].includes(action)) ?? 'bang-cong';

const PAGE_SIZE = 100;

const querySchema = z.object({
  nhom: z.enum(AREAS).optional(),
  tim: z.string().trim().max(100).optional(),
  tu: z.coerce.number().int().min(0).default(0),
});

/** Typed words are looked for as they are: % and _ mean nothing here. */
const anywhere = (words: string) => `%${words.replace(/[\\%_]/g, '\\$&')}%`;

/** One change is written once per open period it touches, so the same line is read back once. */
export async function readLog(db: Db, raw: unknown): Promise<TimesheetLogPageDto> {
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) throw invalid('Không đọc được nhật ký.', {});
  const { nhom, tim, tu } = parsed.data;
  const { actor, action, detail, at, periodId } = timesheetLog;
  const words = tim ? anywhere(tim) : null;
  const rows = await db
    .select({ actor, action, detail, at, period: sql<number | null>`min(${timesheetPeriods.year} * 100 + ${timesheetPeriods.month})` })
    .from(timesheetLog)
    .leftJoin(timesheetPeriods, eq(periodId, timesheetPeriods.id))
    .where(and(nhom ? inArray(action, [...ACTIONS_OF_TAB[nhom]]) : undefined, words ? or(ilike(detail, words), ilike(actor, words), ilike(action, words)) : undefined))
    .groupBy(actor, action, detail, at)
    .orderBy(desc(at), asc(action), asc(detail))
    .limit(PAGE_SIZE + 1)
    .offset(tu);
  const lines = rows.slice(0, PAGE_SIZE).map((r) => {
    const area = areaOf(r.action);
    const month = area === 'bang-cong' && r.period ? `${Math.floor(r.period / 100)}-${String(r.period % 100).padStart(2, '0')}` : null;
    return { id: `${r.at.toISOString()}|${r.action}|${r.detail}`, actor: r.actor, action: r.action, detail: r.detail, at: r.at.toISOString(), area, periodMonth: month };
  });
  return { lines, hasMore: rows.length > PAGE_SIZE };
}
