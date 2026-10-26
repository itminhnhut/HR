import { useState } from 'react';
import { Button } from '../../../../ui/Button';
import { CloseButton } from '../../../../ui/Dialog';
import { Checkbox, TextField } from '../../../../ui/Field';
import { youtubeId } from './embeds';

export function DialogHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <h2 className="m-0 font-serif text-[24px] font-medium">{title}</h2>
      <CloseButton onClick={onClose} />
    </div>
  );
}

export function DialogButtons({ submit, onClose }: { submit: string; onClose: () => void }) {
  return (
    <div className="flex flex-wrap justify-end gap-2.5">
      <Button variant="outline" onClick={onClose}>
        Huỷ
      </Button>
      <Button type="submit" variant="dark">
        {submit}
      </Button>
    </div>
  );
}

/** Any YouTube address (watch, youtu.be, shorts, embed): only its 11-character id is kept. */
export function YouTubeForm({ onSubmit, onClose }: { onSubmit: (id: string) => void; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | undefined>();
  return (
    <form
      className="flex flex-col gap-4 p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const id = youtubeId(url);
        if (!id) return setError('Chưa nhận ra video. Dán link YouTube, ví dụ https://youtu.be/abc123DEF45');
        onSubmit(id);
      }}
    >
      <DialogHead title="Chèn video YouTube" onClose={onClose} />
      <TextField
        label="Link video"
        autoFocus
        inputMode="url"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setError(undefined);
        }}
        placeholder="https://www.youtube.com/watch?v=…"
        hint="Nhận link xem, youtu.be, Shorts hoặc embed."
        error={error}
      />
      <DialogButtons submit="Chèn video" onClose={onClose} />
    </form>
  );
}

export interface TableSize {
  rows: number;
  columns: number;
  headerRow: boolean;
}

const clamp = (value: string, max: number) => Math.min(max, Math.max(1, Math.round(Number(value)) || 1));

/** Rows × columns, first row as header by default. */
export function TableForm({ onSubmit, onClose }: { onSubmit: (size: TableSize) => void; onClose: () => void }) {
  const [rows, setRows] = useState('3');
  const [columns, setColumns] = useState('3');
  const [headerRow, setHeaderRow] = useState(true);
  return (
    <form
      className="flex flex-col gap-4 p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ rows: clamp(rows, 20), columns: clamp(columns, 8), headerRow });
      }}
    >
      <DialogHead title="Chèn bảng" onClose={onClose} />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Số hàng"
          type="number"
          min={1}
          max={20}
          value={rows}
          onChange={(e) => setRows(e.target.value)}
          autoFocus
        />
        <TextField
          label="Số cột"
          type="number"
          min={1}
          max={8}
          value={columns}
          onChange={(e) => setColumns(e.target.value)}
        />
      </div>
      <Checkbox checked={headerRow} onChange={(e) => setHeaderRow(e.target.checked)}>
        Hàng đầu là tiêu đề cột
      </Checkbox>
      <DialogButtons submit="Chèn bảng" onClose={onClose} />
    </form>
  );
}
