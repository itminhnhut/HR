import type { PayslipListDto, PayslipPersonDto } from '@careers/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api, type PayrollMonthDto } from '../../../../api';
import { useHrMe, useMessageTemplates } from '../../../../api/queries';
import { errorMessage } from '../../parts';
import { SELECT } from '../../timesheet/AbsenceFilterBar';
import { OUTLINE } from '../../timesheet/gridParts';
import { filterLines, type PayrollFilters } from '../payrollModel';
import { PayslipSendDrawer } from './PayslipSendDrawer';
import { emailLink, listedPeople, STATUS_FILTERS, STATUS_PARAM, statusFilterOf, statusWords } from './payslipsModel';

/**
 * Lương › Phiếu lương: everyone of the month with the address their payslip goes to and whether it was sent. HR sends
 * from their own Outlook, one person at a time or several in a row; the web never mails by itself.
 */

export const payslipsKey = (monthKey: string) => ['hr', 'payroll', 'payslips', monthKey];

export const usePayslips = (monthKey: string | null) =>
  useQuery({
    queryKey: payslipsKey(monthKey ?? ''),
    queryFn: () => api.hrPayrollPayslips(monthKey ?? ''),
    enabled: monthKey !== null,
    refetchOnWindowFocus: false,
  });

const TONES = {
  grey: 'text-slate-600',
  green: 'text-emerald-700',
  amber: 'text-amber-700',
  red: 'text-red-600',
} as const;
const money = (n: number) => Math.round(n).toLocaleString('vi-VN');
const HEADS = ['Mã NV', 'Họ và tên', 'Bộ phận', 'Khối', 'Email nhận phiếu lương', 'Thực nhận', 'Trạng thái gửi'];

function PersonRow({
  person,
  isChecked,
  onCheck,
  onOpen,
}: {
  person: PayslipPersonDto;
  isChecked: boolean;
  onCheck: (isOn: boolean) => void;
  onOpen: () => void;
}) {
  const status = statusWords(person.send);
  return (
    <tr onClick={onOpen} className="cursor-pointer border-b hover:bg-slate-50">
      <td className="w-9 p-2" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          aria-label={`Chọn ${person.fullName}`}
          checked={isChecked}
          onChange={(e) => onCheck(e.target.checked)}
          className="size-4 align-middle"
        />
      </td>
      <td className="p-2 text-slate-600">{person.code}</td>
      <td className="p-2 font-medium">{person.fullName}</td>
      <td className="p-2">{person.department || '-'}</td>
      <td className="p-2">{person.block ?? '-'}</td>
      <td className="p-2" onClick={(e) => e.stopPropagation()}>
        {person.email ? (
          <Link to={emailLink(person.employeeId)} title="Sửa ở Chấm công › Nhân viên" className="text-slate-800">
            {person.email}
          </Link>
        ) : (
          <Link
            to={emailLink(person.employeeId)}
            aria-label={`Thiếu email ${person.fullName}: bấm để nhập`}
            className="font-medium text-red-600"
          >
            Thiếu email
          </Link>
        )}
      </td>
      <td className="p-2 text-right tabular-nums">{money(person.netPay)}</td>
      <td className={`p-2 ${TONES[status.tone]}`}>{status.text}</td>
      <td className="p-2 text-right">
        <button
          type="button"
          aria-label={`Xem và gửi phiếu lương ${person.fullName}`}
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className={`${OUTLINE} h-8 text-xs`}
        >
          Xem · Gửi
        </button>
      </td>
    </tr>
  );
}

function Toolbar({
  list,
  shown,
  checked,
  filter,
  onFilter,
  onWalk,
}: {
  list: PayslipListDto;
  shown: number;
  checked: number;
  filter: string;
  onFilter: (value: string) => void;
  onWalk: () => void;
}) {
  const reason = list.canSend ? undefined : 'Tháng lương chưa duyệt nên chưa gửi được.';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Trạng thái gửi"
        value={filter}
        onChange={(e) => onFilter(e.target.value)}
        className={`${SELECT} pr-8`}
      >
        {STATUS_FILTERS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
      <span className="text-sm text-slate-600">{shown} người</span>
      <button
        type="button"
        disabled={checked === 0 || !list.canSend}
        title={reason}
        onClick={onWalk}
        className="ts-field ml-auto inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-50"
      >
        {checked > 0 ? `Gửi lần lượt ${checked} người` : 'Tích người cần gửi'}
      </button>
    </div>
  );
}

