import { ARTICLE_ALT_MAX, ARTICLE_CAPTION_MAX } from '@careers/shared';
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../../../ui/Button';
import type { ImageDetails, ImageLayout } from './ImageNode';

const WIDTH = 360;

/** Below the picture, kept on screen; follows it while the page scrolls. */
function usePosition(anchor: RefObject<HTMLElement | null>): CSSProperties | null {
  const [style, setStyle] = useState<CSSProperties | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (!r) return;
      const left = Math.min(Math.max(8, r.left + r.width / 2 - WIDTH / 2), window.innerWidth - WIDTH - 8);
      const top = Math.min(r.bottom + 8, window.innerHeight - 380);
      setStyle({ left: Math.max(8, left), top: Math.max(8, top) });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [anchor]);
  return style;
}

/** Closes on a press outside the box. */
function useOutsideClose(box: RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener('pointerdown', onPointer);
    return () => window.removeEventListener('pointerdown', onPointer);
  }, [box, onClose]);
}

function AltInput({ value, onChange, invalid }: { value: string; onChange: (v: string) => void; invalid: boolean }) {
  const id = useId();
  return (
    <>
      <label htmlFor={id} className="text-sm font-medium">
        Mô tả ảnh (alt)
      </label>
      <input
        id={id}
        autoFocus
        value={value}
        maxLength={ARTICLE_ALT_MAX}
        onChange={(e) => onChange(e.target.value)}
        // The suggestion from the file name is selected: typing replaces it.
        onFocus={(e) => e.currentTarget.select()}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={`${id}-hint`}
        placeholder="Ví dụ: Đội ngũ TOP FLOW tại công trình"
        className={`field-focus min-h-11 rounded-control border bg-white px-3 text-[15px] outline-none ${invalid ? 'border-error' : 'border-field'}`}
      />
      <span id={`${id}-hint`} className={`text-xs ${invalid ? 'text-error' : 'text-muted'}`}>
        {invalid
          ? 'Nhập mô tả cho ảnh.'
          : 'Viết ngắn điều ảnh thể hiện. Google và người dùng trình đọc màn hình sẽ đọc dòng này.'}
      </span>
    </>
  );
}

function LayoutToggle({ value, onChange }: { value: ImageLayout; onChange: (layout: ImageLayout) => void }) {
  const options: [ImageLayout, string][] = [
    ['normal', 'Vừa'],
    ['wide', 'Tràn khung'],
  ];
  return (
    <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
      <legend className="mb-1.5 p-0 text-sm font-medium">Cỡ ảnh</legend>
      <div className="inline-flex w-fit rounded-control border border-field p-0.5">
        {options.map(([key, label]) => (
          <label
            key={key}
            className={`inline-flex min-h-9 cursor-pointer items-center rounded-[3px] px-3 text-sm ${value === key ? 'bg-navy text-white' : 'text-navy hover:bg-mist'}`}
          >
            <input
              type="radio"
              name="image-layout"
              className="sr-only"
              checked={value === key}
              onChange={() => onChange(key)}
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function CaptionInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <>
      <label htmlFor={id} className="text-sm font-medium">
        Chú thích <span className="font-normal text-muted">(không bắt buộc)</span>
      </label>
      <input
        id={id}
        value={value}
        maxLength={ARTICLE_CAPTION_MAX}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Hiện dưới ảnh"
        className="field-focus min-h-11 rounded-control border border-field bg-white px-3 text-[15px] outline-none"
      />
    </>
  );
}

function PopoverButtons({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" size="sm" onClick={onClose}>
        Huỷ
      </Button>
      <Button type="submit" variant="dark" size="sm">
        Lưu
      </Button>
    </div>
  );
}

/**
 * The picture's box: alt text (required: Google and screen readers use it), caption and size. Rendered
 * outside the editor (portal), so typing in it never reaches Lexical.
 */
export function ImagePopover({
  anchor,
  initial,
  onSave,
  onClose,
}: {
  anchor: RefObject<HTMLElement | null>;
  initial: ImageDetails;
  onSave: (details: ImageDetails) => void;
  onClose: () => void;
}) {
  const [details, setDetails] = useState(initial);
  const [touched, setTouched] = useState(false);
  const style = usePosition(anchor);
  const box = useRef<HTMLFormElement>(null);
  useOutsideClose(box, onClose);
  const empty = !details.altText.trim();
  const set = (patch: Partial<ImageDetails>) => setDetails((d) => ({ ...d, ...patch }));

  if (!style) return null;
  return createPortal(
    <form
      ref={box}
      role="dialog"
      aria-label="Ảnh trong bài"
      style={{ ...style, width: `min(${WIDTH}px, calc(100vw - 16px))` }}
      className="fixed z-40 flex animate-fade flex-col gap-2.5 rounded-card border border-line bg-white p-4 text-navy shadow-[0_10px_30px_rgba(11,31,58,0.16)]"
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        onClose();
      }}
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!empty) onSave({ ...details, altText: details.altText.trim(), caption: details.caption.trim() });
      }}
    >
      <AltInput value={details.altText} onChange={(altText) => set({ altText })} invalid={touched && empty} />
      <CaptionInput value={details.caption} onChange={(caption) => set({ caption })} />
      <LayoutToggle value={details.layout} onChange={(layout) => set({ layout })} />
      <PopoverButtons onClose={onClose} />
    </form>,
    document.body,
  );
}
