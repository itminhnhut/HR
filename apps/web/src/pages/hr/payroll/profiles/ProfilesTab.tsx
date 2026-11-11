import type { PayrollChecklistDto, PayrollPersonDto } from '@careers/shared';
import { ChevronRight, ClipboardList, FileSpreadsheet, UserPlus, Users } from 'lucide-react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { PayrollMonthDto } from '../../../../api';
import { ErrorState } from '../../../../ui/feedback';
import { errorMessage } from '../../parts';
import { useEmployees, useRegions } from '../../timesheet/queries';
import { TabSkeleton } from '../../timesheet/skeletons';
import { BulkFacts } from './BulkFacts';
import { drawerContextOf } from './GridProfileDrawer';
import { ProfileDrawer } from './ProfileDrawer';
import { ProfileFilterBar } from './ProfileFilterBar';
import {
  filterProfiles,
  hasLeftBy,
  monthWords,
  PROFILE_PARAMS,
  profileFiltersOf,
  profileRowsOf,
  showDay,
  statusParam,
  type ProfileFilters,
  type ProfileRow,
} from './profileModel';
import { useChecklist, useProfiles } from './profileQueries';

/** Hồ sơ lương (spec 11.5): everyone from Chấm công with their profile state; a person opens in the drawer. */

const BADGE = 'inline-flex h-6 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap';

function Badges({ row, today }: { row: ProfileRow; today: string }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {row.hasProfile ? (
        <span className={`${BADGE} bg-green-50 text-green-700`}>Có hồ sơ</span>
      ) : (
        <span className={`${BADGE} bg-red-100 text-red-700`}>Thiếu hồ sơ</span>
      )}
      {row.hasOverrides && <span className={`${BADGE} bg-violet-50 text-violet-700`}>Cấu hình riêng</span>}
      {row.open.length > 0 && (
        <span className={`${BADGE} bg-amber-50 text-amber-800`}>{`Còn thiếu ${row.open.length} mục`}</span>
      )}
      {hasLeftBy(row, today) && <span className={`${BADGE} bg-slate-100 text-slate-700`}>Đã nghỉ</span>}
    </span>
  );
}

