import { Skeleton } from '../../../vendor/shadcn-grid/components/ui/skeleton';

const ROWS = [0, 1, 2, 3, 4, 5, 6];

function Status() {
  return <span role="status" className="sr-only">Đang tải…</span>;
}

/** The sheet's outline while it loads: the bars, then the table. */
export function SheetSkeleton() {
  return (
    <>
      <Status />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="ts-card flex flex-col gap-2 p-3">
        <Skeleton className="h-10 w-full" />
        {ROWS.map((r) => <Skeleton key={r} className="h-7 w-full" />)}
      </div>
    </>
  );
}

export function TabSkeleton() {
  return (
    <div className="ts-card flex flex-col gap-2 p-4">
      <Status />
      <Skeleton className="h-9 w-48" />
      {ROWS.map((r) => <Skeleton key={r} className="h-8 w-full" />)}
    </div>
  );
}
