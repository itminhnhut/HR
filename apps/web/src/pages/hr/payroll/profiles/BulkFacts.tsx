import { PAYROLL_INSURANCE_PAID, type PayrollPersonDto } from '@careers/shared';
import { useQueryClient } from '@tanstack/react-query';
import { FileSignature, HandCoins, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { api } from '../../../../api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../vendor/shadcn-grid/components/ui/dialog';
import { DateField } from '../../timesheet/DateField';
import { PeoplePicker } from '../config/PeoplePicker';
import { bulkSummary, INSURANCE_PAID_LAW, saveForPeople, type BulkResult } from './bulkModel';
import { monthWords } from './profileModel';
import { MonthInput, NumberInput, OUTLINE_BUTTON, PRIMARY_BUTTON, ProfileField } from './profileParts';

/**
 * Hồ sơ lương for many people at once: a signed tax commitment, or "Công ty trả thay BH" in (32). HR ticks the people,
 * fills the fact once, and each person is saved with their own request; the report stays open with who was refused.
 */

type Kind = 'commitment' | 'insurance-paid';

const ACTIONS: Record<Kind, { button: string; icon: LucideIcon; hint: string }> = {
  commitment: {
    button: 'Thêm cam kết thuế cho nhiều người',
    icon: FileSignature,
    hint: 'Cam kết ký riêng (mẫu 08). HĐ thử việc đã kèm cam kết trong hợp đồng: chỉ cần khi mục đó bị tắt.',
  },
  'insurance-paid': {
    button: 'Công ty trả thay BH cho nhiều người',
    icon: HandCoins,
    hint: 'Mỗi tháng tự cộng vào (32) đúng bằng BH người đó đóng: (28) + (29) + (30). Không gõ số tiền.',
  },
};

function Report({ result }: { result: BulkResult | null }) {
  if (!result) return null;
  const tone = result.failed.length ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-green-200 bg-green-50';
  return (
    <div role="status" className={`flex flex-col gap-1 rounded-md border px-3 py-2 text-sm ${tone}`}>
      <span className="font-medium">{bulkSummary(result)}</span>
      {result.failed.length > 0 && (
        <ul className="m-0 list-disc pl-5">
          {result.failed.map((f) => (
            <li key={f.employeeId}>{`${f.name}: ${f.message}`}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The people, the fact's own fields, the save for everyone ticked and its report. */
function BulkDialog(p: {
  kind: Kind;
  people: readonly PayrollPersonDto[];
  canSave: boolean;
  run: (employeeId: string) => Promise<unknown>;
  onClose: () => void;
  children: ReactNode;
}) {
  const qc = useQueryClient();
  const [picked, setPicked] = useState<string[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const action = ACTIONS[p.kind];
  const save = async () => {
    setIsBusy(true);
    setResult(await saveForPeople(p.people, picked, p.run));
    setIsBusy(false);
    // Profiles, the checklist and every payroll month computed from them.
    void qc.invalidateQueries({ queryKey: ['hr', 'payroll'] });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && p.onClose()}>
      <DialogContent className="flex max-h-dvh flex-col gap-3 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{action.button}</DialogTitle>
          <DialogDescription>{action.hint}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">{p.children}</div>
        <PeoplePicker people={p.people} picked={picked} onChange={setPicked} />
        <Report result={result} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={p.onClose} className={OUTLINE_BUTTON}>
            Đóng
          </button>
          <button
            type="button"
            disabled={isBusy || picked.length === 0 || !p.canSave}
            onClick={() => void save()}
            className={PRIMARY_BUTTON}
          >
            {`Lưu cho ${picked.length} người`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface DialogProps {
  people: readonly PayrollPersonDto[];
  month: string;
  today: string;
  onClose: () => void;
}

function CommitmentDialog({ people, today, onClose }: DialogProps) {
  const [d, setD] = useState({ year: Number(today.slice(0, 4)), signedOn: today });
  return (
    <BulkDialog
      kind="commitment"
      people={people}
      canSave={d.year > 0 && !!d.signedOn}
      run={(employeeId) => api.hrPayrollSaveCommitment(employeeId, null, d)}
      onClose={onClose}
    >
      <ProfileField label="Năm thuế" source="auto">
        <NumberInput label="Năm thuế" value={d.year} onChange={(year) => setD({ ...d, year: year ?? 0 })} />
      </ProfileField>
      <DateField
        label="Ngày ký (đang lấy hôm nay)"
        value={d.signedOn}
        onChange={(signedOn) => setD({ ...d, signedOn })}
      />
    </BulkDialog>
  );
}

function InsurancePaidDialog({ people, month, onClose }: DialogProps) {
  const [d, setD] = useState({ fromMonth: month, toMonth: '', taxable: false });
  const item = { kind: PAYROLL_INSURANCE_PAID, amount: 0, note: '', ...d, toMonth: d.toMonth || null };
  return (
    <BulkDialog
      kind="insurance-paid"
      people={people}
      canSave={!!d.fromMonth}
      run={(employeeId) => api.hrPayrollSaveRecurring(employeeId, null, item)}
      onClose={onClose}
    >
      <ProfileField label="Từ tháng" source="auto" hint={`Đang xem ${monthWords(month)}.`}>
        <MonthInput label="Từ tháng" value={d.fromMonth} onChange={(fromMonth) => setD({ ...d, fromMonth })} />
      </ProfileField>
      <ProfileField label="Đến tháng" hint="Để trống: hằng tháng tới khi dừng.">
        <MonthInput label="Đến tháng" value={d.toMonth} onChange={(toMonth) => setD({ ...d, toMonth })} />
      </ProfileField>
      <TaxableChoice isTaxable={d.taxable} onChange={(taxable) => setD({ ...d, taxable })} />
    </BulkDialog>
  );
}

/** "Tính thuế" of the insurance paid back: off as HR's file, with what the law says next to it. */
export function TaxableChoice({ isTaxable, onChange }: { isTaxable: boolean; onChange: (next: boolean) => void }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
      <label className="flex min-h-9 items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={isTaxable} onChange={(e) => onChange(e.target.checked)} />
        Tính thuế
      </label>
      {!isTaxable && (
        <p className="m-0 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {INSURANCE_PAID_LAW}
        </p>
      )}
    </div>
  );
}

/** The two buttons over the list of Hồ sơ lương, and the dialog of the one clicked. */
export function BulkFacts(p: { people: readonly PayrollPersonDto[]; month: string; today: string }) {
  const [openKind, setOpenKind] = useState<Kind | null>(null);
  const dialog = { ...p, onClose: () => setOpenKind(null) };
  return (
    <>
      {(['commitment', 'insurance-paid'] as const).map((kind) => {
        const { button, icon: Icon } = ACTIONS[kind];
        return (
          <button
            key={kind}
            type="button"
            onClick={() => setOpenKind(kind)}
            className="ts-field inline-flex items-center gap-1.5 rounded-md border bg-white px-3 text-sm font-medium hover:bg-slate-50"
          >
            <Icon className="size-4 text-blue-600" />
            {button}
          </button>
        );
      })}
      {openKind === 'commitment' && <CommitmentDialog {...dialog} />}
      {openKind === 'insurance-paid' && <InsurancePaidDialog {...dialog} />}
    </>
  );
}
