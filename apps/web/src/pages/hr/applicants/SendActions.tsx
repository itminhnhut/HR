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
import { useRef, useState, type ReactNode } from 'react';
import { useLogContact } from '../../../api/queries';
import { copyText, useFlash, useMediaQuery } from '../../../lib/hooks';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/icons';
import { errorMessage } from '../parts';
import { designedMailHtml } from '../mail/mailLogos';
import { CopyMailButton, CopyMailFailure, useCopyMail, type CopyMailState } from './CopyMailButton';
import type { CvLinkState } from './CvAttachment';
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

/** While held it stays in its place, but goes nowhere and says so. */
function MailLink({
  href,
  isHeld,
  isNewTab,
  onOpen,
  className,
  children,
}: {
  href: string;
  isHeld: boolean;
  isNewTab?: boolean;
  onOpen: () => void;
  className: string;
  children: ReactNode;
}) {
  if (isHeld) {
    return (
      <a role="link" aria-disabled="true" className={`pointer-events-none opacity-50 ${className}`}>
        {children}
      </a>
    );
  }
  return (
    <a
      href={href}
      onClick={onOpen}
      className={className}
      {...(isNewTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  );
}

/** Gmail and the mail app: plain text only, from the same content as the designed mail. */
function PlainMailLinks({
  gmail,
  mailto,
  isHeld,
  onOpen,
}: {
  gmail: string;
  /** null: too long for a mail app to take. */
  mailto: string | null;
  isHeld: boolean;
  onOpen: (channel: ContactChannel) => void;
}) {
  // Gmail's web compose link does not survive on phones (inbox or app store), so phones get the mail app first.
  const isPhone = useMediaQuery('(max-width: 639px)');
  return (
    <>
      <MailLink
        href={gmail}
        isHeld={isHeld}
        isNewTab
        onOpen={() => onOpen('gmail')}
        className={`${isPhone ? 'order-3' : 'order-2'} ${secondaryLink} ${actionLink}`}
      >
        <Icon name="mail" size={16} />
        Mở Gmail{isPhone ? ' (web)' : ''}
      </MailLink>
      {mailto && (
        <MailLink
          href={mailto}
          isHeld={isHeld}
          onOpen={() => onOpen('mailto')}
          className={`${isPhone ? 'order-2' : 'order-3'} ${secondaryLink} ${actionLink}`}
        >
          <Icon name="external" size={16} />
          Mở ứng dụng mail
        </MailLink>
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

function CopyPlainButton({
  text,
  disabled,
  onCopied,
  className,
}: {
  text: string;
  disabled: boolean;
  onCopied: () => void;
  className: string;
}) {
  const [copied, flash] = useFlash();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() =>
        copyText(text).then((ok) => {
          if (!ok) return;
          flash();
          onCopied();
        })
      }
      className={`order-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-field bg-white px-4 text-sm text-body hover:bg-mist disabled:pointer-events-none disabled:opacity-50 ${className}`}
    >
      <Icon name={copied ? 'check' : 'copy'} size={16} />
      {copied ? 'Đã sao chép' : 'Sao chép'}
    </button>
  );
}

/** How the CV link of this letter stands, for the buttons that send it. */
export interface SendCvLink {
  state: CvLinkState;
  isRetrying: boolean;
  onRetry: () => void;
}

/** At the buttons, because that is where a letter without its CV would leave. */
function CvLinkNotice({
  link,
  isSendingAnyway,
  onSendAnyway,
}: {
  link: SendCvLink;
  isSendingAnyway: boolean;
  onSendAnyway: () => void;
}) {
  if (link.state === 'loading') return <p className="m-0 text-sm text-slate">Chờ gắn link CV vào thư…</p>;
  if (link.state !== 'failed') return null;
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-2 rounded-control bg-error-soft px-4 py-2.5 text-sm text-error"
    >
      <span className="min-w-0 flex-1 basis-60">Không lấy được link CV, nên thư không có CV.</span>
      <Button size="sm" variant="outline" disabled={link.isRetrying} onClick={link.onRetry}>
        Thử lại
      </Button>
      {!isSendingAnyway && (
        <Button size="sm" variant="outline" onClick={onSendAnyway}>
          Vẫn gửi không có CV
        </Button>
      )}
    </div>
  );
}

function SendButtons({
  app,
  me,
  draft,
  rich,
  isHeld,
  onSent,
}: {
  app: ApplicationDetailDto;
  me: HrMe | null | undefined;
  draft: MailDraft;
  rich: CopyMailState;
  isHeld: boolean;
  onSent: (channel: ContactChannel) => void;
}) {
  const { content, details } = draft;
  const text = renderMailText(content, details);
  const mailto = app.email ? mailtoUrl(app.email, content.subject, text) : '';
  const isLong = mailto.length > MAILTO_SAFE_LENGTH;
  return (
    <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
      <div className="flex shrink-0 flex-wrap gap-2 max-sm:grid max-sm:grid-cols-2">
        <CopyMailButton state={rich} disabled={isHeld} className="order-1 max-sm:col-span-2" />
        {app.email && (
          <PlainMailLinks
            gmail={gmailComposeUrl(app.email, content.subject, text, me?.contactEmail)}
            mailto={isLong ? null : mailto}
            isHeld={isHeld}
            onOpen={onSent}
          />
        )}
        <CopyPlainButton
          text={text}
          disabled={isHeld}
          onCopied={() => onSent('copy')}
          className={app.email && isLong ? '' : 'max-sm:col-span-2'}
        />
      </div>
      <SendHints email={app.email} isLong={isLong} from={me?.contactEmail} />
    </div>
  );
}

export function SendActions({
  app,
  me,
  draft,
  cvLink,
  onError,
}: {
  app: ApplicationDetailDto;
  me: HrMe | null | undefined;
  draft: MailDraft;
  cvLink: SendCvLink;
  onError: (message: string) => void;
}) {
  const { content, details } = draft;
  const [isSendingAnyway, setIsSendingAnyway] = useState(false);
  const isHeld = cvLink.state === 'loading' || (cvLink.state === 'failed' && !isSendingAnyway);
  const record = useRecordContact(app, content.key, onError);
  const stamp = JSON.stringify([content, details]);
  const rich = useCopyMail(
    designedMailHtml(content, details),
    renderMailText(content, details),
    outlookComposeUrl(app.email, content.subject),
    stamp,
    () => record('copy_html', stamp),
  );
  return (
    <footer className="flex max-h-[55dvh] flex-col gap-2.5 overflow-y-auto border-t border-line bg-white px-5 py-3 max-sm:px-4">
      <CopyMailFailure result={rich.result} />
      <CvLinkNotice link={cvLink} isSendingAnyway={isSendingAnyway} onSendAnyway={() => setIsSendingAnyway(true)} />
      {/* Always in view, whichever side HR has scrolled; on phones within reach of one thumb. */}
      <SendButtons
        app={app}
        me={me}
        draft={draft}
        rich={rich}
        isHeld={isHeld}
        onSent={(channel) => record(channel, stamp)}
      />
    </footer>
  );
}
