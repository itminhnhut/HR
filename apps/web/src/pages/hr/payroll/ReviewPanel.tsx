import type { ReviewItem } from '@careers/shared';
import { CheckCircle2, ChevronRight, CircleAlert, TriangleAlert } from 'lucide-react';
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
import { reviewHint, reviewRows, reviewTarget, type ReviewRow, type ReviewTarget } from './reviewModel';

/** Rà soát (spec 11.3): the engine's warnings for the month, red first; each one opens the place that fixes it. */

const LEVELS = [
  { level: 'red', title: 'Đỏ: phải tích "Đã xem" khi Duyệt', icon: CircleAlert, tone: 'text-red-600' },
  { level: 'yellow', title: 'Vàng: nên xem, không chặn', icon: TriangleAlert, tone: 'text-amber-600' },
] as const;

/** The warning, and under it what to do about it when the warning does not say (F07). */
function Words({ message, code }: { message: string; code: string }) {
  const hint = reviewHint(code);
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span>{message}</span>
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </span>
  );
}

const GO = 'inline-flex shrink-0 items-center gap-0.5 text-xs font-medium whitespace-nowrap text-blue-700';

/** One yellow warning several people share: one row, the people behind it on a click (F06). */
function Group({
  row,
  nameOf,
  targetOf,
  onClose,
}: {
  row: Extract<ReviewRow, { kind: 'group' }>;
  nameOf: (employeeId: string) => string;
  targetOf: (item: ReviewItem) => ReviewTarget | null;
  onClose: () => void;
}) {
  return (
    <li className="border-b last:border-b-0">
      <details className="group">
        <summary className={`${ROW} cursor-pointer list-none hover:bg-slate-50`}>
          <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-slate-500 group-open:rotate-90" />
          <Words message={row.message} code={row.code} />
          <span className="shrink-0 rounded-full bg-amber-100 px-2 text-xs font-semibold text-amber-900">
            {`${row.items.length} người`}
          </span>
        </summary>
        <ul className="m-0 flex list-none flex-col p-0 pb-1 pl-8">
          {row.items.map((item) => {
            const target = targetOf(item);
            const name = nameOf(item.employeeId ?? '');
            return (
              <li key={item.employeeId} className="text-sm">
                {target ? (
                  <Link
                    to={target.to}
                    onClick={onClose}
                    className="flex min-h-9 items-center gap-2 px-2 text-slate-800 no-underline hover:bg-slate-50"
                  >
                    <span className="flex-1 font-medium">{name}</span>
                    <span className={GO}>
                      {target.words}
                      <ChevronRight aria-hidden="true" className="size-3.5" />
                    </span>
                  </Link>
                ) : (
                  <span className="flex min-h-9 items-center px-2">{name}</span>
                )}
              </li>
            );
          })}
        </ul>
      </details>
    </li>
  );
}

const ROW = 'flex min-h-11 items-center gap-x-2 px-2 py-1.5 text-sm text-slate-800 max-sm:flex-wrap';

function Item({
  item,
  who,
  target,
  onClose,
}: {
  item: ReviewItem;
  who: string | null;
  /** Where the warning is fixed; null: nothing to open. */
  target: ReviewTarget | null;
  onClose: () => void;
}) {
  const body = (
    <>
      {item.employeeId ? (
        <span className="shrink-0 font-semibold max-sm:w-full">{who ?? item.employeeId}</span>
      ) : (
        <span className="shrink-0 rounded bg-slate-100 px-1.5 text-xs font-semibold text-slate-600">Cả tháng</span>
      )}
      <Words message={item.message} code={item.code} />
    </>
  );
  if (!target) return <li className={`border-b last:border-b-0 ${ROW}`}>{body}</li>;
  return (
    <li className="border-b last:border-b-0">
      <Link to={target.to} onClick={onClose} className={`${ROW} no-underline hover:bg-slate-50`}>
        {body}
        <span className={GO}>
          {target.words}
          <ChevronRight aria-hidden="true" className="size-3.5" />
        </span>
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
  const targetOf = (item: ReviewItem) =>
    reviewTarget(item, {
      monthKey: month.monthKey,
      search,
      block: month.lines.find((l) => l.employeeId === item.employeeId)?.block ?? null,
    });
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
                    {reviewRows(items).map((row, i) =>
                      row.kind === 'group' ? (
                        <Group
                          key={`${row.code}-${i}`}
                          row={row}
                          nameOf={(id) => names.get(id) ?? id}
                          targetOf={targetOf}
                          onClose={onClose}
                        />
                      ) : (
                        <Item
                          key={`${row.item.code}-${row.item.employeeId ?? ''}-${i}`}
                          item={row.item}
                          who={row.item.employeeId ? (names.get(row.item.employeeId) ?? null) : null}
                          target={targetOf(row.item)}
                          onClose={onClose}
                        />
                      ),
                    )}
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
