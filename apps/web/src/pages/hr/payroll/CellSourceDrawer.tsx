import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import type { PayrollCellKey, PayrollProfileDto } from '@careers/shared';
import { Calculator, IdCard, Lock, Settings2, ShieldCheck } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import type { PayrollLineDto, PayrollMonthDto } from '../../../api';
import { ErrorState } from '../../../ui/feedback';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../vendor/shadcn-grid/components/ui/dialog';
import { errorMessage } from '../parts';
import { buildItems } from './config/configModel';
import { useSettingsMonth } from './config/configQueries';
import { SettingItem } from './config/SettingItem';
import { RULE_14_WORDS, settingKeysOf, sourceOf, type ProfilePart } from './cellSources';
import { YearToDate } from './LeavePayoutParts';
import { monthLockOf } from './monthInputsModel';
import { formatValue, levelsSearch, payrollBands } from './payrollModel';
import { CommitmentsSection, DependantsSection, RecurringSection } from './profiles/FactSections';
import { drawerContextOf } from './profiles/GridProfileDrawer';
import { LevelSection } from './profiles/LevelSection';
import { useProfile, useProfiles } from './profiles/profileQueries';

/**
 * One computed number of Bảng lương, opened over the grid (`?tinh=&nguoi=`): how it is computed with the row's
 * numbers, the settings it reads (changed for everyone or for this person) and the parts of the person's Hồ sơ lương
 * behind it, each edited in place. Saves compute the month again; an approved or paid month shows them read only.
 */

const READ_ONLY = 'm-0 min-w-0 border-0 p-0 disabled:opacity-80';

