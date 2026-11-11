import type { PayslipChangesDto, PayslipChangeEventDto } from '@careers/shared';
import type { Payslip, PayslipFormat } from '../excel/payslip';
import { sentTimeWords } from './payslipsModel';

/**
 * "Thay đổi từ lần gửi" without React: the payslip as it went out against the payslip now, line by line with the
 * words of the payslip itself, net pay first; and in one sentence each, what happened to the month since.
 */

export interface FigureRow {
  id: string;
  label: string;
  /** "of which" lines sit under another line, as on the payslip. */
  isDetail: boolean;
  format: PayslipFormat;
  /** Null: that payslip does not say (an approval older than the web kept this line): "—". */
  sent: number | null;
  now: number | null;
  /** Now less sent; null when one side is not known. */
  diff: number | null;
  isChanged: boolean;
}

interface Flat {
  id: string;
  label: string;
  isDetail: boolean;
  format: PayslipFormat;
  amount: number | null;
}

/** Every line of a payslip under a name that is the same on both payslips: its section, its label, its turn. */
function flat(slip: Payslip | null): Flat[] {
  if (!slip) return [];
  const seen = new Map<string, number>();
  const lines = slip.sections.flatMap((section) =>
    section.lines.map((line): Flat => {
      const name = `${section.title}|${line.label}`;
      const turn = seen.get(name) ?? 0;
      seen.set(name, turn + 1);
      const amount = typeof line.amount === 'number' ? line.amount : null;
      return {
        id: `${name}|${turn}`,
        label: line.label,
        isDetail: line.isDetail ?? false,
        format: line.format,
        amount,
      };
    }),
  );
  const net: Flat = { id: 'net', label: 'Thực nhận', isDetail: false, format: 'money', amount: slip.netPay ?? null };
  return [net, ...lines];
}

/**
 * The figures of both payslips side by side, net pay first, then in the order of the payslip now; a line only the
 * payslip sent had comes last. A line neither payslip has a number for is left out.
 */
export function figureRows(sent: Payslip | null, now: Payslip | null): FigureRow[] {
  const before = flat(sent);
  const after = flat(now);
  const ids = [...new Set([...after.map((l) => l.id), ...before.map((l) => l.id)])];
  return ids.flatMap((id): FigureRow[] => {
    const a = before.find((l) => l.id === id);
    const b = after.find((l) => l.id === id);
    const shape = b ?? a;
    if (!shape) return [];
    // A line one payslip does not have at all (a retro item added since) counts as 0 there.
    const sentAmount = a ? a.amount : sent ? 0 : null;
    const nowAmount = b ? b.amount : now ? 0 : null;
    if (sentAmount === null && nowAmount === null) return [];
    const diff = sentAmount === null || nowAmount === null ? null : nowAmount - sentAmount;
    const { label, isDetail, format } = shape;
    return [
      { id, label, isDetail, format, sent: sentAmount, now: nowAmount, diff, isChanged: diff !== null && diff !== 0 },
    ];
  });
}

const plain = (n: number, digits: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: digits });

/** A figure as the payslip writes it; "—" when it is not known. */
export function figureWords(amount: number | null, format: PayslipFormat): string {
  if (amount === null) return '—';
  if (format === 'money') return Math.round(amount).toLocaleString('vi-VN');
  if (format === 'percent') return `${plain(amount * 100, 2)}%`;
  return plain(amount, 2);
}

/** "+500.000", "−1,5", "0"; "—" when one side is not known. */
export function diffWords(diff: number | null, format: PayslipFormat): string {
  if (diff === null) return '—';
  if (diff === 0) return '0';
  return `${diff > 0 ? '+' : '−'}${figureWords(Math.abs(diff), format)}`;
}

function eventWords(e: PayslipChangeEventDto): string {
  const when = `lúc ${sentTimeWords(e.at)} bởi ${e.by}`;
  if (e.kind === 'approved') return `Duyệt lại thành bản duyệt lần ${e.approvalNo} ${when}.`;
  return `Mở lại ${when}${e.reason ? `, lý do: "${e.reason}"` : ''}.`;
}

/** Why the payslip sent may be out of date, one sentence each, in the order it happened. */
export function whyWords(dto: PayslipChangesDto): string[] {
  if (!dto.sent) return ['Phiếu lương của người này chưa được gửi lần nào.'];
  const sent = `Đã gửi lúc ${sentTimeWords(dto.sent.at)} bởi ${dto.sent.by}, theo bản duyệt lần ${dto.sent.approvalNo}.`;
  const isDraft = dto.current.status !== 'approved' && dto.current.status !== 'paid';
  const draft = isDraft ? ['Tháng đang là bản nháp: số "Bây giờ" còn có thể đổi cho tới khi duyệt lại.'] : [];
  return [sent, ...dto.events.map(eventWords), ...draft];
}

/** The Nhật ký tab on this person and month. */
export const logAddress = (monthKey: string, code: string) =>
  `/hr/luong/nhat-ky?ky=${monthKey}&ma=${encodeURIComponent(code)}`;
