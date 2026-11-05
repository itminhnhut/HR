import { useState } from 'react';
import { Button } from '../../../ui/Button';
import { copyRichMail, type CopyMailResult } from '../mail/copyRichMail';

const FAILURE: Record<Exclude<CopyMailResult, 'copied'>, string> = {
  unsupported:
    'Trình duyệt này chưa chép được thư đẹp. Hãy mở bằng Chrome hoặc Edge bản mới, hoặc bấm "Sao chép" để lấy bản chữ thường.',
  failed:
    'Chưa chép được thư: trình duyệt đang chặn quyền sao chép. Hãy thử lại, hoặc bấm "Sao chép" để lấy bản chữ thường.',
};

export interface CopyMailState {
  /** The answer to the last click, only while the mail is still what was copied. */
  result: CopyMailResult | null;
  copy: () => Promise<void>;
}

/**
 * `stamp` identifies the mail: after any edit, what is on the clipboard is old and the message goes away. Outlook
 * opens only after the copy: opening it first takes the focus away, and the browser then refuses the clipboard.
 */
export function useCopyMail(
  html: string,
  text: string,
  outlookUrl: string,
  stamp: string,
  onCopied: () => void,
): CopyMailState {
  const [last, setLast] = useState<{ stamp: string; result: CopyMailResult } | null>(null);
  return {
    result: last?.stamp === stamp ? last.result : null,
    copy: async () => {
      const result = await copyRichMail(html, text);
      setLast({ stamp, result });
      if (result !== 'copied') return;
      onCopied();
      window.open(outlookUrl, '_blank', 'noopener,noreferrer');
    },
  };
}

export function CopyMailButton({
  state,
  disabled,
  className = '',
}: {
  state: CopyMailState;
  disabled: boolean;
  className?: string;
}) {
  return (
    <Button
      icon={state.result === 'copied' ? 'check' : 'copy'}
      disabled={disabled}
      onClick={() => void state.copy()}
      className={className}
    >
      Sao chép &amp; mở Outlook
    </Button>
  );
}

/** A copy that worked needs no message: Outlook has opened, the button shows a tick. Only a failure explains itself. */
export function CopyMailFailure({ result }: { result: CopyMailResult | null }) {
  if (!result || result === 'copied') return null;
  return (
    <div role="alert" className="rounded-control bg-error-soft px-4 py-3 text-sm text-error">
      {FAILURE[result]}
    </div>
  );
}
