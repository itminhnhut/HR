import { useState } from 'react';
import { Button } from '../../../../ui/Button';
import { CloseButton, Dialog } from '../../../../ui/Dialog';
import { TextField } from '../../../../ui/Field';
import { normalizeLinkInput } from './rules';

export interface LinkDialogState {
  /** The link under the cursor, when editing one. */
  url: string;
  /** Nothing selected: ask for the words to show too. */
  needsText: boolean;
}

interface LinkDialogProps {
  onSubmit: (url: string, text: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

/** "Chèn link": an address (checked like the API does) and, with nothing selected, the words to link. */
export function LinkDialog({ state, ...props }: LinkDialogProps & { state: LinkDialogState | null }) {
  return (
    <Dialog open={!!state} onClose={props.onClose} label="Chèn link">
      {state && <LinkForm state={state} {...props} />}
    </Dialog>
  );
}

function LinkButtons({
  canRemove,
  onRemove,
  onClose,
}: {
  canRemove: boolean;
  onRemove: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2.5">
      {canRemove && (
        <Button variant="ghost" onClick={onRemove} className="mr-auto text-error">
          Bỏ link
        </Button>
      )}
      <Button variant="outline" onClick={onClose}>
        Huỷ
      </Button>
      <Button type="submit" variant="dark">
        Lưu link
      </Button>
    </div>
  );
}

function LinkForm({ state, onSubmit, onRemove, onClose }: LinkDialogProps & { state: LinkDialogState }) {
  const [url, setUrl] = useState(state.url);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | undefined>();

  return (
    <form
      className="flex flex-col gap-4 p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const safe = normalizeLinkInput(url);
        if (!safe) return setError('Link chưa đúng. Ví dụ: https://topflow.vn hoặc /viec-lam/ke-toan');
        onSubmit(safe, text.trim());
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="m-0 font-serif text-[24px] font-medium">{state.url ? 'Sửa link' : 'Chèn link'}</h2>
        <CloseButton onClick={onClose} />
      </div>
      <TextField
        label="Địa chỉ"
        autoFocus
        inputMode="url"
        autoCapitalize="off"
        spellCheck={false}
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setError(undefined);
        }}
        placeholder="https://… hoặc /viec-lam/…"
        hint="Link trong site bắt đầu bằng /, ví dụ /viec-lam/ke-toan."
        error={error}
      />
      {state.needsText && (
        <TextField
          label="Chữ hiển thị"
          optional
          value={text}
          onChange={(e) => setText(e.target.value)}
          hint="Để trống thì hiện chính địa chỉ."
        />
      )}
      <LinkButtons canRemove={!!state.url} onRemove={onRemove} onClose={onClose} />
    </form>
  );
}
