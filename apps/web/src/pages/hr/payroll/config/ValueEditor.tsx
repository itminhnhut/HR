import { Plus, Trash2 } from 'lucide-react';
import { MoneyInput, MonthInput, NumberInput, OUTLINE_BUTTON } from '../profiles/profileParts';
import { kindOf, TAX_OPTIONS, taxCode, taxValue, type NumberKind } from './valueKinds';

/** The input for one setting's value, picked by its kind; it hands back the value as the API stores it. */

const SELECT = 'ts-field w-full rounded-md border bg-white px-2 text-sm';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const asNumber = (v: unknown) => (typeof v === 'number' ? v : null);
/** 0,015 → 1,5 without float noise. */
const toPercent = (v: number | null) => (v === null ? null : Math.round(v * 1e6) / 1e4);
const fromPercent = (v: number | null) => (v === null ? null : Math.round(v * 1e4) / 1e6);

function NumberField(p: { kind: NumberKind; label: string; value: unknown; onChange: (v: number | null) => void }) {
  if (p.kind === 'money') return <MoneyInput label={p.label} value={asNumber(p.value) ?? 0} onChange={p.onChange} />;
  if (p.kind === 'percent')
    return (
      <span className="flex items-center gap-1.5">
        <NumberInput
          label={`${p.label} (%)`}
          value={toPercent(asNumber(p.value))}
          step={0.01}
          onChange={(v) => p.onChange(fromPercent(v))}
        />
        <span className="text-sm text-slate-500">%</span>
      </span>
    );
  return <NumberInput label={p.label} value={asNumber(p.value)} step={0.5} onChange={p.onChange} />;
}

interface Bracket {
  upTo: number | null;
  rate: number;
}

const bracketsOf = (value: unknown): Bracket[] =>
  Array.isArray(value)
    ? value.filter(isRecord).map((b) => ({ upTo: asNumber(b.upTo), rate: asNumber(b.rate) ?? 0 }))
    : [];

function BracketsEditor({ value, onChange }: { value: unknown; onChange: (next: Bracket[]) => void }) {
  const list = bracketsOf(value);
  const put = (index: number, next: Bracket) => onChange(list.map((b, i) => (i === index ? next : b)));
  return (
    <div className="flex flex-col gap-2">
      {list.map((b, i) => (
        <div key={i} className="grid grid-cols-[1fr_7rem_auto] items-center gap-2">
          <MoneyInput
            label={`Bậc ${i + 1}: đến (để trống là phần còn lại)`}
            value={b.upTo ?? 0}
            onChange={(v) => put(i, { ...b, upTo: v || null })}
          />
          <NumberField
            kind="percent"
            label={`Bậc ${i + 1}: thuế suất`}
            value={b.rate}
            onChange={(v) => put(i, { ...b, rate: v ?? 0 })}
          />
          <button
            type="button"
            aria-label={`Bỏ bậc ${i + 1}`}
            onClick={() => onChange(list.filter((_, j) => j !== i))}
            className="inline-flex size-11 items-center justify-center rounded-md border bg-white hover:bg-red-50"
          >
            <Trash2 className="size-4 text-red-600" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...list, { upTo: null, rate: 0 }])} className={OUTLINE_BUTTON}>
        <Plus className="size-4 text-blue-600" />
        Thêm bậc
      </button>
    </div>
  );
}

export function ValueEditor(p: {
  settingKey: string;
  label: string;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const kind = kindOf(p.settingKey);
  if (!kind) return <p className="m-0 text-sm text-slate-600">Mục này chưa sửa được ở đây.</p>;
  switch (kind.kind) {
    case 'money':
    case 'percent':
    case 'number':
      return <NumberField kind={kind.kind} label={p.label} value={p.value} onChange={p.onChange} />;
    case 'bool':
      return (
        <select
          aria-label={p.label}
          value={p.value === true ? 'yes' : 'no'}
          onChange={(e) => p.onChange(e.target.value === 'yes')}
          className={SELECT}
        >
          <option value="yes">Có</option>
          <option value="no">Không</option>
        </select>
      );
    case 'choice':
      return (
        <select
          aria-label={p.label}
          value={typeof p.value === 'string' ? p.value : ''}
          onChange={(e) => p.onChange(e.target.value)}
          className={SELECT}
        >
          {kind.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case 'tax':
      return (
        <select
          aria-label={p.label}
          value={taxCode(p.value)}
          onChange={(e) => p.onChange(taxValue(e.target.value))}
          className={SELECT}
        >
          {TAX_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case 'month':
      return <MonthInput label={p.label} value={typeof p.value === 'string' ? p.value : ''} onChange={p.onChange} />;
    case 'brackets':
      return <BracketsEditor value={p.value} onChange={p.onChange} />;
    case 'choices': {
      const record = isRecord(p.value) ? p.value : {};
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {kind.fields.map((x) => (
            <label key={x.field} className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600">
              {x.label}
              <select
                aria-label={`${p.label}: ${x.label}`}
                value={String(record[x.field] ?? '')}
                onChange={(e) => p.onChange({ ...record, [x.field]: e.target.value })}
                className={SELECT}
              >
                {x.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      );
    }
    case 'fields': {
      const record = isRecord(p.value) ? p.value : {};
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {kind.fields.map((x) => (
            <label key={x.field} className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600">
              {x.label}
              <NumberField
                kind={x.kind}
                label={`${p.label}: ${x.label}`}
                value={record[x.field]}
                onChange={(v) => p.onChange({ ...record, [x.field]: v })}
              />
            </label>
          ))}
        </div>
      );
    }
  }
}