/** The open drawer: one person (`?pl=<id>`), or the people of a walk one after the other. */
function useOpenPerson(people: readonly PayslipPersonDto[]) {
  const [params, setParams] = useSearchParams();
  const [walk, setWalk] = useState<{ ids: readonly string[]; index: number } | null>(null);
  const write = (change: (next: URLSearchParams) => void) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        change(next);
        return next;
      },
      { replace: true },
    );
  const openId = walk ? walk.ids[walk.index] : params.get('pl');
  return {
    params,
    person: people.find((p) => p.employeeId === openId) ?? null,
    walk,
    open: (id: string) => write((next) => next.set('pl', id)),
    close: () => {
      setWalk(null);
      write((next) => next.delete('pl'));
    },
    startWalk: (ids: readonly string[]) => setWalk({ ids, index: 0 }),
    next: () => setWalk((w) => (w && w.index + 1 < w.ids.length ? { ...w, index: w.index + 1 } : null)),
    setFilter: (value: string) => write((next) => (value ? next.set(STATUS_PARAM, value) : next.delete(STATUS_PARAM))),
  };
}

export function PayslipsTab({ month, filters }: { month: PayrollMonthDto; filters: PayrollFilters }) {
  const qc = useQueryClient();
  const query = usePayslips(month.monthKey);
  const templates = useMessageTemplates();
  const me = useHrMe();
  const [checked, setChecked] = useState<readonly string[]>([]);
  const view = useOpenPerson(query.data?.people ?? []);
  const filter = statusFilterOf(view.params.get(STATUS_PARAM));
  const shownIds = useMemo(() => new Set(filterLines(month.lines, filters).map((l) => l.employeeId)), [month, filters]);
  const mark = useMutation({
    mutationFn: (input: { employeeIds: string[]; sent: boolean }) => api.hrPayrollPayslipsMark(month.monthKey, input),
    onSuccess: (data) => qc.setQueryData(payslipsKey(month.monthKey), data),
  });
  if (query.isPending) return <p className="m-0 text-sm text-slate-600">Đang tải danh sách phiếu lương…</p>;
  if (query.isError)
    return (
      <p role="alert" className="m-0 text-sm text-red-600">
        {errorMessage(query.error)}
      </p>
    );
  const list = query.data;
  const people = listedPeople(list.people, shownIds, filter);
  const picked = people.filter((p) => checked.includes(p.employeeId));
  const template = templates.data?.templates.find((t) => t.key === 'payslip');
  const check = (ids: readonly string[], isOn: boolean) =>
    setChecked((prev) => (isOn ? [...new Set([...prev, ...ids])] : prev.filter((id) => !ids.includes(id))));
  return (
    <section aria-label="Phiếu lương" className="ts-card flex flex-col gap-2 p-3">
      {!list.canSend && (
        <p role="note" className="m-0 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Tháng lương chưa duyệt: chỉ xem trước được. Duyệt bảng lương rồi mới gửi phiếu lương cho nhân viên.
        </p>
      )}
      <Toolbar
        list={list}
        shown={people.length}
        checked={picked.length}
        filter={filter}
        onFilter={view.setFilter}
        onWalk={() => view.startWalk(picked.map((p) => p.employeeId))}
      />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b text-left">
              <th className="w-9 px-2">
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả người đang hiện"
                  checked={people.length > 0 && picked.length === people.length}
                  onChange={(e) =>
                    check(
                      people.map((p) => p.employeeId),
                      e.target.checked,
                    )
                  }
                  className="size-4 align-middle"
                />
              </th>
              {HEADS.map((h) => (
                <th key={h} className={`h-10 px-2 font-medium ${h === 'Thực nhận' ? 'text-right' : ''}`}>
                  {h}
                </th>
              ))}
              <th aria-label="Xem, gửi" />
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <PersonRow
                key={p.employeeId}
                person={p}
                isChecked={checked.includes(p.employeeId)}
                onCheck={(isOn) => check([p.employeeId], isOn)}
                onOpen={() => view.open(p.employeeId)}
              />
            ))}
          </tbody>
        </table>
      </div>
      {people.length === 0 && <p className="m-0 py-4 text-center text-sm text-slate-600">Không có ai khớp bộ lọc.</p>}
      {view.person && template && (
        <PayslipSendDrawer
          key={view.person.employeeId}
          list={list}
          month={month}
          person={view.person}
          template={template}
          me={me.data}
          walk={view.walk ? { index: view.walk.index, total: view.walk.ids.length, onNext: view.next } : undefined}
          isMarking={mark.isPending}
          markError={mark.isError ? `Chưa ghi được trạng thái gửi: ${errorMessage(mark.error)}` : null}
          onMark={(sent) => mark.mutate({ employeeIds: [view.person?.employeeId ?? ''], sent })}
          onClose={view.close}
        />
      )}
    </section>
  );
}
