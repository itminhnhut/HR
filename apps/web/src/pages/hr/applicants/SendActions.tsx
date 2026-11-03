import {
  gmailComposeUrl,
  MAILTO_SAFE_LENGTH,
  mailtoUrl,
  outlookComposeUrl,
  renderMailText,
  type ApplicationDetailDto,
  type ContactChannel,
  type HrMe,
  type TemplateKey,
} from '@careers/shared';
import { useRef } from 'react';
import { useLogContact } from '../../../api/queries';
import { copyText, useFlash, useMediaQuery } from '../../../lib/hooks';
import { Icon } from '../../../ui/icons';
import { errorMessage } from '../parts';
import { designedMailHtml } from '../mail/mailLogos';
import { CopyMailButton, CopyMailFailure, useCopyMail } from './CopyMailButton';
import type { MailDraft } from './useMailDraft';

/** One log line per message and channel, even after a double click; a failed write can be retried. */
function useRecordContact(app: ApplicationDetailDto, templateKey: TemplateKey, onError: (message: string) => void) {
  const log = useLogContact();
  const logged = useRef<ReadonlySet<string>>(new Set());
  return (channel: ContactChannel, message: string) => {
    const stamp = `${channel}:${message}`;
    if (logged.current.has(stamp)) return;
    logged.current = new Set([...logged.current, stamp]);
    log.mutate(
      { id: app.id, templateKey, channel },
      {
        onError: (e) => {
          logged.current = new Set([...logged.current].filter((s) => s !== stamp));
          onError(`Chưa ghi được lịch sử liên hệ: ${errorMessage(e)}`);
        },
      },
    );
  };
}

const secondaryLink = 'border border-silver bg-white text-navy hover:bg-mist';
const actionLink = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-sm no-underline';

/** Gmail and the mail app: plain text only, from the same content as the designed mail. */
function PlainMailLinks({
  gmail,
  mailto,
  onOpen,
}: {
  gmail: string;
  /** null: too long for a mail app to take. */
  mailto: string | null;
  onOpen: (channel: ContactChannel) => void;
}) {
  // Gmail's web compose link does not survive on phones (inbox or app store), so phones get the mail app first.
  const isPhone = useMediaQuery('(max-width: 639px)');
  return (
    <>
      <a
        href={gmail}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onOpen('gmail')}
        className={`${isPhone ? 'order-3' : 'order-2'} ${secondaryLink} ${actionLink}`}
      >
        <Icon name="mail" size={16} />
        Mở Gmail{isPhone ? ' (web)' : ''}
      </a>
      {mailto && (
        <a
          href={mailto}
          onClick={() => onOpen('mailto')}
          className={`${isPhone ? 'order-2' : 'order-3'} ${secondaryLink} ${actionLink}`}
        >
          <Icon name="external" size={16} />
          Mở ứng dụng mail
        </a>
      )}
    </>
  );
}

/** Below the buttons, not among them. On phones only what changes the choice stays, the buttons need the room. */
function SendHints({
  email,
  isLong,
  from,
}: {
  email: string | null;
  isLong: boolean;
  from: string | null | undefined;
}) {
  return (
    <div className="flex flex-col gap-0.5 text-xs text-muted">
      {!email && <span className="text-sm">Không có email: sao chép rồi gửi qua Zalo.</span>}
      <span className="font-medium text-navy">
        Dán xong trong Outlook: bấm biểu tượng dán cạnh nội dung, chọn Paste as is (phím P) để giữ màu và font.
      </span>
      {isLong && (
        <span className="max-sm:hidden">Thư dài, ứng dụng mail có thể cắt bớt: dùng Gmail hoặc Sao chép.</span>
      )}
      <span className="max-sm:hidden">
        Mở Gmail: thư gửi từ Gmail đang đăng nhập trên máy này
        {from ? ` (nên là ${from})` : ''}, kiểm tra người gửi trước khi bấm Gửi.
      </span>
    </div>
  );
}

function CopyPlainButton({ text, onCopied, className }: { text: string; onCopied: () => void; className: string }) {
  const [copied, flash] = useFlash();
  return (
    <button
      type="button"
      onClick={() =>
        copyText(text).then((ok) => {
          if (!ok) return;
          flash();
          onCopied();
        })
      }
      className={`order-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-field bg-white px-4 text-sm text-body hover:bg-mist ${className}`}
    >
      <Icon name={copied ? 'check' : 'copy'} size={16} />
      {copied ? 'Đã sao chép' : 'Sao chép'}
    </button>
  );
}

export function SendActions({
  app,
  me,
  draft,
  onError,
}: {
  app: ApplicationDetailDto;
  me: HrMe | null | undefined;
  draft: MailDraft;
  onError: (message: string) => void;
}) {
  const { content, details } = draft;
  const record = useRecordContact(app, content.key, onError);
  const text = renderMailText(content, details);
  const stamp = JSON.stringify([content, details]);
  const rich = useCopyMail(
    designedMailHtml(content, details),
    text,
    outlookComposeUrl(app.email, content.subject),
    stamp,
    () => record('copy_html', stamp),
  );
  const mailto = app.email ? mailtoUrl(app.email, content.subject, text) : '';
  const isLong = mailto.length > MAILTO_SAFE_LENGTH;
  return (
    <footer className="flex max-h-[55dvh] flex-col gap-2.5 overflow-y-auto border-t border-line bg-white px-5 py-3 max-sm:px-4">
      <CopyMailFailure result={rich.result} />
      {/* Always in view, whichever side HR has scrolled; on phones within reach of one thumb. */}
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="flex shrink-0 flex-wrap gap-2 max-sm:grid max-sm:grid-cols-2">
          <CopyMailButton state={rich} className="order-1 max-sm:col-span-2" />
          {app.email && (
            <PlainMailLinks
              gmail={gmailComposeUrl(app.email, content.subject, text, me?.contactEmail)}
              mailto={isLong ? null : mailto}
              onOpen={(channel) => record(channel, stamp)}
            />
          )}
          <CopyPlainButton
            text={text}
            onCopied={() => record('copy', stamp)}
            className={app.email && isLong ? '' : 'max-sm:col-span-2'}
          />
        </div>
        <SendHints email={app.email} isLong={isLong} from={me?.contactEmail} />
      </div>
    </footer>
  );
}
