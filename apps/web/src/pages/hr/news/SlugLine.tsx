import { useId, useState } from 'react';
import { Icon } from '../../../ui/icons';
import { siteHost } from './fields';

const addressOf = (slug: string) => `${siteHost()}/tin-tuc/${slug || '…'}`;

function LockedSlug({ shown }: { shown: string }) {
  return (
    <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-slate">
      <Icon name="lock" size={14} className="shrink-0" />
      <span className="break-all">Đường dẫn: {addressOf(shown)}</span>
      <span className="text-muted">· Đã khoá vì bài đã đăng: link mọi người đã chia sẻ vẫn mở được.</span>
    </p>
  );
}

function SlugInput({
  shown,
  value,
  onChange,
  onDone,
}: {
  shown: string;
  value: string;
  onChange: (typed: string) => void;
  onDone: () => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-navy">
        Đường dẫn riêng
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <div className="field-focus flex min-h-10 min-w-0 flex-1 items-center rounded-control border border-field bg-white pl-3 text-sm">
          <span className="shrink-0 text-muted">/tin-tuc/</span>
          <input
            id={id}
            autoFocus
            value={value}
            placeholder={shown}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            aria-describedby={`${id}-hint`}
            className="min-w-0 flex-1 border-0 bg-transparent py-1.5 pr-3 text-navy outline-none placeholder:text-placeholder"
          />
        </div>
        <button
          type="button"
          onClick={onDone}
          className="min-h-10 rounded-control border border-silver bg-white px-3 text-sm text-navy hover:bg-mist"
        >
          Xong
        </button>
      </div>
      <span id={`${id}-hint`} className="text-xs text-muted">
        Để trống thì đi theo tiêu đề. Sửa được khi còn nháp; khoá sau khi đăng. Hiện tại: {addressOf(shown)}
      </span>
    </div>
  );
}

/**
 * "Đường dẫn: lee-hr.com/tin-tuc/<slug>" under the title, following the title as HR types. Nothing to fill
 * in: "Sửa" opens a box for a custom address (empty = follow the title again). Locked once published.
 */
export function SlugLine({
  shown,
  value,
  locked,
  onChange,
}: {
  /** The address as it will be saved. */
  shown: string;
  /** What HR typed ('' = follow the title). */
  value: string;
  locked: boolean;
  onChange: (typed: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  if (locked) return <LockedSlug shown={shown} />;
  if (editing) return <SlugInput shown={shown} value={value} onChange={onChange} onDone={() => setEditing(false)} />;
  return (
    <p className="m-0 flex flex-wrap items-center gap-x-2 text-[13px] text-slate">
      <span className="break-all">Đường dẫn: {addressOf(shown)}</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="min-h-8 border-0 bg-transparent px-1 text-[13px] font-medium text-link underline"
      >
        Sửa
      </button>
    </p>
  );
}
