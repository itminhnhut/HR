import type { NewsCardDto, RenderedArticle } from '@careers/shared';
import { Button } from '../../../ui/Button';
import { Dialog, SheetHandle } from '../../../ui/Dialog';
import { Icon } from '../../../ui/icons';
import { jumpToField } from './EditorStatus';
import { GooglePreview, siteHost } from './fields';
import { canPublish, publishChecks, type PublishCheck } from './publishChecks';

/** How a shared link looks on Zalo / Facebook: the cover, the site, the title and the description. */
function SharePreview({ card }: { card: NewsCardDto }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-navy">Khi chia sẻ lên Zalo, Facebook</span>
      <div aria-label="Xem trước khi chia sẻ" className="overflow-hidden rounded-control border border-line bg-white">
        {card.cover ? (
          <img src={card.cover.url} alt="" className="aspect-[1.91/1] w-full bg-line object-cover" />
        ) : (
          <span className="flex h-20 w-full items-center justify-center bg-tint text-sm text-muted">
            Chưa có ảnh bìa
          </span>
        )}
        <span className="flex flex-col gap-0.5 bg-mist px-3 py-2.5">
          <span className="text-xs uppercase text-slate">{siteHost()}</span>
          <span className="line-clamp-2 text-[15px] font-semibold text-navy">{card.title || 'Tiêu đề bài viết'}</span>
          <span className="line-clamp-1 text-[13px] text-slate">{card.summary}</span>
        </span>
      </div>
    </div>
  );
}

function CheckRow({ check, onFix }: { check: PublishCheck; onFix: () => void }) {
  const tone = check.ok ? 'text-ok' : check.blocking ? 'text-error' : 'text-cat-amber';
  const state = check.ok ? 'Đạt' : check.blocking ? 'Phải sửa' : 'Nên sửa';
  return (
    <li className="flex min-h-11 items-start gap-2.5 border-b border-line-soft py-2 last:border-0">
      <Icon name={check.ok ? 'check' : 'alert'} size={18} className={`mt-0.5 shrink-0 ${tone}`} />
      <span className="flex min-w-0 flex-1 flex-col text-sm text-body">
        {check.label}
        <span className={`text-[13px] font-medium ${tone}`}>{state}</span>
      </span>
      {!check.ok && (
        <button
          type="button"
          onClick={onFix}
          className="min-h-11 shrink-0 border-0 bg-transparent px-2 text-sm font-medium text-link underline"
        >
          Sửa
        </button>
      )}
    </li>
  );
}

interface PublishDialogProps {
  open: boolean;
  /** "Đăng bài" for a draft, "Hiện lại" for a hidden post. */
  confirmLabel: string;
  card: NewsCardDto;
  article: RenderedArticle | null;
  /** Pictures in the article still waiting for a description. */
  imagesWithoutAlt?: number;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Before a post goes live: a checklist first, then how Google and a shared link will show it. Items the
 * server needs (title, category, cover, text) block the button; the others are advice. "Sửa" closes the sheet
 * and goes to the field.
 */
export function PublishDialog({
  open,
  confirmLabel,
  card,
  article,
  imagesWithoutAlt = 0,
  busy,
  onConfirm,
  onClose,
}: PublishDialogProps) {
  const checks = publishChecks(card, article, imagesWithoutAlt);
  const ready = canPublish(checks);
  const blockers = checks.filter((c) => c.blocking && !c.ok).length;
  const fix = (field: string) => {
    onClose();
    window.requestAnimationFrame(() => jumpToField(field));
  };
  return (
    <Dialog open={open} onClose={onClose} label={`${confirmLabel}?`} className="sm:!w-[min(600px,calc(100vw-32px))]">
      <div className="flex max-h-[92dvh] flex-col sm:max-h-[calc(100dvh-48px)]">
        <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-4 pt-3 sm:px-6 sm:pt-6">
          <SheetHandle />
          <h2 className="m-0 font-serif text-[24px] font-medium">{confirmLabel}?</h2>
          <section aria-label="Kiểm tra trước khi đăng" className="flex flex-col">
            <span className="text-sm font-medium text-navy">Kiểm tra trước khi đăng</span>
            <ul className="m-0 list-none p-0">
              {checks.map((check) => (
                <CheckRow key={check.key} check={check} onFix={() => fix(check.field)} />
              ))}
            </ul>
          </section>
          <div className="grid gap-4 sm:grid-cols-2">
            <GooglePreview title={card.title} slug={card.slug} description={card.summary} />
            <SharePreview card={card} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-line bg-white px-5 py-3 sm:px-6">
          {!ready && (
            <span role="status" className="mr-auto flex items-center gap-1.5 text-[13px] text-error max-sm:basis-full">
              <Icon name="alert" size={15} />
              Còn {blockers} mục phải sửa trước khi đăng.
            </span>
          )}
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button icon="send" onClick={onConfirm} disabled={!ready || busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
