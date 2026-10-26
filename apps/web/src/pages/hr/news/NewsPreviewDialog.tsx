import type { NewsCardDto, RenderedArticle } from '@careers/shared';
import { useState } from 'react';
import { scrollToInPageLink } from '../../../lib/inPageLinks';
import { ArticleBody, ArticleHeader } from '../../../site/news/ArticleBody';
import { CloseButton, Dialog } from '../../../ui/Dialog';
import { Notice } from '../../../ui/feedback';

function PreviewBody({ article }: { article: RenderedArticle | null }) {
  if (!article) {
    return (
      <Notice tone="error" icon="alert">
        Nội dung có phần trang không hiển thị được. Lưu lại để xem lỗi cụ thể.
      </Notice>
    );
  }
  if (!article.html) return <p className="m-0 italic text-muted">Bài chưa có nội dung.</p>;
  // A click on a "Mục lục" link scrolls inside the preview.
  return (
    <div onClick={scrollToInPageLink}>
      <ArticleBody html={article.html} className="max-w-[720px]" />
    </div>
  );
}

type Device = 'desktop' | 'phone';

/** "Máy tính / Điện thoại": the phone view is a 390px frame (the article's columns follow its width). */
function DeviceToggle({ value, onChange }: { value: Device; onChange: (d: Device) => void }) {
  const option = (device: Device, label: string) => (
    <button
      type="button"
      aria-pressed={value === device}
      onClick={() => onChange(device)}
      className={`min-h-9 rounded-control border-0 px-3 text-sm ${value === device ? 'bg-navy text-white' : 'bg-transparent text-navy hover:bg-tint'}`}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Xem trên" className="flex rounded-control border border-line p-0.5">
      {option('desktop', 'Máy tính')}
      {option('phone', 'Điện thoại')}
    </div>
  );
}

/** "Xem trước": the post as the public page will show it, rendered with the same function and styles. */
export function NewsPreviewDialog({
  open,
  card,
  article,
  onClose,
}: {
  open: boolean;
  card: NewsCardDto;
  /** null: the content does not pass the checks yet. */
  article: RenderedArticle | null;
  onClose: () => void;
}) {
  const [device, setDevice] = useState<Device>('desktop');
  const pad = device === 'phone' ? 'px-4' : 'px-5 sm:px-10';
  return (
    <Dialog
      open={open}
      onClose={onClose}
      label="Xem trước bài viết"
      variant="panel"
      className="sm:!w-[min(920px,calc(100vw-48px))]"
    >
      <div className="flex max-h-dvh flex-col overflow-y-auto sm:max-h-[calc(100dvh-48px)]">
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-5 py-3">
          <span className="text-sm font-medium text-slate">Xem trước · chưa phải trang thật</span>
          <span className="flex items-center gap-2">
            <DeviceToggle value={device} onChange={setDevice} />
            <CloseButton onClick={onClose} />
          </span>
        </div>
        <div
          className={
            device === 'phone'
              ? 'mx-auto my-5 w-[390px] max-w-full overflow-hidden rounded-[28px] border-[6px] border-navy bg-white shadow-[0_10px_30px_rgba(11,31,58,0.18)]'
              : ''
          }
        >
          <div className={`bg-navy pb-14 pt-8 text-white ${pad}`}>
            <ArticleHeader post={{ ...card, title: card.title || 'Tiêu đề bài viết' }} />
          </div>
          <div className={`flex flex-col gap-8 pb-12 ${pad}`}>
            {card.cover && (
              <img
                src={card.cover.url}
                alt={card.cover.alt}
                width={card.cover.width}
                height={card.cover.height}
                className="-mt-8 h-auto max-h-[460px] w-full rounded-card border border-line bg-line object-cover"
              />
            )}
            <div className={card.cover ? '' : 'pt-8'}>
              <PreviewBody article={article} />
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
