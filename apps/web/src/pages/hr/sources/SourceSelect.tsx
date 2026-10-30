import { WEBSITE_SOURCE } from '@careers/shared';
import { useState } from 'react';
import { ApiError } from '../../../api';
import { useSourceActions, useSources } from '../../../api/queries';
import { Button } from '../../../ui/Button';
import { FieldError, SelectField } from '../../../ui/Field';

const NEW = '__new__';

/**
 * "Nguồn hồ sơ" with "+ Thêm nguồn mới…" at the end (spec-custom-sources.md): HR types a name, it is added for
 * everyone and picked at once. Hidden sources are not offered, except the one the application already has.
 */
export function SourceSelect({
  value,
  onChange,
  error,
  current,
  label = 'Nguồn hồ sơ',
}: {
  value: string;
  onChange: (key: string) => void;
  error?: string;
  /** The application's own source when editing it: kept in the list even if hidden since. */
  current?: string;
  label?: string;
}) {
  const sources = useSources().data ?? [];
  const { create } = useSourceActions();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const offered = sources.filter((s) => s.key !== WEBSITE_SOURCE && (!s.hidden || s.key === current));
  const nameError =
    create.error instanceof ApiError ? (create.error.fieldErrors.name ?? create.error.message) : undefined;

  const save = () =>
    create.mutate(name, {
      onSuccess: (source) => {
        onChange(source.key);
        setAdding(false);
        setName('');
      },
    });

  return (
    <div className="flex flex-col gap-1.5">
      <SelectField
        label={label}
        value={adding ? NEW : value}
        onChange={(e) => (e.target.value === NEW ? setAdding(true) : onChange(e.target.value))}
      >
        <option value="">Chọn nguồn…</option>
        {offered.map((s) => (
          <option key={s.key} value={s.key}>
            {s.name}
            {s.hidden ? ' (đã ẩn)' : ''}
          </option>
        ))}
        <option value={NEW}>+ Thêm nguồn mới…</option>
      </SelectField>
      {adding && (
        <div className="flex flex-col gap-2 rounded-control border border-line bg-mist p-3">
          <input
            autoFocus
            value={name}
            maxLength={60}
            placeholder="VD: LinkedIn, Hội chợ việc làm ĐH Bách Khoa"
            aria-label="Tên nguồn mới"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                save();
              }
            }}
            className={`field-focus min-h-11 rounded-control border bg-white px-3 text-sm text-navy ${nameError ? 'border-error' : 'border-field'}`}
          />
          <FieldError>{nameError}</FieldError>
          <span className="flex gap-2">
            <Button size="sm" type="button" disabled={create.isPending || name.trim().length < 2} onClick={save}>
              Thêm nguồn
            </Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => setAdding(false)}>
              Huỷ
            </Button>
          </span>
        </div>
      )}
      <FieldError>{error}</FieldError>
    </div>
  );
}