function Block({ icon: Icon, title, children }: { icon: typeof Calculator; title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2 border-b px-5 py-4">
      <h3 className="m-0 flex items-center gap-2 text-base font-semibold">
        <Icon className="size-4 text-blue-600" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function HowComputed({ line, cell }: { line: PayrollLineDto; cell: PayrollCellKey }) {
  const explain = line.explain[cell];
  const override = line.overrides.find((o) => o.cell === cell);
  const own = line.personSettings.filter((s) => s.cells.includes(cell));
  return (
    <Block icon={Calculator} title="Cách tính">
      <p className="m-0 rounded-md bg-slate-50 px-3 py-2 text-sm break-words tabular-nums">
        {explain?.formula ?? 'Chưa có công thức cho ô này.'}
      </p>
      {override && (
        <p className="m-0 text-sm">{`HR gõ đè ${formatValue('money', override.typed)} (số tính ${formatValue('money', override.computed)}) · ${override.reason}`}</p>
      )}
      {own.map((s) => (
        <p
          key={s.key}
          className="m-0 text-sm font-medium text-teal-800"
        >{`Riêng ${line.fullName} từ ${s.from}: ${s.text}`}</p>
      ))}
      {sourceOf(cell)?.hasRule14 && <p className="m-0 text-xs text-slate-600">{RULE_14_WORDS}</p>}
      {line.note && <p className="m-0 text-xs text-slate-600">{`Ghi chú: ${line.note}`}</p>}
    </Block>
  );
}

function Settings({ line, cell, month }: { line: PayrollLineDto; cell: PayrollCellKey; month: PayrollMonthDto }) {
  const view = useSettingsMonth(month.monthKey);
  const people = useProfiles().data?.people ?? [];
  const [openKey, setOpenKey] = useState<string | null>(null);
  const keys = useMemo(
    () =>
      settingKeysOf(
        cell,
        line,
        month.components.map((c) => c.id),
      ),
    [cell, line, month.components],
  );
  const items = useMemo(() => {
    const all = view.data ? buildItems(view.data) : [];
    return keys.flatMap((k) => all.filter((i) => i.key === k));
  }, [view.data, keys]);
  if (keys.length === 0) return null;
  const body = () => {
    if (view.isPending) return <p className="m-0 text-sm text-slate-500">Đang tải cấu hình…</p>;
    if (view.isError) return <ErrorState onRetry={() => void view.refetch()} message={errorMessage(view.error)} />;
    return (
      <ul className="m-0 list-none rounded-md border bg-white p-0">
        {items.map((item) => (
          <SettingItem
            key={item.key}
            item={item}
            month={month.monthKey}
            people={people}
            person={{ employeeId: line.employeeId, name: line.fullName }}
            isOpen={openKey === item.key}
            onToggle={() => setOpenKey(openKey === item.key ? null : item.key)}
          />
        ))}
      </ul>
    );
  };
  return (
    <Block icon={Settings2} title="Cấu hình dùng">
      <p className="m-0 text-xs text-slate-600">Đổi cho tất cả từ một tháng, hoặc riêng người này.</p>
      {body()}
    </Block>
  );
}

function ProfileParts(p: {
  profile: PayrollProfileDto;
  parts: readonly ProfilePart[];
  month: PayrollMonthDto;
  today: string;
}) {
  const context = drawerContextOf({ month: p.month, today: p.today, levelsOf: p.month.monthKey, regions: undefined });
  const part = (id: ProfilePart) => {
    if (id === 'muc')
      return <LevelSection key={id} profile={p.profile} catalogue={context.catalogue} focusMonth={context.levelsOf} />;
    if (id === 'npt') return <DependantsSection key={id} profile={p.profile} month={context.month} />;
    if (id === 'cam-ket') return <CommitmentsSection key={id} profile={p.profile} today={p.today} />;
    return <RecurringSection key={id} profile={p.profile} month={context.month} />;
  };
  return <>{p.parts.map(part)}</>;
}

/** The whole Hồ sơ lương, on the levels, in place of this drawer. */
function wholeProfileSearch(search: string, employeeId: string): string {
  const next = new URLSearchParams(search);
  next.delete('tinh');
  next.delete('nguoi');
  return levelsSearch(next.toString(), employeeId);
}

function Profile(p: {
  line: PayrollLineDto;
  parts: readonly ProfilePart[];
  month: PayrollMonthDto;
  today: string;
  isLocked: boolean;
}) {
  const { line, parts, month, today } = p;
  const profile = useProfile(line.employeeId);
  const { pathname, search } = useLocation();
  if (parts.length === 0) return null;
  const whole = !p.isLocked && (
    <Link
      to={{ pathname, search: wholeProfileSearch(search, line.employeeId) }}
      className="inline-flex min-h-11 items-center gap-1.5 px-5 text-sm font-medium text-blue-700"
    >
      <IdCard className="size-4" />
      Mở cả Hồ sơ lương
    </Link>
  );
  if (profile.isPending) return <p className="m-0 px-5 py-4 text-sm text-slate-500">Đang tải hồ sơ…</p>;
  if (profile.isError)
    return <ErrorState onRetry={() => void profile.refetch()} message={errorMessage(profile.error)} />;
  return (
    <>
      <ProfileParts profile={profile.data} parts={parts} month={month} today={today} />
      {whole}
    </>
  );
}

export function CellSourceDrawer(p: {
  cell: PayrollCellKey;
  employeeId: string;
  month: PayrollMonthDto;
  today: string;
  onClose: () => void;
}) {
  const title = useRef<HTMLHeadingElement>(null);
  const line = p.month.lines.find((l) => l.employeeId === p.employeeId);
  const column = payrollBands(p.month.components)
    .flatMap((b) => b.columns)
    .find((c) => c.cell === p.cell);
  const source = sourceOf(p.cell);
  const lock = monthLockOf(p.month.status);
  const name = `(${column?.no ?? ''}) ${column?.label ?? p.cell}${line ? ` · ${line.fullName}` : ''}`;
  return (
    <Dialog open onOpenChange={(o) => !o && p.onClose()}>
      <DialogContent
        initialFocus={title}
        className="top-0! right-0! left-auto! flex h-dvh max-h-dvh! w-full max-w-2xl! translate-x-0! translate-y-0! flex-col gap-0 rounded-none! rounded-l-xl! p-0 max-sm:rounded-none!"
      >
        <DialogHeader className="m-0! border-b px-5! py-4! pr-14!">
          <DialogTitle ref={title} tabIndex={-1} className="flex flex-wrap items-center gap-2 outline-none">
            <ShieldCheck className="size-5 text-blue-600" />
            {name}
            {line && column && (
              <span className="text-base font-bold text-green-800 tabular-nums">
                {formatValue(column.kind, column.value(line))}
              </span>
            )}
          </DialogTitle>
          <DialogPrimitive.Description className="sr-only">
            Cách tính, cấu hình và hồ sơ của ô này
          </DialogPrimitive.Description>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {lock && (
            <p
              role="status"
              className="m-0 flex items-center gap-2 border-b bg-amber-50 px-5 py-2 text-sm text-amber-900"
            >
              <Lock className="size-4 shrink-0" />
              {lock}
            </p>
          )}
          {!line ? (
            <p className="m-0 p-5 text-sm text-slate-600">Người này không có dòng ở tháng đang xem.</p>
          ) : (
            <>
              <HowComputed line={line} cell={p.cell} />
              <YearToDate cell={p.cell} year={line.year} />
              <fieldset disabled={!!lock} className={READ_ONLY}>
                <Settings line={line} cell={p.cell} month={p.month} />
                <Profile line={line} parts={source?.profile ?? []} month={p.month} today={p.today} isLocked={!!lock} />
              </fieldset>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
