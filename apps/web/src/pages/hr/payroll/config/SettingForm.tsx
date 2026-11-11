import type { PayrollPersonDto } from '@careers/shared';
import { useState } from 'react';
import { Input } from '../../../../vendor/shadcn-grid/components/ui/input';
import { EntryForm, ProfileField } from '../profiles/profileParts';
import { fieldErrorsOf } from '../profiles/profileQueries';
import { fromWords, type ConfigItem, type ConfigRow } from './configModel';
import { errorMessage } from '../../parts';
import { useSettingChange, useSettingForPeople } from './configQueries';
import { PeoplePicker } from './PeoplePicker';
import { ValueEditor } from './ValueEditor';

/**
 * One change to a setting, never a rewrite of a past month: a new version from a month (or date) for everyone or one
 * person, or "Sửa lỗi" of a stored row on its own date (R5). The API's field errors land on their fields.
 */

export type FormMode =
  | { kind: 'everyone' }
  | { kind: 'person'; employeeId: string | null; value?: unknown }
  | { kind: 'correct'; row: ConfigRow };

const firstFrom = (item: ConfigItem, month: string) => (item.scope === 'month' ? month : `${month}-01`);

function initialValue(item: ConfigItem, mode: FormMode): unknown {
  if (mode.kind === 'correct') return mode.row.value;
  if (mode.kind === 'person' && mode.value !== undefined) return mode.value;
  return item.value;
}

const nameOf = (people: readonly PayrollPersonDto[], id: string) => {
  const found = people.find((x) => x.employeeId === id);
  return found ? `${found.code} · ${found.fullName}` : id;
};

function Scope({ isPeople, onChange }: { isPeople: boolean; onChange: (isPeople: boolean) => void }) {
  const option = 'inline-flex min-h-11 items-center gap-2 text-sm font-medium';
  return (
    <fieldset className="m-0 flex flex-wrap gap-x-5 border-0 p-0 sm:col-span-2">
      <legend className="sr-only">Áp dụng cho</legend>
      <label className={option}>
        <input type="radio" name="pham-vi" checked={!isPeople} onChange={() => onChange(false)} />
        Tất cả
      </label>
      <label className={option}>
        <input type="radio" name="pham-vi" checked={isPeople} onChange={() => onChange(true)} />
        Chọn nhân viên (nhiều)
      </label>
    </fieldset>
  );
}

export function SettingForm(p: {
  item: ConfigItem;
  month: string;
  mode: FormMode;
  people: readonly PayrollPersonDto[];
  onClose: () => void;
}) {
  const { item, mode } = p;
  const [value, setValue] = useState<unknown>(() => initialValue(item, mode));
  const [from, setFrom] = useState(() => firstFrom(item, p.month));
  const [source, setSource] = useState(mode.kind === 'correct' ? mode.row.source : '');
  const [isPeople, setIsPeople] = useState(mode.kind === 'person');
  const [picked, setPicked] = useState<string[]>(mode.kind === 'person' && mode.employeeId ? [mode.employeeId] : []);
  const [notice, setNotice] = useState<string | null>(null);
  const change = useSettingChange(p.onClose);
  const many = useSettingForPeople();
  const error = isPeople ? many.error : change.error;
  const errors = fieldErrorsOf(error);
  const savePeople = () => {
    if (picked.length === 0) return setNotice('Chọn ít nhất một nhân viên.');
    setNotice(null);
    many.mutate(
      picked.map((employeeId) => ({ key: item.key, employeeId, from, value, source })),
      {
        onSuccess: ({ saved, failed }) => {
          if (failed.length === 0) return p.onClose();
          const lines = failed.map((f) => `${nameOf(p.people, f.employeeId)}: ${errorMessage(f.error)}`);
          setNotice(`Đã lưu ${saved.length}/${picked.length} người. Chưa lưu: ${lines.join('; ')}`);
          setPicked(failed.map((f) => f.employeeId));
        },
      },
    );
  };
  const save = () => {
    if (mode.kind === 'correct') return change.mutate({ kind: 'correct', id: mode.row.id, value, source });
    if (isPeople) return savePeople();
    change.mutate({ kind: 'add', input: { key: item.key, employeeId: null, from, value, source } });
  };
  const title =
    mode.kind === 'correct'
      ? `Sửa lỗi mức từ ${fromWords(mode.row.from)}`
      : isPeople
        ? 'Ghi đè cho nhân viên đã chọn'
        : 'Đổi cho tất cả';
  return (
    <EntryForm
      label={title}
      isBusy={change.isPending || many.isPending}
      error={error}
      onSave={save}
      onCancel={p.onClose}
    >
      <p className="m-0 text-sm font-semibold sm:col-span-2">{title}</p>
      {mode.kind !== 'correct' && item.perPerson && <Scope isPeople={isPeople} onChange={setIsPeople} />}
      {mode.kind !== 'correct' && isPeople && (
        <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
          <PeoplePicker people={p.people} picked={picked} onChange={setPicked} />
          {errors.employeeId && <span className="text-xs text-red-600">{errors.employeeId}</span>}
        </div>
      )}
      {notice && (
        <p role="alert" className="m-0 text-sm text-red-600 sm:col-span-2">
          {notice}
        </p>
      )}
      <ProfileField label="Giá trị" error={errors.value} isWide>
        <ValueEditor settingKey={item.key} label={item.label} value={value} onChange={setValue} />
      </ProfileField>
      {mode.kind === 'correct' ? (
        <p className="m-0 text-xs text-slate-600 sm:col-span-2">
          Giữ ngày áp dụng {fromWords(mode.row.from)}; dòng cũ ghi "đã thay".
        </p>
      ) : (
        <ProfileField
          label="Áp dụng từ"
          error={errors.from}
          hint={item.scope === 'month' ? 'Tháng lương; tháng trước giữ mức cũ.' : 'Ngày áp dụng của văn bản luật.'}
        >
          <Input
            type={item.scope === 'month' ? 'month' : 'date'}
            aria-label="Áp dụng từ"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-white"
          />
        </ProfileField>
      )}
      <ProfileField label="Nguồn / lý do" error={errors.source} isWide={mode.kind !== 'correct'}>
        <Input
          aria-label="Nguồn / lý do"
          value={source}
          placeholder="vd: NĐ 161/2026, quyết định công ty"
          onChange={(e) => setSource(e.target.value)}
          className="bg-white"
        />
      </ProfileField>
    </EntryForm>
  );
}
