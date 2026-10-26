import type { JobDetailDto } from '@careers/shared';
import { lazy, Suspense, useState } from 'react';

/** The form, its checks and the anti-spam widget: a chunk of its own, fetched when the dialog first opens. */
const ApplyFormDialog = lazy(() => import('./ApplyFormDialog'));

/**
 * "Ứng tuyển": nothing of the form loads with the job page. On the first open the form's code arrives (a
 * fraction of a second) and from then on it stays mounted, so typed details survive closing and reopening.
 */
export function ApplyDialog({ job, open, onClose }: { job: JobDetailDto; open: boolean; onClose: () => void }) {
  const [wanted, setWanted] = useState(open);
  if (open && !wanted) setWanted(true);
  if (!wanted) return null;
  return (
    <Suspense fallback={null}>
      <ApplyFormDialog job={job} open={open} onClose={onClose} />
    </Suspense>
  );
}
