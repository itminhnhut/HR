import { ChevronRight } from 'lucide-react';
import type { MouseEvent } from 'react';
import type { ProfilePartId } from './ProfileDrawer';
import { hasLeftBy, showDay, type ProfileRow, type ProfileSummary } from './profileModel';

/**
 * One person of the Hồ sơ lương list. Every value is the way to where it is edited (F28): a cell opens the person's
 * profile on that part, with the add form already shown when the value is missing; anywhere else on the row opens
 * the profile at the top.
 */

export type OpenAt = { part: ProfilePartId; isAdding: boolean };

/** Seven columns from a tablet up; the five facts of the month viewed join them on a wide screen (F20). */
export const LIST_COLS =
  'md:grid-cols-[5rem_minmax(0,1.4fr)_minmax(0,1fr)_3.5rem_6rem_minmax(0,1.6fr)_auto] xl:grid-cols-[4.5rem_minmax(9rem,1.8fr)_minmax(0,0.8fr)_3rem_5.5rem_6.5rem_2.5rem_6rem_6.5rem_5.5rem_minmax(0,1.3fr)_auto]';

const BADGE = 'inline-flex h-6 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap';
const money = (n: number) => n.toLocaleString('vi-VN');

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
      {hasLeftBy(row, today) && (
        <span className={`${BADGE} bg-slate-100 text-slate-700`}>{`Đã nghỉ ${showDay(row.leftOn).slice(0, 5)}`}</span>
      )}
    </span>
  );
}

export interface ListFact {
  id: string;
  /** The column's name, and the chip's on a narrow screen. */
  label: string;
  text: string;
  at: OpenAt;
  /** What a click does, for the tooltip and a screen reader. */
  action: string;
  isMissing: boolean;
  align: string;
}

/**
 * The five facts of a row and where each one is edited. A value that is missing opens the add form of its part;
 * one that is there opens the part, its items each with their own "Sửa". Someone without a row in the month viewed
 * shows "–" and opens the part as it is.
 */
export function listFactsOf(s: ProfileSummary | null): ListFact[] {
  const fact = (
    id: string,
    label: string,
    text: string,
    part: ProfilePartId,
    add: string | null,
    align = '',
  ): ListFact => ({
    id,
    label,
    text,
    at: { part, isAdding: add !== null },
    action: add ?? `Mở phần ${label} để xem và sửa`,
    isMissing: add !== null,
    align,
  });
  const noAccount = s?.account === 'Thiếu';
  return [
    fact('gross', 'Gross', s ? money(s.gross) : '–', 'muc', null, 'xl:justify-end'),
    fact(
      'npt',
      'NPT',
      s?.dependants === null || !s ? '–' : String(s.dependants),
      'npt',
      s && !s.dependants ? 'Thêm người phụ thuộc' : null,
      'xl:justify-center',
    ),
    fact('tax', 'Thuế', s?.tax ?? '–', 'cam-ket', s && s.tax !== 'Có cam kết' ? 'Thêm cam kết thuế' : null),
    fact(
      'recurring',
      '(32) định kỳ',
      s && s.recurring !== 0 ? money(s.recurring) : '–',
      'dinh-ky',
      s && s.recurring === 0 ? 'Thêm khoản (32) định kỳ' : null,
      'xl:justify-end',
    ),
    fact('account', 'Tài khoản', s?.account ?? '–', 'ngan-hang', noAccount ? 'Thêm tài khoản ngân hàng' : null),
  ];
}

const CELL =
  'inline-flex min-h-9 min-w-0 items-center rounded border-0 bg-transparent px-1 text-sm tabular-nums text-blue-700 underline decoration-dotted underline-offset-2 hover:bg-blue-100 hover:decoration-solid';

function FactButton(p: { fact: ListFact; name: string; isChip: boolean; onOpen: (at: OpenAt) => void }) {
  const { fact } = p;
  const open = (event: MouseEvent) => {
    // The row itself opens the profile at the top: a cell opens its own part instead.
    event.stopPropagation();
    p.onOpen(fact.at);
  };
  const tone = fact.id === 'account' && fact.isMissing ? 'font-semibold text-red-700' : '';
  const label = `${fact.label} của ${p.name}: ${fact.text}. ${fact.action}`;
  if (p.isChip)
    return (
      <button
        type="button"
        onClick={open}
        aria-label={label}
        className={`${CELL} min-h-11 gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs no-underline ${tone}`}
      >
        <span className="font-normal text-slate-500">{fact.label}</span>
        {fact.text}
      </button>
    );
  return (
    <span className={`flex min-w-0 max-xl:hidden ${fact.align}`}>
      <button type="button" onClick={open} aria-label={label} title={fact.action} className={`${CELL} ${tone}`}>
        <span className="truncate">{fact.text}</span>
      </button>
    </span>
  );
}

export function PersonRow(p: { row: ProfileRow; today: string; onOpen: (at?: OpenAt) => void }) {
  const { row } = p;
  const facts = listFactsOf(row.summary);
  return (
    // The whole row is a mouse target; the name is the button a keyboard and a screen reader use.
    <li
      onClick={() => p.onOpen()}
      className={`grid min-h-14 w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b px-3 py-2 text-left last:border-b-0 hover:bg-blue-50 ${LIST_COLS}`}
    >
      <span className="text-sm text-slate-600 tabular-nums max-md:hidden">{row.code}</span>
      <span className="flex min-w-0 flex-col">
        {/* A full name is never cut: it wraps onto a second line when the column is narrow. */}
        <button
          type="button"
          aria-label={`Mở hồ sơ ${row.fullName}`}
          className="min-h-9 border-0 bg-transparent p-0 text-left text-sm font-medium break-words text-slate-900 max-sm:min-h-11"
        >
          {row.fullName}
        </button>
        <span className="truncate text-xs text-slate-600 md:hidden">
          {[row.code, row.department, row.block].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className="truncate text-sm max-md:hidden">{row.department || '–'}</span>
      <span className="text-sm max-md:hidden">{row.block ?? '–'}</span>
      <span className="text-sm tabular-nums max-md:hidden">{showDay(row.joinedOn)}</span>
      {facts.map((fact) => (
        <FactButton key={fact.id} fact={fact} name={row.fullName} isChip={false} onOpen={p.onOpen} />
      ))}
      <span className="max-md:order-last max-md:col-span-2">
        <Badges row={row} today={p.today} />
      </span>
      <ChevronRight className="size-4 text-slate-400" />
      {/* Narrower than a wide screen: the same five values as chips, each a full tap target. */}
      <span className="col-span-full flex flex-wrap gap-1.5 xl:hidden">
        {facts.map((fact) => (
          <FactButton key={fact.id} fact={fact} name={row.fullName} isChip onOpen={p.onOpen} />
        ))}
      </span>
    </li>
  );
}
