import { ABSENCE_FILES_MAX, type AbsenceFileDto, type AbsenceRowDto, type TimesheetAbsenceDto } from '@careers/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Paperclip, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../../../api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../vendor/shadcn-grid/components/ui/dialog';
import { errorMessage } from '../parts';
import { ConfirmDialog } from './dialogs';
import { PaperDrop } from './PaperDrop';
import { PaperViewer } from './PaperViewer';

/** The Giấy tờ dialog of one absence (spec-giay-to-nghi.md): its papers as a grid, and where more go in. */

/** An absence, and the year of the list that holds it (the list of the year it starts in). */
export interface PaperTarget {
  absenceId: string;
  year: number;
}

export const paperTargetOf = (a: { id: string; from: string }): PaperTarget => ({ absenceId: a.id, year: Number(a.from.slice(0, 4)) });

const PAPER_PARAM = 'giay';
const YEAR_PARAM = 'nam';

/** Where Rà soát sends HR: the Nghỉ tab with the papers of that absence open. */
export const papersLink = (target: PaperTarget) => `/hr/cham-cong/nghi?${PAPER_PARAM}=${encodeURIComponent(target.absenceId)}&${YEAR_PARAM}=${target.year}`;

/** The absence a link asks to open, read once and then taken out of the address. */
export function usePaperTarget() {
  const [params, setParams] = useSearchParams();
  const [target, setTarget] = useState<PaperTarget | null>(null);
  const wanted = params.get(PAPER_PARAM);
  const year = Number(params.get(YEAR_PARAM));
  useEffect(() => {
    if (!wanted || !Number.isInteger(year) || year < 2020) return;
    setTarget({ absenceId: wanted, year });
    setParams({}, { replace: true });
  }, [wanted, year, setParams]);
  return [target, setTarget] as const;
}

/** The new line in what the register call gives back (the person's absences): same start day, and same reason if two start then. */
export function justAdded(list: readonly TimesheetAbsenceDto[], input: { from: string; reason: string }): TimesheetAbsenceDto | undefined {
  const sameDay = list.filter((a) => a.from === input.from);
  return sameDay.find((a) => a.reason === input.reason) ?? sameDay[0];
}

const useAbsenceRow = (target: PaperTarget | null) => {
  const year = target?.year ?? 0;
  const list = useQuery({ queryKey: ['hr', 'absences', year], queryFn: () => api.hrAllAbsences(year), enabled: !!target });
  return { list, row: list.data?.find((r) => r.id === target?.absenceId) };
};

/** Every list holding the absence takes its papers as the server returned them, so "Thiếu giấy" goes or comes back at once. */
function usePaperActions(absenceId: string) {
  const qc = useQueryClient();
  const keep = (files: AbsenceFileDto[]) => qc.setQueriesData<AbsenceRowDto[]>({ queryKey: ['hr', 'absences'] }, (rows) => rows?.map((r) => (r.id === absenceId ? { ...r, files } : r)));
  const upload = async (file: File, onProgress: (percent: number) => void) => {
    keep(await api.hrUploadAbsenceFile(absenceId, file, onProgress));
  };
  const remove = useMutation({ mutationFn: (file: AbsenceFileDto) => api.hrRemoveAbsenceFile(file.id), onSuccess: keep });
  return { upload, remove };
}

const isPhoto = (f: AbsenceFileDto) => f.contentType.startsWith('image/');

/** "Giấy tờ (2)", for the edit form: the count read from the same list as the table. */
export function PapersButton({ target, onOpen }: { target: PaperTarget; onOpen: () => void }) {
  const { row } = useAbsenceRow(target);
  return (
    <button type="button" onClick={onOpen} className="ts-field inline-flex items-center gap-2 rounded-md border bg-white px-4 text-sm font-medium hover:bg-slate-50">
      <Paperclip className="size-4 text-blue-600" />Giấy tờ ({row?.files.length ?? 0})
    </button>
  );
}

