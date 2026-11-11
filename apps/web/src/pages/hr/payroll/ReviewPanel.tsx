import type { ReviewItem } from '@careers/shared';
import { ArrowRight, CheckCircle2, CircleAlert, TriangleAlert } from 'lucide-react';
import { useRef } from 'react';
import { Link } from 'react-router';
import type { PayrollMonthDto } from '../../../api';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../vendor/shadcn-grid/components/ui/dialog';
import { blockLink, FILTER_PARAMS, isBlockReview } from './payrollModel';

/** Rà soát (spec 11.3): the engine's warnings for the month, red first; a person's warning links to their row. */

const LEVELS = [
  { level: 'red', title: 'Đỏ: phải tích "Đã xem" khi Duyệt', icon: CircleAlert, tone: 'text-red-600' },
  { level: 'yellow', title: 'Vàng: nên xem, không chặn', icon: TriangleAlert, tone: 'text-amber-600' },
] as const;

/** The grid address showing only this person, on the Bảng lương tab, keeping the month. */
function rowLink(search: string, employeeId: string) {
  const next = new URLSearchParams(search);
  next.delete('rs');
  next.set(FILTER_PARAMS.people, employeeId);
  return { pathname: '/hr/luong', search: `?${next.toString()}` };
}

function Item({
  item,
  who,
  block,
  search,
  onClose,
}: {
  item: ReviewItem;
  who: string | null;
  /** The person's block on the month's line: a Khối warning opens the person's form in Chấm công → Nhân viên. */
  block: string | null;
  search: string;
  onClose: () => void;
}) {
  if (!item.employeeId) {
    return (
      <li className="flex min-h-11 items-center gap-2 border-b px-2 py-1.5 text-sm last:border-b-0">
        <span className="shrink-0 rounded bg-slate-100 px-1.5 text-xs font-semibold text-slate-600">Cả tháng</span>
        <span className="flex-1">{item.message}</span>
      </li>
    );
  }
  return (
    <li className="border-b last:border-b-0">
      <Link
        to={
          isBlockReview(item.code)
            ? blockLink({ employeeId: item.employeeId, block })
            : rowLink(search, item.employeeId)
        }
        onClick={onClose}
        className="flex min-h-11 items-center gap-x-2 px-2 py-1.5 text-sm text-slate-800 no-underline hover:bg-slate-50 max-sm:flex-wrap"
      >
        <span className="shrink-0 font-semibold max-sm:w-full">{who ?? item.employeeId}</span>
        <span className="flex-1">{item.message}</span>
        <ArrowRight className="size-4 shrink-0 text-blue-600" />
      </Link>
    </li>
  );
}

export function ReviewPanel({
  open,
  month,
  search,
  onClose,
}: {
  open: boolean;
  month: PayrollMonthDto;
  search: string;
  onClose: () => void;
}) {
  const close = useRef<HTMLButtonElement>(null);
  const names = new Map(month.lines.map((l) => [l.employeeId, `${l.fullName} · ${l.code}`]));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent initialFocus={close} className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{`Rà soát T${month.month}/${month.year}`}</DialogTitle>
        </DialogHeader>
        {month.review.length === 0 ? (
          <p className="m-0 flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 className="size-4" />
            Không có cảnh báo nào.
          </p>
        ) : (
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
            {LEVELS.map(({ level, title, icon: Mark, tone }) => {
              const items = month.review.filter((i) => i.level === level);
              if (items.length === 0) return null;
              return (
                <section key={level} aria-label={title} className="flex flex-col">
                  <h3 className="sticky top-0 m-0 flex items-center gap-1.5 bg-white py-1 text-xs font-semibold text-slate-600">
                    <Mark className={`size-4 shrink-0 ${tone}`} />
                    {`${title} (${items.length})`}
                  </h3>
                  <ul className="m-0 flex list-none flex-col p-0">
                    {items.map((item, i) => (
                      <Item
                        key={`${item.code}-${item.employeeId ?? ''}-${i}`}
                        item={item}
                        who={item.employeeId ? (names.get(item.employeeId) ?? null) : null}
                        block={month.lines.find((l) => l.employeeId === item.employeeId)?.block ?? null}
                        search={search}
                        onClose={onClose}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <button
            ref={close}
            type="button"
            onClick={onClose}
            className="ts-field rounded-md border bg-white px-4 text-sm font-medium hover:bg-slate-50"
          >
            Đóng
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
