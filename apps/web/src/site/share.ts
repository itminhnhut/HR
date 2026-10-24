import { formatSalary, type JobCardDto } from '@careers/shared';
import { copyText } from '../lib/hooks';
import { jobUrl } from '../lib/site';

/**
 * One "Chia sẻ" button: the phone's share sheet when there is one, otherwise the link is copied.
 * Returns what happened so the button can say "Đã sao chép link".
 */
export async function shareJob(job: JobCardDto): Promise<'shared' | 'copied' | 'failed'> {
  const url = jobUrl(job.slug);
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: job.title, text: `${job.title} · ${formatSalary(job)}`, url });
      return 'shared';
    } catch (error) {
      // Closing the share sheet is not a failure; anything else falls back to copying.
      if (error instanceof DOMException && error.name === 'AbortError') return 'shared';
    }
  }
  return (await copyText(url)) ? 'copied' : 'failed';
}