function PdfTile({ file, onDelete }: { file: AbsenceFileDto; onDelete: () => void }) {
  const url = api.hrAbsenceFileUrl(file.id);
  return (
    <span className="relative flex aspect-square flex-col items-center justify-center gap-1 rounded-md border bg-slate-50 p-2 text-center">
      <FileText className="size-8 text-red-600" />
      {url ? <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Mở ${file.name}`} className="line-clamp-2 text-xs break-all text-blue-700 underline after:absolute after:inset-0">{file.name}</a> : <span className="line-clamp-2 text-xs break-all">{file.name}</span>}
      <button type="button" aria-label={`Xoá ${file.name}`} onClick={onDelete} className="absolute top-1 right-1 z-10 inline-flex size-8 items-center justify-center rounded-md border bg-white text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
    </span>
  );
}

function PhotoTile({ file, onOpen }: { file: AbsenceFileDto; onOpen: () => void }) {
  const url = api.hrAbsenceFileUrl(file.id);
  return (
    <button type="button" aria-label={`Xem ảnh ${file.name}`} onClick={onOpen} className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border bg-slate-100 hover:ring-2 hover:ring-blue-400">
      {url ? <img src={url} alt={file.name} loading="lazy" className="size-full object-cover" /> : <span className="p-2 text-xs break-all">{file.name}</span>}
    </button>
  );
}

function PaperGrid({ files, onPhoto, onDelete }: { files: readonly AbsenceFileDto[]; onPhoto: (file: AbsenceFileDto) => void; onDelete: (file: AbsenceFileDto) => void }) {
  return (
    <ul aria-label="Giấy tờ đã gửi" className="m-0 grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-4">
      {files.map((f) => <li key={f.id}>{isPhoto(f) ? <PhotoTile file={f} onOpen={() => onPhoto(f)} /> : <PdfTile file={f} onDelete={() => onDelete(f)} />}</li>)}
    </ul>
  );
}

function PapersBody({ row }: { row: AbsenceRowDto }) {
  const { upload, remove } = usePaperActions(row.id);
  const [viewing, setViewing] = useState<number | null>(null);
  const [asking, setAsking] = useState<AbsenceFileDto | null>(null);
  const photos = row.files.filter(isPhoto);
  const removePhoto = (file: AbsenceFileDto) => remove.mutate(file, { onSuccess: (left) => {
    const count = left.filter(isPhoto).length;
    setViewing((i) => (count === 0 || i === null ? null : Math.min(i, count - 1)));
  } });
  return (
    <>
      {row.files.length > 0
        ? <PaperGrid files={row.files} onPhoto={(f) => setViewing(photos.indexOf(f))} onDelete={setAsking} />
        : <p className="m-0 text-sm text-slate-600">Chưa có giấy tờ.{row.needsPaper ? ' Lý do này cần giấy tờ.' : ''}</p>}
      {!!remove.error && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(remove.error)}</p>}
      <PaperDrop room={ABSENCE_FILES_MAX - row.files.length} onUpload={upload} />
      <PaperViewer photos={photos} index={viewing} onIndex={setViewing} onDelete={removePhoto} isDeleting={remove.isPending} />
      <ConfirmDialog open={!!asking} title={`Xoá ${asking?.name ?? ''}? Không lấy lại được.`} confirmLabel="Xoá file" isBusy={remove.isPending} onCancel={() => setAsking(null)} onConfirm={() => { if (asking) remove.mutate(asking); setAsking(null); }} />
    </>
  );
}

const show = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');
const titleOf = (row: AbsenceRowDto | undefined) => (row ? `Giấy tờ: ${row.fullName}, ${row.label} ${show(row.from)}${row.to !== row.from ? `–${show(row.to)}` : ''}` : 'Giấy tờ');

/** Open while `target` is set. The absence is read from the year's list, which the table shares. */
export function PapersDialog({ target, onClose }: { target: PaperTarget | null; onClose: () => void }) {
  const { list, row } = useAbsenceRow(target);
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-3 sm:max-w-xl">
        <DialogHeader><DialogTitle>{titleOf(row)}</DialogTitle></DialogHeader>
        {row ? <PapersBody key={row.id} row={row} /> : (
          <p role={list.isError ? 'alert' : 'status'} className={`m-0 text-sm ${list.isError ? 'text-red-600' : 'text-slate-600'}`}>
            {list.isError ? errorMessage(list.error) : list.isFetching ? 'Đang tải…' : 'Không tìm thấy dòng nghỉ này.'}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
