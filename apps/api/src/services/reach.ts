import { fieldErrors, reachSchema, type HrMe } from '@careers/shared';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { applications } from '../db/schema.js';
import { invalid, notFound } from '../lib/http-error.js';
import { isUuid } from '../lib/request.js';
import { actorOf } from './activity.js';
import { logRecruitment } from './recruitment-log.js';

const ACTION = { call: 'Gọi điện', zalo: 'Nhắn Zalo' } as const;

/** "Gọi" or "Zalo" was pressed on an application: logged under "Liên hệ" with the number reached. */
export async function logReach(db: Db, id: string, raw: unknown, hr: HrMe, now: Date): Promise<void> {
  const app = isUuid(id) ? await db.query.applications.findFirst({ where: eq(applications.id, id) }) : undefined;
  if (!app) throw notFound('Không tìm thấy hồ sơ.');
  const parsed = reachSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Cách liên hệ không hợp lệ.', fieldErrors(parsed.error));
  await logRecruitment(db, {
    applicationId: app.id,
    group: 'lien-he',
    action: ACTION[parsed.data.via],
    actor: actorOf(hr),
    detail: app.phone,
    at: now,
  });
}
