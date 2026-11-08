import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Wallet } from 'lucide-react';
import { leaveApi } from './leaveApi';

const number = (n: number) => String(n).replace('.', ',');

/** Annual leave left, counted on the server as the sheet counts it. A note only: saving never waits on it. */
export function LeaveBalanceHint({ personId, from, to, code }: { personId: string; from: string; to: string; code: string }) {
  const isAsked = !!personId && !!from && !!to && from <= to;
  const balance = useQuery({
    queryKey: ['hr', 'timesheet', 'leave-balance', personId, from, to, code],
    queryFn: () => leaveApi.balance(personId, { from, to, code }),
    enabled: isAsked,
    staleTime: 30_000,
  });
  if (!isAsked || !balance.data) return null;
  const { now, after, overdrawn } = balance.data;
  return (
    <div role="status" aria-label="Phép năm" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="inline-flex items-center gap-1.5 text-slate-700"><Wallet className="size-4 text-blue-600" /><span>{`Phép còn: ${number(now)} ngày (tính đến hôm nay)`}</span></span>
      <span className="text-slate-600">{`sau đơn này còn ${number(after)}`}</span>
      {overdrawn > 0 && <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-0.5 font-medium text-amber-900"><AlertTriangle className="size-4 shrink-0" />{`Vượt ${number(overdrawn)} ngày, phần vượt không lương`}</span>}
    </div>
  );
}
