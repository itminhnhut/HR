import {
  BENEFIT_MAX,
  MAX_BENEFITS,
  ROADMAP_ITEM_MAX,
  ROADMAP_MILESTONES,
  standardBenefits,
  type JobTemplate,
} from '@careers/shared';
import { useState, type FormEvent, type ReactNode } from 'react';
import { SITE } from '../../../lib/site';
import { Button } from '../../../ui/Button';
import { Checkbox, FieldError, TextField } from '../../../ui/Field';
import { Icon } from '../../../ui/icons';
import { sameList } from './model';

/**
 * One line while the job uses the company default, opened only when this job differs.
 * "Đã sửa riêng" + "Dùng lại mẫu chung" once it does.
 */
function DefaultBlock({
  title,
  summary,
  isDefault,
  open,
  onOpen,
  onReset,
  children,
}: {
  title: string;
  summary: string;
  isDefault: boolean;
  open: boolean;
  onOpen: () => void;
  onReset: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-control border border-line bg-mist px-4 py-3">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium text-navy">{title}</span>
          <span className="text-[13px] text-slate">
            {isDefault ? 'Theo mẫu chung' : 'Đã sửa riêng cho tin này'} · {summary}
          </span>
        </span>
        <span className="flex flex-wrap gap-2">
          {!isDefault && (
            <Button variant="ghost" size="sm" icon="copy" onClick={onReset}>
              Dùng lại mẫu chung
            </Button>
          )}
          {!open && (
            <Button variant="outline" size="sm" icon="pencil" onClick={onOpen}>
              Sửa cho tin này
            </Button>
          )}
        </span>
      </div>
      {open && children}
    </div>
  );
}

export function BenefitsField({
  value,
  template,
  extraBenefits,
  error,
  onChange,
}: {
  value: string[];
  template: JobTemplate;
  extraBenefits: string[];
  error?: string;
  onChange: (next: string[]) => void;
}) {
  const standard = standardBenefits(template);
  const isDefault = sameList(value, standard);
  const [open, setOpen] = useState(!isDefault);
  const [draft, setDraft] = useState('');
  const options = [...new Set([...template.benefits.map((b) => b.label), ...extraBenefits, ...value])];
  const full = value.length >= MAX_BENEFITS;

  // Keep the order of the list, so the job page reads the same way every time.
  const toggle = (label: string, on: boolean) =>
    onChange(on ? options.filter((o) => o === label || value.includes(o)) : value.filter((v) => v !== label));

  const add = (e: FormEvent) => {
    e.preventDefault();
    const label = draft.trim().slice(0, BENEFIT_MAX);
    if (!label || full) return;
    if (!value.some((v) => v.toLowerCase() === label.toLowerCase())) onChange([...value, label]);
    setDraft('');
  };

  return (
    <DefaultBlock
      title="Quyền lợi"
      summary={`${value.length} quyền lợi`}
      isDefault={isDefault}
      open={open}
      onOpen={() => setOpen(true)}
      onReset={() => onChange(standard)}
    >
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {options.map((label) => (
          <Checkbox
            key={label}
            checked={value.includes(label)}
            disabled={full && !value.includes(label)}
            onChange={(e) => toggle(label, e.target.checked)}
            className="min-h-11 items-center text-[15px] text-navy"
          >
            {label}
          </Checkbox>
        ))}
      </div>
      {/* Not a nested <form>: the job form wraps this, so Enter is handled on the input. */}
      <div className="flex flex-wrap items-end gap-2.5">
        <TextField
          label="Thêm quyền lợi khác"
          placeholder="vd: Cấp laptop làm việc"
          maxLength={BENEFIT_MAX}
          disabled={full}
          value={draft}
          className="min-w-[min(100%,280px)] flex-1"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) add(e);
          }}
        />
        <Button variant="outline" icon="plus" disabled={!draft.trim() || full} onClick={add} className="min-h-[52px]">
          Thêm
        </Button>
      </div>
      {full && <span className="text-xs text-muted">Tối đa {MAX_BENEFITS} quyền lợi.</span>}
      <FieldError>{error}</FieldError>
    </DefaultBlock>
  );
}

export function RoadmapField({
  value,
  template,
  error,
  onChange,
}: {
  value: string[];
  template: JobTemplate;
  error?: string;
  onChange: (next: string[]) => void;
}) {
  const isDefault = sameList(value, template.roadmap);
  const [open, setOpen] = useState(!isDefault);
  const items = ROADMAP_MILESTONES.map((_, i) => value[i] ?? '');
  const filled = items.filter((t) => t.trim()).length;

  return (
    <DefaultBlock
      title="Lộ trình 2 tháng thử việc"
      summary={filled ? `${filled} mốc` : 'Không hiện lộ trình'}
      isDefault={isDefault}
      open={open}
      onOpen={() => setOpen(true)}
      onReset={() => onChange(template.roadmap)}
    >
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {ROADMAP_MILESTONES.map((when, i) => (
          <li key={when}>
            <TextField
              label={when}
              maxLength={ROADMAP_ITEM_MAX}
              placeholder="Để trống nếu không cần mốc này"
              value={items[i]}
              onChange={(e) => onChange(items.map((t, j) => (j === i ? e.target.value : t)))}
            />
          </li>
        ))}
      </ol>
      <span className="text-xs text-muted">Để trống cả 5 mốc thì trang tin không hiện lộ trình.</span>
      <FieldError>{error}</FieldError>
    </DefaultBlock>
  );
}

export function AddressField({
  value,
  error,
  onChange,
}: {
  value: string | null;
  error?: string;
  onChange: (next: string | null) => void;
}) {
  const atOffice = value === null;
  return (
    <DefaultBlock
      title="Địa chỉ làm việc"
      summary={atOffice ? SITE.officeAddress : 'địa chỉ riêng'}
      isDefault={atOffice}
      open={!atOffice}
      onOpen={() => onChange('')}
      onReset={() => onChange(null)}
    >
      <TextField
        label="Địa chỉ làm việc cho tin này"
        placeholder="Số nhà, đường, phường, quận"
        maxLength={200}
        autoFocus
        icon="pin"
        value={value ?? ''}
        error={error}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
        <Icon name="info" size={13} />
        Trang tin hiện nút "Chỉ đường" theo địa chỉ này. Bản đồ chỉ hiện với địa chỉ văn phòng.
      </span>
    </DefaultBlock>
  );
}
