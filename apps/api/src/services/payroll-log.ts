import {
  PAYROLL_LOG_APPROVAL_ACTIONS,
  PAYROLL_LOG_AREAS,
  type PayrollLogArea,
  type PayrollLogPageDto,
} from '@careers/shared';
import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { payrollLog } from '../db/schema.js';
import { invalid } from '../lib/http-error.js';

/** Nhật ký lương (spec-luong.md 10.2, 11.9): its own table, read only by people with the payroll right. */

/** A database or an open transaction: a line is written with the change it describes. */
type Writer = Pick<Db, 'insert'>;

export interface PayrollLogLine {
  area: PayrollLogArea;
  actor: string;
  action: string;
  detail: string;
  /** "YYYY-MM" of the payroll month it touches. */
  month: string | null;
  at: Date;
}

export async function writePayrollLog(db: Writer, line: PayrollLogLine | readonly PayrollLogLine[]): Promise<void> {
  const lines = Array.isArray(line) ? line : [line];
  if (lines.length === 0) return;
  await db.insert(payrollLog).values([...lines]);
}

const PAGE_SIZE = 100;

const querySchema = z.object({
  nhom: z.enum(PAYROLL_LOG_AREAS).optional(),
  ky: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  tim: z.string().trim().max(100).optional(),
  /** A person's code, as the lines write it ("NV01 NV A"). */
  ma: z.string().trim().min(1).max(20).optional(),
  /** Who did it, as the line names them. */
  ai: z.string().trim().min(1).max(200).optional(),
  loai: z.literal('duyet').optional(),
  tu: z.coerce.number().int().min(0).default(0),
});

/** Typed words are looked for as they are: % and _ mean nothing here. */
const anywhere = (words: string) => `%${words.replace(/[\\%_]/g, '\\$&')}%`;

/** The code as a whole word: "NV01" is not in "NV010". */
const wholeWord = (code: string) => `(^|[^[:alnum:]])${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^[:alnum:]])`;

async function actorsOf(db: Db): Promise<string[]> {
  const rows = await db.selectDistinct({ actor: payrollLog.actor }).from(payrollLog).orderBy(asc(payrollLog.actor));
  return rows.map((r) => r.actor);
}

export async function readPayrollLog(db: Db, raw: unknown): Promise<PayrollLogPageDto> {
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) throw invalid('Không đọc được nhật ký lương.', {});
  const { nhom, ky, tim, ma, ai, loai, tu } = parsed.data;
  const { area, actor, action, detail, month, at, id } = payrollLog;
  const words = tim ? anywhere(tim) : null;
  const rows = await db
    .select()
    .from(payrollLog)
    .where(
      and(
        nhom ? eq(area, nhom) : undefined,
        ky ? eq(month, ky) : undefined,
        words ? or(ilike(detail, words), ilike(actor, words), ilike(action, words)) : undefined,
        ma ? sql`${detail} ~* ${wholeWord(ma)}` : undefined,
        ai ? eq(actor, ai) : undefined,
        loai ? inArray(action, [...PAYROLL_LOG_APPROVAL_ACTIONS]) : undefined,
      ),
    )
    .orderBy(desc(at), desc(id))
    .limit(PAGE_SIZE + 1)
    .offset(tu);
  const lines = rows.slice(0, PAGE_SIZE).map((r) => ({
    id: r.id,
    area: r.area,
    actor: r.actor,
    action: r.action,
    detail: r.detail,
    month: r.month,
    at: r.at.toISOString(),
  }));
  return { lines, hasMore: rows.length > PAGE_SIZE, actors: await actorsOf(db) };
}
