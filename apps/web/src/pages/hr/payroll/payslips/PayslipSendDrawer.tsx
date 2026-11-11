import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import type { HrMe, MessageTemplate, PayslipListDto, PayslipPersonDto } from '@careers/shared';
import { ChevronRight, Mail, ReceiptText } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { Link } from 'react-router';
import type { PayrollMonthDto } from '../../../../api';
import { copyText, useFlash } from '../../../../lib/hooks';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../vendor/shadcn-grid/components/ui/dialog';
import { CopyMailButton, CopyMailFailure, useCopyMail } from '../../applicants/CopyMailButton';
import { designedMailHtml } from '../../mail/mailLogos';
import { MailPreview } from '../../mail/MailPreview';
import { OUTLINE } from '../../timesheet/gridParts';
import { payslipOnScreen } from '../excel/fromMonth';
import { PayslipStatus } from './PayslipMarkCell';
import {
  emailLink,
  mailWithPayslipHtml,
  mailWithPayslipText,
  payslipMailOf,
  sendBlock,
  walkWords,
} from './payslipsModel';

/**
 * Phiếu lương of one person, as the mail HR sends: the Mẫu thư template with the payslip inside it. One button copies
 * the designed mail and opens Outlook with the recipient and the subject; HR pastes and presses Gửi. The web then
 * keeps "Đã gửi" for the person, once per mail however often the button is pressed.
 */

export interface PayslipSendDrawerProps {
  list: PayslipListDto;
  month: PayrollMonthDto;
  person: PayslipPersonDto;
  template: MessageTemplate;
  me: HrMe | null | undefined;
  /** Set while HR goes through several people one by one. */
  walk?: { index: number; total: number; onNext: () => void };
  markError: string | null;
  /** The mail went to Outlook, Gmail or a mail app: the web keeps "Đã gửi". Marking by hand is on the list. */
  onSent: () => void;
  onClose: () => void;
}

const LINK = `${OUTLINE} h-9 no-underline text-slate-800`;

function PlainActions({
  mail,
  text,
  isHeld,
  onOpen,
}: {
  mail: ReturnType<typeof payslipMailOf>;
  text: string;
  isHeld: boolean;
  onOpen: () => void;
}) {
  const [copied, flash] = useFlash();
  const gmail = new URL(mail.gmail);
  gmail.searchParams.set('body', text);
  const held = isHeld ? 'pointer-events-none opacity-50' : '';
  return (
    <>
      <a
        href={isHeld ? undefined : gmail.toString()}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={isHeld}
        onClick={onOpen}
        className={`${LINK} ${held}`}
      >
        <Mail className="size-4 text-blue-600" />
        Mở Gmail
      </a>
      {mail.mailto && (
        <a
          href={isHeld ? undefined : mail.mailto}
          aria-disabled={isHeld}
          onClick={onOpen}
          className={`${LINK} ${held}`}
        >
          Mở ứng dụng mail
        </a>
      )}
      <button
        type="button"
        className={`${OUTLINE} h-9`}
        onClick={() => void copyText(text).then((ok) => ok && flash())}
      >
        {copied ? 'Đã sao chép' : 'Sao chép'}
      </button>
    </>
  );
}

export function PayslipSendDrawer(p: PayslipSendDrawerProps) {
  const { list, person, walk } = p;
  const title = useRef<HTMLHeadingElement>(null);
  const recorded = useRef<ReadonlySet<string>>(new Set());
  const slip = useMemo(() => payslipOnScreen(p.month, person.employeeId), [p.month, person.employeeId]);
  const mail = payslipMailOf(p.template, list, person, p.me);
  const html = mailWithPayslipHtml(designedMailHtml(mail.content, mail.details), slip);
  const text = mailWithPayslipText(mail.text, slip);
  const block = sendBlock(list, person);
  const stamp = JSON.stringify([list.monthKey, list.approvalNo, person.employeeId, mail.content]);
  /** One "Đã gửi" per mail, even after a double click. */
  const record = () => {
    if (recorded.current.has(stamp)) return;
    recorded.current = new Set([...recorded.current, stamp]);
    p.onSent();
  };
  const rich = useCopyMail(html, text, mail.outlook, stamp, record);
  return (
    <Dialog open onOpenChange={(o) => !o && p.onClose()}>
      <DialogContent
        initialFocus={title}
        className="top-0! right-0! left-auto! flex h-dvh max-h-dvh! w-full max-w-3xl! translate-x-0! translate-y-0! flex-col gap-0 rounded-none! rounded-l-xl! p-0 max-sm:rounded-none!"
      >
        <DialogHeader className="m-0! border-b px-5! py-4! pr-14!">
          <DialogTitle ref={title} tabIndex={-1} className="flex flex-wrap items-center gap-2 outline-none">
            <ReceiptText className="size-5 shrink-0 text-blue-600" />
            <span className="min-w-0 break-words">{`${walk ? `${walkWords(walk.index, walk.total)} · ` : ''}Phiếu lương · ${person.fullName} · T${p.month.month}/${p.month.year}`}</span>
          </DialogTitle>
          <DialogPrimitive.Description className="sr-only">
            Thư phiếu lương của một người, như sẽ gửi
          </DialogPrimitive.Description>
          <PayslipStatus send={person.send} />
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-5">
          <p className="m-0 text-sm text-slate-600">
            Gửi tới:{' '}
            {person.email ? (
              <strong className="text-slate-900">{person.email}</strong>
            ) : (
              <Link to={emailLink(person.employeeId)} className="font-medium text-red-600">
                Thiếu email — bấm để nhập
              </Link>
            )}
          </p>
          <strong className="text-sm text-slate-900">{mail.content.subject}</strong>
          {mail.missing.length > 0 && (
            <p className="m-0 text-xs text-amber-700">
              {mail.missing.join(', ')} chưa có giá trị. Sửa ở <Link to="/hr/tai-khoan">Tài khoản HR</Link> hoặc{' '}
              <Link to="/hr/mau-thu">Mẫu thư</Link>.
            </p>
          )}
          <MailPreview
            templateKey="payslip"
            title="Xem trước thư phiếu lương"
            html={html}
            className="min-h-[420px] flex-1 rounded-md border"
          />
        </div>
        <footer className="flex flex-col gap-2 border-t px-5 py-3">
          <CopyMailFailure result={rich.result} />
          {block && (
            <p
              role="note"
              className="m-0 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            >
              {block}
            </p>
          )}
          {p.markError && (
            <p role="alert" className="m-0 text-sm text-red-600">
              {p.markError}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span title={block ?? undefined}>
              <CopyMailButton state={rich} disabled={block !== null} />
            </span>
            <PlainActions mail={mail} text={text} isHeld={block !== null} onOpen={record} />
            {walk && (
              <button
                type="button"
                onClick={walk.onNext}
                className="ts-field ml-auto inline-flex h-9 items-center gap-1 rounded-md bg-blue-600 px-4 text-sm font-medium text-white"
              >
                {walk.index + 1 < walk.total ? 'Tiếp' : 'Xong'}
                <ChevronRight className="size-4" />
              </button>
            )}
          </div>
          <p className="m-0 text-xs text-slate-500">
            Bấm "Sao chép &amp; mở Outlook", dán thư (Ctrl+V, máy Mac: Cmd+V) vào Outlook rồi bấm Gửi. Web tự ghi "Đã
            gửi" cho người này; đánh dấu hoặc bỏ đánh dấu bằng tay ở cột Trạng thái gửi của danh sách.
          </p>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
