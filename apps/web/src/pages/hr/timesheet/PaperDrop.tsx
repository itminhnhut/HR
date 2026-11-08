import { ABSENCE_FILES_MAX } from '@careers/shared';
import { Camera, CheckCircle2, FileUp, Loader2, RotateCw, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { errorMessage } from '../parts';
import { shrinkPhoto } from './photoShrink';

/** Choosing, taking and dropping papers (spec-giay-to-nghi.md): one file a request, one at a time, each with its own %. */

type Upload = (file: File, onProgress: (percent: number) => void) => Promise<void>;

interface Item {
  key: number;
  file: File;
  status: 'waiting' | 'sending' | 'done' | 'failed';
  percent: number;
  error: string;
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';
const BUTTON = 'ts-field inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border bg-white px-3 text-sm font-medium focus-within:ring-2 focus-within:ring-blue-500 hover:bg-slate-50 has-disabled:cursor-not-allowed has-disabled:opacity-50';

/** "Chỉ còn chỗ cho 1 file, bỏ qua 2 file." when more was chosen than the absence can still keep. */
function leftOutWords(room: number, skipped: number) {
  if (skipped === 0) return '';
  return room > 0 ? `Chỉ còn chỗ cho ${room} file, bỏ qua ${skipped} file.` : `Đã đủ ${ABSENCE_FILES_MAX} file, bỏ qua ${skipped} file. Xoá bớt để gửi thêm.`;
}

/** The queue: files wait their turn, the next one starts when the one before it ends, a failed one can go again. */
function useSendQueue(onUpload: Upload, shrink: (file: File) => Promise<File>) {
  const [items, setItems] = useState<Item[]>([]);
  const nextKey = useRef(0);
  const isBusy = useRef(false);
  const update = (key: number, patch: Partial<Item>) => setItems((all) => all.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const finish = (key: number, patch: Partial<Item>) => {
    isBusy.current = false;
    update(key, patch);
  };
  useEffect(() => {
    const next = items.find((i) => i.status === 'waiting');
    if (isBusy.current || !next) return;
    isBusy.current = true;
    update(next.key, { status: 'sending', percent: 0, error: '' });
    shrink(next.file)
      .then((file) => onUpload(file, (percent) => update(next.key, { percent })))
      .then(() => finish(next.key, { status: 'done', percent: 100 }), (error: unknown) => finish(next.key, { status: 'failed', error: errorMessage(error, 'Chưa gửi được file. Thử gửi lại.') }));
  });
  const add = (files: readonly File[]) => setItems((all) => [...all, ...files.map((file) => ({ key: nextKey.current++, file, status: 'waiting' as const, percent: 0, error: '' }))]);
  const retry = (key: number) => update(key, { status: 'waiting', percent: 0, error: '' });
  return { items, add, retry };
}

function Progress({ item, onRetry }: { item: Item; onRetry: () => void }) {
  if (item.status === 'done') return <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 className="size-4" />Đã gửi</span>;
  if (item.status === 'waiting') return <span className="text-slate-500">Đang chờ</span>;
  if (item.status === 'sending') {
    return (
      <span className="flex items-center gap-2">
        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200"><span className="block h-full bg-blue-600 transition-[width]" style={{ width: `${item.percent}%` }} /></span>
        <span className="w-10 text-right tabular-nums">{item.percent}%</span>
      </span>
    );
  }
  return (
    <button type="button" aria-label={`Gửi lại ${item.file.name}`} onClick={onRetry} className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-white px-2 text-xs font-medium hover:bg-slate-50">
      <RotateCw className="size-3.5 text-blue-600" />Gửi lại
    </button>
  );
}

function SendList({ items, onRetry }: { items: readonly Item[]; onRetry: (key: number) => void }) {
  if (items.length === 0) return null;
  return (
    <ul aria-label="File đang gửi" className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
      {items.map((i) => (
        <li key={i.key} className="flex flex-col gap-0.5 rounded-md bg-slate-50 px-2 py-1.5">
          <span className="flex items-center gap-2">
            {i.status === 'sending' ? <Loader2 className="size-4 shrink-0 animate-spin text-blue-600" /> : <FileUp className="size-4 shrink-0 text-slate-400" />}
            <span className="min-w-0 flex-1 truncate">{i.file.name}</span>
            <Progress item={i} onRetry={() => onRetry(i.key)} />
          </span>
          {i.status === 'failed' && <span role="alert" className="flex items-start gap-1.5 text-xs text-red-600"><TriangleAlert className="mt-px size-3.5 shrink-0" />{i.error}</span>}
        </li>
      ))}
    </ul>
  );
}

/**
 * Where papers go in: "Chọn file", "Chụp ảnh" (the back camera on a phone) or dropped from the computer.
 * `room` is how many more files the absence can keep; photos are made smaller by `shrink` before they go.
 */
export function PaperDrop({ room, onUpload, shrink = shrinkPhoto }: { room: number; onUpload: Upload; shrink?: (file: File) => Promise<File> }) {
  const { items, add, retry } = useSendQueue(onUpload, shrink);
  const [leftOut, setLeftOut] = useState('');
  const [isOver, setIsOver] = useState(false);
  const free = Math.max(0, room - items.filter((i) => i.status !== 'done').length);
  const take = (files: readonly File[]) => {
    if (files.length === 0) return;
    add(files.slice(0, free));
    setLeftOut(leftOutWords(free, Math.max(0, files.length - free)));
  };
  const pick = (input: HTMLInputElement) => {
    take(Array.from(input.files ?? []));
    input.value = '';
  };
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    take(Array.from(e.dataTransfer.files));
  };
  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Gửi giấy tờ" onDragOver={(e) => { e.preventDefault(); setIsOver(true); }} onDragLeave={() => setIsOver(false)} onDrop={drop} className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-3 py-4 text-center ${isOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'}`}>
        <p className="m-0 text-sm text-slate-600"><span className="pointer-coarse:hidden">Kéo thả ảnh hoặc PDF vào đây, hoặc </span>chọn ảnh JPG, PNG, WEBP hoặc PDF, mỗi file tối đa 4 MB.</p>
        <div className="flex flex-wrap justify-center gap-2 max-sm:w-full max-sm:flex-col">
          <label className={`${BUTTON} pointer-fine:hidden`}>
            <Camera className="size-4 text-blue-600" />Chụp ảnh
            <input type="file" aria-label="Chụp ảnh giấy tờ" accept="image/*" capture="environment" disabled={free === 0} onChange={(e) => pick(e.currentTarget)} className="sr-only" />
          </label>
          <label className={BUTTON}>
            <FileUp className="size-4 text-blue-600" />Chọn file
            <input type="file" aria-label="Chọn file giấy tờ" accept={ACCEPT} multiple disabled={free === 0} onChange={(e) => pick(e.currentTarget)} className="sr-only" />
          </label>
        </div>
        <p className="m-0 text-xs text-slate-500">{free > 0 ? `Còn chỗ cho ${free} file.` : `Đã đủ ${ABSENCE_FILES_MAX} file. Xoá bớt để gửi thêm.`}</p>
      </div>
      {leftOut && <p role="status" className="m-0 text-sm text-amber-800">{leftOut}</p>}
      <SendList items={items} onRetry={retry} />
    </div>
  );
}
