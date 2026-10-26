import { useState } from 'react';
import { copyText, useFlash } from '../../lib/hooks';
import { Icon, type IconName } from '../../ui/icons';

const btn =
  'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-control border border-silver bg-white px-2 text-sm font-medium text-navy no-underline transition-colors hover:bg-mist hover:text-navy sm:px-4';

function ShareButton({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={btn}>
      <Icon name={icon} size={16} className="shrink-0" />
      {label}
    </button>
  );
}

/** The phone's share sheet (Zalo, Messenger… are in it). Desktop browsers without one do not get the button. */
const canShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/**
 * Copy link, the share sheet ("Chia sẻ", where Zalo is: Zalo has no share address that works without its SDK)
 * and Facebook, which really opens Facebook's share window. One row of equal buttons, never wrapping on phones.
 */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, flashCopied] = useFlash(2400);
  const [note, setNote] = useState('');
  const sheet = canShare();

  const copy = async (message: string) => {
    if (await copyText(url)) {
      setNote(message);
      flashCopied();
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title, url });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      await copy('Đã chép link, dán vào Zalo hoặc Messenger để gửi.');
    }
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
      <span className="text-sm text-slate">Chia sẻ bài viết</span>
      <div className={`grid gap-2 sm:flex ${sheet ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <ShareButton icon={copied ? 'check' : 'link'} label="Chép link" onClick={() => copy('Đã chép link.')} />
        {sheet && <ShareButton icon="share" label="Chia sẻ" onClick={share} />}
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={btn}
        >
          <Icon name="facebook" size={16} className="shrink-0" />
          Facebook
          <span className="sr-only"> (mở cửa sổ mới)</span>
        </a>
      </div>
      <span aria-live="polite" className="min-h-5 text-[13px] text-ok sm:basis-full">
        {copied ? note : ''}
      </span>
    </div>
  );
}
