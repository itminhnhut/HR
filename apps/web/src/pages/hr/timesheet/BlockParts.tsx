import type { EmployeeBlock, EmployeeDto } from '@careers/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Layers, Lightbulb, X } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../../api';
import { errorMessage } from '../parts';
import { Field } from './dialogs';
import { asBlock, BLOCK_HINT, BLOCK_LABELS, BLOCK_OPTIONS, blockToSave, bulkResultWords, changeBlocks, isBlockSuggested, MISSING_BLOCK, suggestBlock, type BlockChoice, type BulkBlockResult } from './employeeBlock';

const SELECT = 'ts-field min-w-0 rounded-md border bg-white pl-3 text-sm font-normal';

/** BO or KD in the staff table; an amber "Thiếu khối" when HR has not given one, since payroll needs it for % KPI. */
export function BlockBadge({ block }: { block: EmployeeBlock | null }) {
  if (!block) return <span className="inline-flex h-6 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 text-xs font-medium whitespace-nowrap text-amber-900"><AlertTriangle className="size-3" />{MISSING_BLOCK}</span>;
  return <span title={BLOCK_LABELS[block]} className="inline-flex h-6 items-center rounded-full border border-slate-300 bg-white px-2 text-xs font-medium text-slate-800">{block}</span>;
}

/** Khối in the person form: prefilled from the department for a new person, only suggested for an existing one. */
export function BlockField({ choice, error, onPick }: { choice: BlockChoice; error?: string; onPick: (block: string) => void }) {
  const suggestion = suggestBlock(choice.department);
  const isSuggested = isBlockSuggested(choice);
  const value = blockToSave(choice) ?? '';
  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <Field label="Khối" error={error}>
        <select aria-label="Khối" value={value} onChange={(e) => onPick(e.target.value)} className={`${SELECT} w-full`}>
          <option value="">Chưa có khối</option>
          {BLOCK_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      {isSuggested && <p className="m-0 flex items-center gap-1.5 text-xs text-blue-700"><Lightbulb className="size-3.5 shrink-0" />Gợi ý theo bộ phận, đổi được trước khi lưu.</p>}
      {!choice.isNew && !value && (
        <p className="m-0 flex flex-wrap items-center gap-1.5 text-xs text-blue-700">
          <Lightbulb className="size-3.5 shrink-0" />Gợi ý: {BLOCK_LABELS[suggestion]} (theo bộ phận)
          <button type="button" onClick={() => onPick(suggestion)} className="rounded border border-blue-300 bg-white px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-50">Dùng gợi ý</button>
        </p>
      )}
      <p className="m-0 text-xs text-slate-500">{BLOCK_HINT}</p>
    </div>
  );
}

/** The people ticked in the staff table: give all of them one block, one save per person. */
export function BulkBlockBar({ people, result, onDone, onClear }: { people: readonly EmployeeDto[]; result: BulkBlockResult | null; onDone: (result: BulkBlockResult | null) => void; onClear: () => void }) {
  const qc = useQueryClient();
  const [picked, setPicked] = useState('');
  const block = asBlock(picked);
  const change = useMutation({
    mutationFn: (to: EmployeeBlock) => changeBlocks(people, to, api.hrUpdateEmployee, (e) => errorMessage(e)),
    onSuccess: (done) => {
      void qc.invalidateQueries({ queryKey: ['hr', 'employees'] });
      void qc.invalidateQueries({ queryKey: ['hr', 'timesheet'] });
      onDone(done);
    },
  });
  if (people.length === 0 && !result) return null;
  return (
    <div role="group" aria-label="Đổi khối nhiều người" className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
      {people.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 font-medium"><Layers className="size-4 text-blue-600" />Đã chọn {people.length} người</span>
          <select aria-label="Khối mới" value={picked} onChange={(e) => setPicked(e.target.value)} className={`${SELECT} h-9`}>
            <option value="">Chọn khối mới</option>
            {BLOCK_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button type="button" disabled={!block || change.isPending} onClick={() => block && change.mutate(block)} className="ts-field inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-sm font-medium whitespace-nowrap text-white hover:bg-blue-700 disabled:opacity-50">{change.isPending ? 'Đang lưu…' : `Đổi khối ${people.length} người`}</button>
          <button type="button" onClick={onClear} className="ts-field inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm font-medium whitespace-nowrap hover:bg-slate-50">Bỏ chọn</button>
        </div>
      )}
      {result && (
        <div role="status" className="flex items-start gap-2">
          <div className="flex-1">
            <p className="m-0 font-medium">{bulkResultWords(result)}</p>
            {result.failed.length > 0 && <ul className="m-0 mt-1 list-disc pl-5 text-red-700">{result.failed.map((f) => <li key={f}>{f}</li>)}</ul>}
          </div>
          <button type="button" aria-label="Đóng kết quả đổi khối" onClick={() => onDone(null)} className="rounded p-1 hover:bg-blue-100"><X className="size-4" /></button>
        </div>
      )}
    </div>
  );
}
