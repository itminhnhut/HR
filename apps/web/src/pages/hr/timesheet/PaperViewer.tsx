import type { AbsenceFileDto } from '@careers/shared';
import { ChevronLeft, ChevronRight, Download, RotateCw, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { api } from '../../../api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../vendor/shadcn-grid/components/ui/dialog';
import { ConfirmDialog } from './dialogs';

/** One photo of an absence's papers, large: previous and next (← →), zoom, turn, download and delete. */

const ZOOMS = [1, 1.5, 2, 3] as const;
const TOOL = 'inline-flex size-9 items-center justify-center rounded-md border bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40';

function Tools({ photo, zoom, onZoom, onTurn, onDelete }: { photo: AbsenceFileDto; zoom: number; onZoom: (step: 1 | -1) => void; onTurn: () => void; onDelete: () => void }) {
  const url = api.hrAbsenceFileUrl(photo.id);
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <button type="button" aria-label="Thu nhỏ" title="Thu nhỏ" disabled={zoom === 0} onClick={() => onZoom(-1)} className={TOOL}><ZoomOut className="size-4" /></button>
      <button type="button" aria-label="Phóng to" title="Phóng to" disabled={zoom === ZOOMS.length - 1} onClick={() => onZoom(1)} className={TOOL}><ZoomIn className="size-4" /></button>
      <button type="button" aria-label="Xoay" title="Xoay 90°" onClick={onTurn} className={TOOL}><RotateCw className="size-4" /></button>
      {url && <a href={url} download={photo.name} aria-label="Tải về" title="Tải về" className={TOOL}><Download className="size-4" /></a>}
      <button type="button" aria-label="Xoá" title="Xoá" onClick={onDelete} className={`${TOOL} text-red-600 hover:bg-red-50`}><Trash2 className="size-4" /></button>
    </div>
  );
}

function Stage({ photo, zoom, turn, count, onStep }: { photo: AbsenceFileDto; zoom: number; turn: number; count: number; onStep: (step: 1 | -1) => void }) {
  const url = api.hrAbsenceFileUrl(photo.id);
  const scale = ZOOMS[zoom] ?? 1;
  const side = 'absolute top-1/2 z-10 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border bg-white/90 text-slate-800 shadow hover:bg-white';
  return (
    <div className="relative">
      <div className="flex h-[min(70dvh,640px)] items-center justify-center overflow-auto rounded-md bg-slate-900">
        {url
          ? <img src={url} alt={photo.name} style={{ transform: `rotate(${turn}deg)`, width: scale > 1 ? `${scale * 100}%` : undefined }} className={`transition-transform ${scale > 1 ? 'max-w-none' : 'max-h-full max-w-full object-contain'}`} />
          : <p className="m-0 text-sm text-slate-200">Bản demo không giữ file.</p>}
      </div>
      {count > 1 && <button type="button" aria-label="Ảnh trước" onClick={() => onStep(-1)} className={`${side} left-2`}><ChevronLeft className="size-5" /></button>}
      {count > 1 && <button type="button" aria-label="Ảnh sau" onClick={() => onStep(1)} className={`${side} right-2`}><ChevronRight className="size-5" /></button>}
    </div>
  );
}

/** `index` picks the photo shown, null when closed. Turning and zoom start over on each photo. */
export function PaperViewer({ photos, index, onIndex, onDelete, isDeleting }: {
  photos: readonly AbsenceFileDto[];
  index: number | null;
  onIndex: (index: number | null) => void;
  onDelete: (photo: AbsenceFileDto) => void;
  isDeleting: boolean;
}) {
  const [zoom, setZoom] = useState(0);
  const [turn, setTurn] = useState(0);
  const [isAsking, setIsAsking] = useState(false);
  const photo = index === null ? undefined : photos[index];
  const go = (next: number) => {
    setZoom(0);
    setTurn(0);
    onIndex((next + photos.length) % photos.length);
  };
  const step = (by: 1 | -1) => index !== null && photos.length > 1 && go(index + by);
  const onKey = (e: KeyboardEvent) => {
    if (isAsking || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    step(e.key === 'ArrowRight' ? 1 : -1);
  };
  return (
    <Dialog open={!!photo} onOpenChange={(o) => !o && onIndex(null)}>
      <DialogContent onKeyDown={onKey} className="gap-3 sm:max-w-4xl">
        <DialogHeader><DialogTitle className="truncate">{photo ? `${photo.name} (${(index ?? 0) + 1}/${photos.length})` : ''}</DialogTitle></DialogHeader>
        {photo && <Stage photo={photo} zoom={zoom} turn={turn} count={photos.length} onStep={step} />}
        {photo && <Tools photo={photo} zoom={zoom} onZoom={(by) => setZoom((z) => Math.min(ZOOMS.length - 1, Math.max(0, z + by)))} onTurn={() => setTurn((t) => (t + 90) % 360)} onDelete={() => setIsAsking(true)} />}
        <ConfirmDialog
          open={isAsking}
          title={`Xoá ${photo?.name ?? ''}? Không lấy lại được.`}
          confirmLabel="Xoá file"
          isBusy={isDeleting}
          onCancel={() => setIsAsking(false)}
          onConfirm={() => {
            if (photo) onDelete(photo);
            setIsAsking(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