function PersonRow({ row, today, onOpen }: { row: ProfileRow; today: string; onOpen: () => void }) {
  return (
    <li className="border-b last:border-b-0">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Mở hồ sơ ${row.fullName}`}
        className="grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2 text-left hover:bg-blue-50 md:grid-cols-[5rem_minmax(0,1.4fr)_minmax(0,1fr)_3.5rem_6rem_minmax(0,1.6fr)_auto]"
      >
        <span className="text-sm text-slate-600 tabular-nums max-md:hidden">{row.code}</span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{row.fullName}</span>
          <span className="truncate text-xs text-slate-600 md:hidden">
            {[row.code, row.department, row.block].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className="truncate text-sm max-md:hidden">{row.department || '–'}</span>
        <span className="text-sm max-md:hidden">{row.block ?? '–'}</span>
        <span className="text-sm tabular-nums max-md:hidden">{showDay(row.joinedOn)}</span>
        <span className="max-md:order-last max-md:col-span-2">
          <Badges row={row} today={today} />
        </span>
        <ChevronRight className="size-4 text-slate-400" />
      </button>
    </li>
  );
}

const MISSING_SHOWN = 5;

function MissingBanner(p: {
  missing: readonly PayrollPersonDto[];
  onOpen: (id: string) => void;
  onShowAll: () => void;
}) {
  const { missing, onOpen } = p;
  if (missing.length === 0) return null;
  const more = missing.length - MISSING_SHOWN;
  return (
    <section
      aria-label="Thiếu hồ sơ"
      className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
    >
      <p className="m-0 flex items-center gap-2 font-medium">
        <UserPlus className="size-4 shrink-0" />
        {`${missing.length} người có trong Chấm công, chưa có hồ sơ lương. Tạo hồ sơ: mức điền sẵn từ Khoản lương.`}
      </p>
      <div className="flex flex-wrap gap-2">
        {missing.slice(0, MISSING_SHOWN).map((p) => (
          <button
            key={p.employeeId}
            type="button"
            onClick={() => onOpen(p.employeeId)}
            className="ts-field inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 text-sm font-medium hover:bg-red-100"
          >
            {`${p.code} ${p.fullName}${p.joinedOn ? ` · từ ${showDay(p.joinedOn).slice(0, 5)}` : ''}`}
          </button>
        ))}
        {more > 0 && (
          <button
            type="button"
            onClick={p.onShowAll}
            className="ts-field inline-flex items-center rounded-md px-3 text-sm font-medium text-red-800 underline hover:bg-red-100"
          >
            {`Xem cả ${missing.length} người`}
          </button>
        )}
      </div>
    </section>
  );
}

function ChecklistBanner({ checklist }: { checklist: PayrollChecklistDto | undefined }) {
  if (!checklist || checklist.unconfirmed === 0) return null;
  return (
    <p
      role="status"
      className="m-0 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      <ClipboardList className="size-4 shrink-0" />
      {`Danh sách kiểm trước ${monthWords(checklist.month)} (${checklist.unconfirmed} mục chưa xác nhận). Mở từng người để xem mục còn thiếu.`}
    </p>
  );
}

const HEADS = ['Mã NV', 'Họ và tên', 'Bộ phận', 'Khối', 'Ngày vào', 'Hồ sơ'];

function useProfileAddress() {
  const [params, setParams] = useSearchParams();
  const write = (change: (next: URLSearchParams) => void, isTyping = false) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        change(next);
        return next;
      },
      { replace: isTyping },
    );
  const put = (next: URLSearchParams, name: string, value: string | null) =>
    value ? next.set(name, value) : next.delete(name);
  const change = (patch: Partial<ProfileFilters>) =>
    write((next) => {
      if (patch.query !== undefined) put(next, PROFILE_PARAMS.query, patch.query);
      if (patch.depts) put(next, PROFILE_PARAMS.depts, patch.depts.join(','));
      if (patch.blocks) put(next, PROFILE_PARAMS.blocks, patch.blocks.join(','));
      if (patch.status) put(next, PROFILE_PARAMS.status, statusParam(patch.status));
      if (patch.onlyMissing !== undefined) put(next, PROFILE_PARAMS.missing, patch.onlyMissing ? '1' : null);
    }, patch.query !== undefined);
  const { open: _, ...filterNames } = PROFILE_PARAMS;
  return {
    filters: profileFiltersOf(params),
    openId: params.get(PROFILE_PARAMS.open),
    isLevels: params.get('phan') === 'muc',
    change,
    clear: () => write((next) => Object.values(filterNames).forEach((n) => next.delete(n))),
    open: (id: string | null) =>
      write((next) => {
        put(next, PROFILE_PARAMS.open, id);
        next.delete('phan');
      }),
  };
}

export interface ProfilesTabProps {
  period: { year: number; month: number };
  month: PayrollMonthDto | undefined;
  today: string;
  onPeriod: (year: number, month: number) => void;
}

export function ProfilesTab({ period, month, today, onPeriod }: ProfilesTabProps) {
  const list = useProfiles();
  const checklist = useChecklist();
  // Chấm công adds department and region; without it (the demo) the payroll month's lines do.
  const employees = useEmployees();
  const regions = useRegions();
  const address = useProfileAddress();
  const rows = useMemo(
    () => (list.data ? profileRowsOf(list.data, employees.data, month?.lines ?? [], checklist.data) : []),
    [list.data, employees.data, month?.lines, checklist.data],
  );
  const bar = (shownCount: number) => (
    <ProfileFilterBar
      period={period}
      rows={rows}
      filters={address.filters}
      shown={shownCount}
      onPeriod={onPeriod}
      onChange={address.change}
      onClear={address.clear}
    />
  );
  if (list.isPending)
    return (
      <>
        {bar(0)}
        <TabSkeleton />
      </>
    );
  if (list.isError)
    return (
      <>
        {bar(0)}
        <ErrorState onRetry={() => void list.refetch()} message={errorMessage(list.error)} />
      </>
    );
  const shown = filterProfiles(rows, address.filters, today);
  const context = drawerContextOf({
    month,
    today,
    levelsOf: address.isLevels ? `${period.year}-${String(period.month).padStart(2, '0')}` : null,
    regions: regions.data,
  });
  return (
    <>
      {bar(shown.length)}
      <MissingBanner
        missing={list.data.missing}
        onOpen={address.open}
        onShowAll={() => address.change({ onlyMissing: true })}
      />
      <ChecklistBanner checklist={checklist.data} />
      <section aria-label="Hồ sơ lương" className="ts-card flex flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
          <h2 className="m-0 flex flex-1 items-center gap-2 text-base font-semibold">
            <Users className="size-5 text-blue-600" />
            Nhân viên{' '}
            <span className="rounded-full bg-slate-100 px-2 text-sm font-medium text-slate-600">{shown.length}</span>
          </h2>
          <BulkFacts
            people={list.data.people}
            month={`${period.year}-${String(period.month).padStart(2, '0')}`}
            today={today}
          />
          <button
            type="button"
            disabled
            title="Nhập từ Excel của HR chưa dùng được"
            className="ts-field inline-flex items-center gap-1.5 rounded-md border bg-white px-3 text-sm font-medium whitespace-nowrap text-slate-500 opacity-60"
          >
            <FileSpreadsheet className="size-4" />
            Nhập từ Excel
          </button>
        </div>
        <div
          aria-hidden="true"
          className="grid grid-cols-[5rem_minmax(0,1.4fr)_minmax(0,1fr)_3.5rem_6rem_minmax(0,1.6fr)_auto] gap-x-3 border-b px-3 py-2 text-xs font-medium text-slate-500 max-md:hidden"
        >
          {HEADS.map((h) => (
            <span key={h}>{h}</span>
          ))}
          <span className="w-4" />
        </div>
        {shown.length === 0 ? (
          <p className="m-0 py-8 text-center text-sm text-slate-500">Không có nhân viên phù hợp.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {shown.map((r) => (
              <PersonRow key={r.employeeId} row={r} today={today} onOpen={() => address.open(r.employeeId)} />
            ))}
          </ul>
        )}
      </section>
      {address.openId && (
        <ProfileDrawer
          key={address.openId}
          employeeId={address.openId}
          row={rows.find((r) => r.employeeId === address.openId)}
          context={context}
          onClose={() => address.open(null)}
        />
      )}
    </>
  );
}
