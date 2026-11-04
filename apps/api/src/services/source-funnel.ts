import type { RejectReason, SourceFunnelRow } from '@careers/shared';
import type { Db } from '../db/index.js';
import { applicationStatusLog } from '../db/schema.js';

type LogRow = typeof applicationStatusLog.$inferSelect;

const REACHED_INTERVIEW = new Set<string>(['interview', 'passed', 'hired']);
const REACHED_PASSED = new Set<string>(['passed', 'hired']);

function topReason(counts: ReadonlyMap<RejectReason, number>): RejectReason | null {
  const [top] = [...counts].sort((a, b) => b[1] - a[1]);
  return top?.[0] ?? null;
}

function addApplication(row: SourceFunnelRow, reasons: Map<RejectReason, number>, steps: readonly LogRow[]) {
  const reached = (set: ReadonlySet<string>) => steps.some((s) => set.has(s.toStatus));
  row.received += 1;
  if (reached(REACHED_INTERVIEW)) row.interview += 1;
  if (reached(REACHED_PASSED)) row.passed += 1;
  if (steps.some((s) => s.toStatus === 'hired')) row.hired += 1;
  const last = steps[steps.length - 1];
  if (last?.toStatus === 'rejected' && last.rejectReason) {
    reasons.set(last.rejectReason, (reasons.get(last.rejectReason) ?? 0) + 1);
  }
}

/**
 * Applications that came in during the period, per source, by how far each one ever got: someone turned down
 * after the interview still counts as interviewed. Comes from the log, so deleting applications does not change it.
 */
export async function sourceFunnel(db: Db, since: Date, until: Date): Promise<SourceFunnelRow[]> {
  const rows = await db.select().from(applicationStatusLog).orderBy(applicationStatusLog.createdAt);
  const byApplication = new Map<string, LogRow[]>();
  for (const row of rows) byApplication.set(row.applicationId, [...(byApplication.get(row.applicationId) ?? []), row]);
  const funnel = new Map<string, { row: SourceFunnelRow; reasons: Map<RejectReason, number> }>();
  for (const steps of byApplication.values()) {
    const first = steps[0];
    if (!first || first.createdAt < since || first.createdAt >= until) continue;
    const entry = funnel.get(first.source) ?? {
      row: { source: first.source, received: 0, interview: 0, passed: 0, hired: 0, topRejectReason: null },
      reasons: new Map<RejectReason, number>(),
    };
    addApplication(entry.row, entry.reasons, steps);
    funnel.set(first.source, entry);
  }
  return [...funnel.values()]
    .map(({ row, reasons }) => ({ ...row, topRejectReason: topReason(reasons) }))
    .sort((a, b) => b.hired - a.hired || b.received - a.received);
}
