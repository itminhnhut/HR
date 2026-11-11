import { PAYROLL_DATE, type HrMe, type PayrollPersonDto } from '@careers/shared';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { employees, payrollProfileAmounts } from '../db/schema.js';
import { invalid } from '../lib/http-error.js';
import { approvedMonths } from './payroll-months.js';
import { levelOn, monthsUsingLevel, personDtoOf, versionsOf, type Employee } from './payroll-profile-store.js';
import { insertLevel, logProfile } from './payroll-profiles.js';
import { dateWords, moneyWords } from './payroll-words.js';

/**
 * A new default amount for a component (L-A23): profiles keep their amounts; HR may then move the people on the old
 * default to the new one from a date, each getting a new level (or their level on that date changed while unused).
 */

const money = z.coerce.number().int().nonnegative();
const findSchema = z.object({ ngay: z.string().regex(PAYROLL_DATE), muc: money });
const applySchema = z.object({ fromOn: z.string().regex(PAYROLL_DATE), oldAmount: money, newAmount: money });

async function onAmount(db: Db, componentId: string, day: string, amount: number) {
  const people = await db.select().from(employees).orderBy(employees.code);
  const levels = await versionsOf(
    db,
    people.map((p) => p.id),
  );
  return people.flatMap((person: Employee) => {
    const own = levels.filter((l) => l.employeeId === person.id).map((l) => l.version);
    const level = levelOn(own, day);
    return level && level.amounts[componentId] === amount ? [{ person, level, levels: own }] : [];
  });
}

/** People whose level in force on `ngay` pays exactly `muc` for the component. */
export async function peopleOnDefault(db: Db, componentId: string, raw: unknown): Promise<PayrollPersonDto[]> {
  const parsed = findSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Chọn ngày và mức.', {});
  const found = await onAmount(db, componentId, parsed.data.ngay, parsed.data.muc);
  return found.map((f) => personDtoOf(f.person));
}

export async function applyDefault(
  db: Db,
  componentId: string,
  raw: unknown,
  hr: HrMe,
  now: Date,
): Promise<{ applied: number }> {
  const parsed = applySchema.safeParse(raw);
  if (!parsed.success) throw invalid('Chọn ngày, mức cũ và mức mới.', {});
  const { fromOn, oldAmount, newAmount } = parsed.data;
  const [found, approved] = await Promise.all([onAmount(db, componentId, fromOn, oldAmount), approvedMonths(db)]);
  const movable = found.filter(
    (f) => f.level.effectiveOn !== fromOn || monthsUsingLevel(f.levels, f.level, approved).length === 0,
  );
  if (movable.length === 0) return { applied: 0 };
  await db.transaction(async (tx) => {
    for (const { person, level } of movable) {
      const amounts = { ...level.amounts, [componentId]: newAmount };
      if (level.effectiveOn === fromOn) {
        await tx
          .update(payrollProfileAmounts)
          .set({ amount: newAmount })
          .where(
            and(eq(payrollProfileAmounts.profileId, level.id), eq(payrollProfileAmounts.componentId, componentId)),
          );
      } else {
        const { id: _id, createdBy: _by, createdAt: _at, ...copy } = level;
        await insertLevel(tx, person.id, { ...copy, effectiveOn: fromOn, amounts }, hr, now);
      }
    }
    const codes = movable.map((f) => f.person.code).join(', ');
    const detail = `Áp mức mặc định mới ${componentId} ${moneyWords(oldAmount)} → ${moneyWords(newAmount)} cho ${movable.length} người, từ ${dateWords(fromOn)}: ${codes}`;
    await logProfile(tx, hr, now, fromOn, 'Sửa', detail);
  });
  return { applied: movable.length };
}
