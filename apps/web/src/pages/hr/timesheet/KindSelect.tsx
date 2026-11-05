import type { AbsenceKindDto } from '@careers/shared';
import { Flower2, HeartHandshake, type LucideIcon } from 'lucide-react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger } from '../../../vendor/shadcn-grid/components/ui/select';
import { codeOf } from '../../../vendor/shadcn-grid/lib/codes';
import { COUNTINGS, type Counting } from './AbsenceKinds';

/** The events the law names read as what they are; the rest wear their code's icon, as on the sheet. */
const EVENT_ICON: Record<string, LucideIcon> = {
  wedding: HeartHandshake,
  'child-wedding': HeartHandshake,
  'family-wedding': HeartHandshake,
  'funeral-close': Flower2,
  'funeral-family': Flower2,
};

const GROUPS: { label: string; keys: readonly string[] }[] = [
  { label: 'Thường gặp', keys: ['annual', 'late', 'unpaid', 'other-paid'] },
  { label: 'Cưới, tang', keys: ['wedding', 'child-wedding', 'funeral-close', 'funeral-family', 'family-wedding'] },
  { label: 'BHXH', keys: ['maternity', 'sick'] },
];

/** The icon on a tile of the code's colour, so a reason looks like its mark on the sheet. */
export function KindMark({ code, reason }: { code: string; reason?: string }) {
  const look = codeOf(code.replace('/2', ''));
  const Icon = (reason && EVENT_ICON[reason]) || look?.icon;
  return (
    <span aria-hidden="true" className={`inline-flex size-6 shrink-0 items-center justify-center rounded-md border ${look?.tone ?? 'border-slate-200 bg-slate-50'}`}>
      {Icon && <Icon className="size-3.5" />}
    </span>
  );
}

/** "3 ngày": how long the reason usually runs, meant to be seen at a glance. */
export function DaysChip({ days }: { days: number }) {
  return <span className="ml-auto inline-flex h-5 shrink-0 items-center rounded-full bg-blue-600 px-2 text-xs font-semibold whitespace-nowrap text-white tabular-nums">{days} ngày</span>;
}

function KindLine({ kind }: { kind: AbsenceKindDto }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <KindMark code={kind.code} reason={kind.key} />
      <span className="min-w-0 truncate">{kind.name}</span>
      {kind.days ? <DaysChip days={kind.days} /> : null}
    </span>
  );
}

export function KindSelect({ kinds, value, onChange }: { kinds: readonly AbsenceKindDto[]; value: string; onChange: (key: string) => void }) {
  const picked = kinds.find((k) => k.key === value);
  const own = kinds.filter((k) => k.isOwn);
  const groups = [
    ...GROUPS.map((g) => ({ label: g.label, kinds: g.keys.flatMap((key) => kinds.filter((k) => k.key === key)) })),
    ...(own.length > 0 ? [{ label: 'Tự thêm', kinds: own }] : []),
  ];
  return (
    <Select value={value} onValueChange={(v) => onChange(String(v))} items={kinds.map((k) => ({ value: k.key, label: k.name }))}>
      <SelectTrigger aria-label="Lý do" className="w-full bg-white">
        {picked ? <KindLine kind={picked} /> : <span className="text-slate-500">Chọn lý do</span>}
      </SelectTrigger>
      <SelectContent className="min-w-96 max-sm:min-w-0">
        {groups.map((g) => (
          <SelectGroup key={g.label}>
            <SelectLabel className="text-xs font-semibold text-slate-500">{g.label}</SelectLabel>
            {g.kinds.map((k) => <SelectItem key={k.key} value={k.key} className="pr-8"><KindLine kind={k} /></SelectItem>)}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

function CountingLine({ code, label }: { code: Counting; label: string }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <KindMark code={code} />
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}

export function CountingSelect({ value, onChange, label = 'Cách tính' }: { value: Counting; onChange: (code: Counting) => void; label?: string }) {
  const picked = COUNTINGS.find((c) => c.value === value);
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Counting)} items={COUNTINGS}>
      <SelectTrigger aria-label={label} className="w-full bg-white">
        {picked && <CountingLine code={picked.value} label={picked.label} />}
      </SelectTrigger>
      <SelectContent className="min-w-72">
        {COUNTINGS.map((c) => <SelectItem key={c.value} value={c.value} className="pr-8"><CountingLine code={c.value} label={c.label} /></SelectItem>)}
      </SelectContent>
    </Select>
  );
}
