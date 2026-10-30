import { api } from '../../api';
import { CloseButton, Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/icons';

/**
 * The CV inside the page, under a faint "Bản xem của <reviewer> · <date>" across it, so a screenshot that
 * travels further still says whose copy it was. "Mở toàn màn hình" for phones whose viewer shows one page.
 */
export function CvViewer({
  token,
  item,
  reviewerName,
  onClose,
}: {
  token: string;
  item: { id: string; fullName: string } | null;
  reviewerName: string;
  onClose: () => void;
}) {
  const url = item ? api.reviewCvUrl(token, item.id) : null;
  const stamp = `Bản xem của ${reviewerName} · ${new Date().toLocaleDateString('vi-VN')}`;
  return (
    <Dialog
      open={!!item}
      onClose={onClose}
      label={`CV ${item?.fullName ?? ''}`}
      variant="drawer"
      className="sm:ml-auto sm:w-[min(820px,100vw)]"
    >
      {item && (
        <div className="flex h-full flex-col">
          <header className="flex items-center gap-3 border-b border-line px-4 py-3">
            <h2 className="m-0 min-w-0 flex-1 truncate text-base font-semibold">CV · {item.fullName}</h2>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-link"
              >
                <Icon name="external" size={15} /> Mở toàn màn hình
              </a>
            )}
            <CloseButton onClick={onClose} />
          </header>
          <div className="relative min-h-0 flex-1 bg-tint">
            {url ? (
              <iframe title={`CV ${item.fullName}`} src={url} className="size-full border-0 bg-white" />
            ) : (
              <p className="m-6 text-sm text-slate">Không mở được CV ở đây.</p>
            )}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden"
            >
              <span className="-rotate-[28deg] whitespace-nowrap text-[clamp(18px,4vw,30px)] font-bold text-navy/[0.08]">
                {stamp}
              </span>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
