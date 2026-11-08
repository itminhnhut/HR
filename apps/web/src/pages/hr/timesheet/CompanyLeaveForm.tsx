import type { AbsenceKindDto, EmployeeDto, TimesheetRegionDto } from '@careers/shared';
import { Building2, Check, Pencil, Users, X } from 'lucide-react';
import { ApiError } from '../../../api';
import { Input } from '../../../vendor/shadcn-grid/components/ui/input';
import { errorMessage } from '../parts';
import type { Counting } from './AbsenceKinds';
import { ApproverField } from './ApproverField';
import { AudiencePicker } from './AudiencePicker';
import { audienceOf, audiencePeople, type BatchForm } from './companyLeave';
import { DateField } from './DateField';
import { Field } from './dialogs';
import { CountingSelect, KindSelect } from './KindSelect';
import { failedPersonOf } from './leaveApi';

const NAMES_SHOWN = 8;

/** Who it will come to, before saving: the server leaves out people with no working day in the dates. */
function Preview({ people }: { people: readonly EmployeeDto[] }) {
  const names = people.slice(0, NAMES_SHOWN).map((p) => p.fullName).join(', ');
  const more = people.length > NAMES_SHOWN ? ` và ${people.length - NAMES_SHOWN} người khác` : '';
  return (
    <p className="m-0 flex items-start gap-2 text-sm text-slate-700">
      <Users className="mt-0.5 size-4 shrink-0 text-blue-600" />
      <span><span className="font-semibold">{`Áp dụng cho ${people.length} người`}</span>{people.length > 0 && <span className="text-slate-500">{`: ${names}${more}`}</span>}</span>
    </p>
  );
}

function errorWords(error: unknown): string {
  // One person failed, so nobody was saved: the message names them and why.
  return failedPersonOf(error) ? `${errorMessage(error)} Không ai được lưu.` : errorMessage(error);
}

/** One company day off: name, reason, counting, dates, approver, note, and who. */
export function CompanyLeaveForm({ form, isEditing, kinds, people, regions, isBusy, error, onChange, onReason, onSave, onCancel }: {
  form: BatchForm;
  isEditing: boolean;
  kinds: readonly AbsenceKindDto[];
  people: readonly EmployeeDto[];
  regions: readonly TimesheetRegionDto[];
  isBusy: boolean;
  error: unknown;
  onChange: (patch: Partial<BatchForm>) => void;
  onReason: (key: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const errors = error instanceof ApiError ? error.fieldErrors : {};
  const chosen = audiencePeople(audienceOf(form), people, form.from, form.to);
  const canSave = !!form.name.trim() && !!form.from && chosen.length > 0 && !isBusy;
  return (
    <section aria-label="Đợt nghỉ công ty" className={`ts-card flex flex-col gap-3 p-4 ${isEditing ? 'ring-2 ring-blue-400' : ''}`}>
      <h2 className="m-0 flex items-center gap-2 text-lg font-semibold">
        {isEditing ? <Pencil className="size-5 text-blue-600" /> : <Building2 className="size-5 text-blue-600" />}
        {isEditing ? 'Sửa đợt nghỉ công ty' : 'Thêm đợt nghỉ công ty'}
      </h2>
      <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="md:col-span-2"><Field label="Tên đợt" error={errors.name}><Input aria-label="Tên đợt" value={form.name} placeholder="vd: Công ty nghỉ Tết thêm" onChange={(e) => onChange({ name: e.target.value })} /></Field></div>
        <Field label="Lý do" error={errors.reason}><KindSelect kinds={kinds} value={form.reason} onChange={onReason} /></Field>
        <Field label="Cách tính" error={errors.code}><CountingSelect value={form.code} onChange={(code: Counting) => onChange({ code })} /></Field>
        <DateField label="Từ ngày" value={form.from} error={errors.from} onChange={(from) => onChange({ from, to: form.to && form.to >= from ? form.to : from })} />
        <DateField label="Đến ngày" value={form.to} error={errors.to} onChange={(to) => onChange({ to })} />
        <ApproverField value={form.approvedBy} error={errors.approvedBy} onChange={(approvedBy) => onChange({ approvedBy })} />
        <Field label="Ghi chú" error={errors.note}><Input aria-label="Ghi chú" value={form.note} placeholder="vd: Theo thông báo số 12" onChange={(e) => onChange({ note: e.target.value })} /></Field>
        <div className="md:col-span-2 xl:col-span-4"><AudiencePicker form={form} people={people} regions={regions} onChange={onChange} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Preview people={chosen} />
        <span className="ml-auto flex flex-wrap justify-end gap-2">
          {isEditing && <button type="button" onClick={onCancel} className="ts-field inline-flex items-center gap-2 rounded-md border bg-white px-4 text-sm font-medium hover:bg-slate-50"><X className="size-4" />Huỷ sửa</button>}
          <button type="button" disabled={!canSave} onClick={onSave} className="ts-field inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-50"><Check className="size-4" />{isEditing ? 'Lưu thay đổi' : 'Lưu đợt nghỉ'}</button>
        </span>
      </div>
      {!!error && Object.keys(errors).length === 0 && <p role="alert" className="m-0 text-sm text-red-600">{errorWords(error)}</p>}
    </section>
  );
}
