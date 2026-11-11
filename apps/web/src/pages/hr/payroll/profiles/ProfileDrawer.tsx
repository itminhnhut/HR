import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import type { PayrollPersonCheckDto, PayrollProfileDto } from '@careers/shared';
import { ArrowRight, Check, ClipboardList, ExternalLink, IdCard, Settings, Trash2, UserRound } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { api } from '../../../../api';
import { ErrorState } from '../../../../ui/feedback';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../vendor/shadcn-grid/components/ui/dialog';
import { errorMessage } from '../../parts';
import { ConfirmDialog } from '../../timesheet/dialogs';
import { CommitmentsSection, DependantsSection, RecurringSection } from './FactSections';
import { LevelSection, type Catalogue } from './LevelSection';
import { BankSection, OpeningSection } from './MoneySections';
import { CHECK_ITEMS, checkValueWords, monthWords, showDay, type ProfileRow } from './profileModel';
import { Section, SourceTag } from './profileParts';
import { useProfile, useProfileSave } from './profileQueries';

/** One person's Hồ sơ lương (spec 11.5): what Chấm công knows, what is still open, and every part HR enters. */

export interface DrawerContext {
  catalogue: Catalogue;
  today: string;
  /** The payroll month of today, "YYYY-MM": where a new range starts. */
  month: string;
  regionName: (id: string) => string;
  /** From the grid's group A (`?phan=muc`): the pay month whose level to mark, the drawer opening on the levels. */
  levelsOf: string | null;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="m-0 truncate text-sm font-medium">{value || '–'}</dd>
    </div>
  );
}

function PersonInfo({
  profile,
  row,
  regionName,
}: {
  profile: PayrollProfileDto;
  row: ProfileRow | undefined;
  regionName: (id: string) => string;
}) {
  const p = profile.person;
  return (
    <Section id="ho-so-cham-cong" icon={UserRound} title="Từ Chấm công">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <SourceTag source="auto" />
        Tự lấy từ Chấm công, chỉ xem ở đây.
        <Link
          to="/hr/cham-cong/nhan-vien"
          className="ml-auto inline-flex min-h-9 items-center gap-1 text-sm font-medium text-blue-700"
        >
          Sửa ở Chấm công
          <ExternalLink className="size-3.5" />
        </Link>
      </div>
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        <Fact label="Bộ phận" value={row?.department ?? ''} />
        <Fact label="Khu vực" value={row?.regionId ? regionName(row.regionId) : ''} />
        <Fact label="Khối" value={p.block ?? 'Chưa có'} />
        <Fact label="Loại NV" value={p.employment === 'probation' ? 'Thử việc' : 'Chính thức'} />
        <Fact label="Ngày vào" value={showDay(p.joinedOn)} />
        <Fact label="Chính thức" value={showDay(row?.officialOn ?? null)} />
        <Fact
          label="Nghỉ việc"
          value={profile.leavingFrom ? `Nghỉ từ ${showDay(profile.leavingFrom)}` : showDay(p.leftOn)}
        />
      </dl>
    </Section>
  );
}

function CheckRow({
  employeeId,
  item,
  catalogue,
}: {
  employeeId: string;
  item: PayrollPersonCheckDto;
  catalogue: Catalogue;
}) {
  const meta = CHECK_ITEMS[item.item];
  const confirm = useProfileSave(
    employeeId,
    () => api.hrPayrollConfirmCheck({ item: item.item, employeeId, confirmed: true }),
    () => `Đã xác nhận ${meta.label.toLowerCase()}.`,
  );
  const jump = () => document.getElementById(meta.section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <li className="flex min-h-11 flex-wrap items-center gap-2 border-b py-1 last:border-b-0">
      <span
        aria-hidden="true"
        className={`size-2 shrink-0 rounded-full ${item.level === 'red' ? 'bg-red-500' : 'bg-amber-400'}`}
      />
      <button
        type="button"
        onClick={jump}
        className="flex min-h-9 min-w-0 flex-1 basis-48 flex-wrap items-center gap-x-1.5 text-left text-sm hover:text-blue-700"
      >
        <span className="font-medium whitespace-nowrap">{meta.label}:</span>
        <span className="min-w-0 break-words text-slate-600">
          {checkValueWords(item.value, catalogue)}
          {item.isDefault && !item.value.includes('mặc định') ? ' (mặc định)' : ''}
        </span>
        <ArrowRight className="size-3.5 shrink-0 text-blue-600" />
      </button>
      <button
        type="button"
        disabled={confirm.isPending}
        onClick={() => confirm.mutate(undefined, { onError: (e) => toast.error(errorMessage(e)) })}
        className="ts-field inline-flex items-center gap-1.5 rounded-md border bg-white px-2.5 text-xs font-medium whitespace-nowrap hover:bg-slate-50"
      >
        <Check className="size-3.5 text-green-600" />
        Đã kiểm
      </button>
    </li>
  );
}

