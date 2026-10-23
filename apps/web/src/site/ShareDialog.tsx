import { formatSalary, type JobCardDto } from '@careers/shared';
import { copyText, useFlash } from '../lib/hooks';
import { jobUrl } from '../lib/site';
import { CloseButton, Dialog, SheetHandle } from '../ui/Dialog';
import { Icon } from '../ui/icons';

/** Preview of what Zalo / Facebook show, plus share targets. */
export function ShareDialog({ job, open, onClose }: { job: JobCardDto; open: boolean; onClose: () => void }) {
  const url = jobUrl(job.slug);
  const [copied, flash] = useFlash();
  const target =
    'flex flex-col items-center gap-1.5 rounded-card border border-field bg-white px-2 py-3 text-[13px] text-navy no-underline hover:bg-mist hover:text-navy';
  return (
    <Dialog open={open} onClose={onClose} label="Chia sẻ tin">
      <div className="flex flex-col gap-4 px-5 pb-7 pt-3 sm:p-6">
        <SheetHandle />
        <div className="flex items-center justify-between">
          <strong className="font-serif text-[22px] font-medium">Chia sẻ tin này</strong>
          <CloseButton onClick={onClose} />
        </div>
        <div className="flex items-center gap-3.5 rounded-card border border-line bg-hover p-3">
          <span className="flex h-[54px] w-[100px] shrink-0 items-end rounded-control bg-navy px-2 py-1.5 font-serif text-[11px] font-medium leading-tight text-white">
            {job.title}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5 text-[13px]">
            <strong className="font-semibold">
              {job.title} · {formatSalary(job)}
            </strong>
            <span className="truncate text-muted">{url.replace(/^https?:\/\//, '')}</span>
          </span>
        </div>
        <span className="text-xs text-muted">
          Ảnh và tiêu đề trên là phần hiện ra khi dán link vào Zalo hay Facebook.
        </span>
        <div className="grid grid-cols-3 gap-2">
          <a
            className={target}
            href={`https://zalo.me/share/url?url=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="chat" size={20} className="text-accent" />
            Zalo
          </a>
          <a
            className={target}
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="facebook" size={20} className="text-accent" />
            Facebook
          </a>
          <button type="button" className={target} onClick={() => copyText(url).then((ok) => ok && flash())}>
            <Icon name={copied ? 'check' : 'link'} size={20} className="text-accent" />
            {copied ? 'Đã chép' : 'Chép link'}
          </button>
        </div>
        <span className="sr-only" aria-live="polite">
          {copied ? 'Đã chép link' : ''}
        </span>
      </div>
    </Dialog>
  );
}

/** Phones get the native share sheet when the browser has one. */
export async function shareNative(job: JobCardDto): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.share) return false;
  try {
    await navigator.share({ title: job.title, text: `${job.title} · ${formatSalary(job)}`, url: jobUrl(job.slug) });
    return true;
  } catch {
    return true; // user cancelled; do not fall back to our dialog
  }
}
