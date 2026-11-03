import type { TemplateKey } from '@careers/shared';
import { useEffect, useState } from 'react';
import { hasInfoBox } from './mailSections';

const SETTLE_MS = 250;

/** Replacing an iframe's document reloads it, so the preview waits for a pause in the typing. */
function useSettled(value: string): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [value]);
  return settled;
}

/**
 * The real mail, as the candidate gets it. An empty `sandbox` means no scripts and no access to this page, so
 * a name or a template text can never run anything here, whatever it contains. The frame cannot measure its
 * mail from outside, so it is sized for the longest mail on a phone and the box around it scrolls: a reload
 * would send the frame's own scroll back to the top on every edit.
 */
export function MailPreview({
  html,
  templateKey,
  title,
  className = 'h-[520px] rounded-control border border-line',
  isWideOnDesktop = false,
}: {
  html: string;
  templateKey: TemplateKey;
  title: string;
  /** The box around the frame: its height and edge. */
  className?: string;
  /** On a desktop the frame is wide enough for the mail's desktop layout, which is shorter. */
  isWideOnDesktop?: boolean;
}) {
  // The interview and call mails carry a box of details and an answer button.
  const isLong = hasInfoBox(templateKey) || templateKey === 'call';
  return (
    <div className={`overflow-y-auto bg-[#fbeaec] ${className}`}>
      <iframe
        title={title}
        sandbox=""
        srcDoc={useSettled(html)}
        className={`block w-full border-0 ${isLong ? 'h-[1950px]' : 'h-[1450px]'} ${isWideOnDesktop ? (isLong ? 'lg:h-[1420px]' : 'lg:h-[1040px]') : ''}`}
      />
    </div>
  );
}