function MissingList({
  employeeId,
  items,
  catalogue,
}: {
  employeeId: string;
  items: readonly PayrollPersonCheckDto[];
  catalogue: Catalogue;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-label="Còn thiếu" className="border-b bg-amber-50/60 px-5 py-3">
      <h3 className="m-0 flex items-center gap-2 text-sm font-semibold text-amber-900">
        <ClipboardList className="size-4" />
        {`Còn thiếu: ${items.length} mục trước tháng lương đầu`}
      </h3>
      <p className="m-0 text-xs text-amber-900/80">Bấm một mục để tới ô nhập; xong thì bấm Đã kiểm.</p>
      <ul className="m-0 mt-1 list-none p-0">
        {items.map((i) => (
          <CheckRow key={i.item} employeeId={employeeId} item={i} catalogue={catalogue} />
        ))}
      </ul>
    </section>
  );
}

function Overrides({ profile }: { profile: PayrollProfileDto }) {
  if (profile.overrides.length === 0) return null;
  return (
    <Section id="ho-so-rieng" icon={Settings} title="Cấu hình riêng" hint="Sửa ở tab Cấu hình.">
      <ul className="m-0 list-none p-0 text-sm">
        {profile.overrides.map((o) => (
          <li key={o.id} className="border-b py-1.5 last:border-b-0">
            <span className="font-medium">{o.key}</span>
            <span className="text-slate-600">{` · từ ${o.from.length === 7 ? monthWords(o.from) : showDay(o.from)}${o.stop ? ' · ngừng' : ''}`}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function DeleteProfile({ profile, onDeleted }: { profile: PayrollProfileDto; onDeleted: () => void }) {
  const [isAsking, setIsAsking] = useState(false);
  const id = profile.person.employeeId;
  const remove = useProfileSave(
    id,
    () => api.hrPayrollDeleteProfile(id),
    () => `Đã xoá hồ sơ lương của ${profile.person.fullName}.`,
  );
  if (profile.versions.length === 0) return null;
  return (
    <div className="px-5 py-4">
      <button
        type="button"
        onClick={() => setIsAsking(true)}
        className="ts-field inline-flex items-center gap-2 rounded-md px-3 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        <Trash2 className="size-4" />
        Xoá hồ sơ lương
      </button>
      <ConfirmDialog
        open={isAsking}
        title={`Xoá hồ sơ lương của ${profile.person.fullName}? Hồ sơ đã dùng ở tháng duyệt không xoá được.`}
        isBusy={remove.isPending}
        onCancel={() => setIsAsking(false)}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSettled: () => setIsAsking(false),
            onSuccess: onDeleted,
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      />
    </div>
  );
}

function Body({
  employeeId,
  row,
  context,
  onClose,
}: {
  employeeId: string;
  row: ProfileRow | undefined;
  context: DrawerContext;
  onClose: () => void;
}) {
  const profile = useProfile(employeeId);
  if (profile.isPending) return <p className="m-0 p-5 text-sm text-slate-500">Đang tải hồ sơ…</p>;
  if (profile.isError)
    return <ErrorState onRetry={() => void profile.refetch()} message={errorMessage(profile.error)} />;
  const p = profile.data;
  return (
    <>
      <MissingList employeeId={employeeId} items={row?.open ?? []} catalogue={context.catalogue} />
      <PersonInfo profile={p} row={row} regionName={context.regionName} />
      <LevelSection profile={p} catalogue={context.catalogue} focusMonth={context.levelsOf} />
      <DependantsSection profile={p} month={context.month} />
      <CommitmentsSection profile={p} today={context.today} />
      <RecurringSection profile={p} month={context.month} />
      <OpeningSection profile={p} today={context.today} />
      <BankSection profile={p} today={context.today} />
      <Overrides profile={p} />
      <DeleteProfile profile={p} onDeleted={onClose} />
    </>
  );
}

export function ProfileDrawer({
  employeeId,
  row,
  context,
  onClose,
}: {
  employeeId: string;
  row: ProfileRow | undefined;
  context: DrawerContext;
  onClose: () => void;
}) {
  // Focus starts on the title, so a phone's keyboard does not jump up over the drawer.
  const title = useRef<HTMLHeadingElement>(null);
  const name = row ? `${row.fullName} · ${row.code}` : 'Hồ sơ lương';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        initialFocus={title}
        className="top-0! right-0! left-auto! flex h-dvh max-h-dvh! w-full max-w-2xl! translate-x-0! translate-y-0! flex-col gap-0 rounded-none! rounded-l-xl! p-0 max-sm:rounded-none!"
      >
        <DialogHeader className="m-0! border-b px-5! py-4! pr-14!">
          <DialogTitle ref={title} tabIndex={-1} className="flex flex-wrap items-center gap-2 outline-none">
            <IdCard className="size-5 text-blue-600" />
            {name}
            {row && !row.hasProfile && (
              <span className="rounded-full bg-red-100 px-2 text-xs font-medium text-red-700">Thiếu hồ sơ</span>
            )}
          </DialogTitle>
          <DialogPrimitive.Description className="sr-only">
            Mức lương, người phụ thuộc, cam kết, khoản định kỳ, số dư đầu năm, ngân hàng
          </DialogPrimitive.Description>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Body employeeId={employeeId} row={row} context={context} onClose={onClose} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
