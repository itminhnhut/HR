import { numberHeadings, type ArticleHeadingRef } from '@careers/shared';
import { Panel } from './fields';

/** Scrolls the editor to its n-th heading (the outline lists them in the same order). */
function goToHeading(index: number) {
  const headings = document.querySelectorAll<HTMLElement>(
    '[data-lexical-editor] h2, [data-lexical-editor] h3, [data-lexical-editor] h4',
  );
  headings[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * "Mục lục" while writing: the H2/H3/H4 headings, numbered 1 / 1.1 / 1.1.1 as on the post page.
 * Updates as HR types; a click jumps to that heading in the editor.
 */
export function EditorOutline({ headings }: { headings: ArticleHeadingRef[] }) {
  return (
    <Panel title="Mục lục bài viết">
      {headings.length === 0 ? (
        <p className="m-0 text-sm leading-relaxed text-slate">
          Chưa có tiêu đề. Chọn <strong className="font-semibold text-navy">Tiêu đề lớn (H2)</strong> cho mục 1, 2…,{' '}
          <strong className="font-semibold text-navy">H3</strong> cho mục con 1.1 và{' '}
          <strong className="font-semibold text-navy">H4</strong> cho 1.1.1 ở thanh công cụ (hoặc gõ{' '}
          <code className="rounded bg-tint px-1">##</code> rồi dấu cách) để chia bài thành phần; mục lục tự hiện ở trang
          bài khi có từ 2 tiêu đề.
        </p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-0.5 border-l border-line p-0">
          {numberHeadings(headings).map((h, i) => (
            <li key={`${h.id}-${i}`}>
              <button
                type="button"
                title={h.label}
                onClick={() => goToHeading(i)}
                className={`-ml-px flex w-full gap-2 border-0 border-l-2 border-transparent bg-transparent py-1.5 pr-2 text-left leading-snug hover:border-accent hover:text-navy ${['pl-3 text-sm font-medium text-navy', 'pl-7 text-[13px] text-body', 'pl-11 text-[13px] text-slate'][Math.min(h.depth, 2)]}`}
              >
                <span className="shrink-0 tabular-nums text-slate">{h.number}</span>
                <span className="line-clamp-2">
                  {h.label || <span className="italic text-muted">(tiêu đề trống)</span>}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {headings.length === 1 && (
        <p className="m-0 text-xs text-muted">Cần ít nhất 2 tiêu đề thì mục lục mới hiện ở trang bài.</p>
      )}
    </Panel>
  );
}
