import { formatDate, formatPhone, type DashboardDto } from '@careers/shared';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { PersonalMarks } from '../applicants/PersonalMarks';

export type Interview = DashboardDto['interviews'][number];
export type Dated = Interview & { interviewAt: string };

export const CARD_WIDTH = 280;
export const CARD_CLASS = 'pointer-events-none z-30 rounded-control border border-line bg-white p-3 text-xs shadow-lg';

/** With the two clamped lines at their longest the card stays this tall, so it can be placed without measuring. */
const CARD_ROOM = 290;
const CARD_GAP = 6;
const WINDOW_EDGE = 16;
export const VN = 'Asia/Ho_Chi_Minh';

export const inVietnam = (iso: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('vi-VN', { timeZone: VN, ...options }).format(new Date(iso));

function CardLine({ label, isClamped = false, children }: { label: string; isClamped?: boolean; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className={`m-0 text-navy ${isClamped ? 'line-clamp-3' : ''}`}>{children}</dd>
    </div>
  );
}

/** What HR wants to know about a person without opening the profile: the same on the calendar and in "Chưa chọn giờ". */
export function CardBody({ person, time }: { person: Interview; time: ReactNode }) {
  return (
    <>
      <div className="mb-2 truncate text-sm font-semibold text-navy">{person.fullName}</div>
      <dl className="m-0 flex flex-col gap-1">
        <CardLine label="Vị trí" isClamped>
          {person.jobTitle}
        </CardLine>
        <CardLine label="Giờ phỏng vấn">{time}</CardLine>
        <CardLine label="Theo CV">
          {person.cvGender || person.cvBirth ? (
            <PersonalMarks gender={person.cvGender} birth={person.cvBirth} />
          ) : (
            <span className="text-muted">Không ghi giới tính, tuổi</span>
          )}
        </CardLine>
        {person.matchPercent != null && <CardLine label="Phù hợp">{person.matchPercent}%</CardLine>}
        <CardLine label="Điện thoại">{formatPhone(person.phone)}</CardLine>
        <CardLine label="Ngày nộp">{formatDate(person.appliedAt)}</CardLine>
        {person.noteLine && (
          <CardLine label="Ghi chú" isClamped>
            {person.noteLine}
          </CardLine>
        )}
      </dl>
    </>
  );
}

/** "Thứ Năm, 05/11/2026, 09:00" */
export function interviewTimeText(iso: string): string {
  const day = inVietnam(iso, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = inVietnam(iso, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}, ${time}`;
}

/** Everything the card says, for a screen reader on the person's entry in the calendar. */
export function describeInterview(person: Dated): string {
  const parts = [person.fullName, person.jobTitle, interviewTimeText(person.interviewAt), person.noteLine];
  return parts.filter(Boolean).join(', ');
}

/** Beside the person and inside the window. Fixed, so that a calendar cell can never clip it. */
function cardStyle(box: DOMRect): CSSProperties {
  const left = Math.max(WINDOW_EDGE, Math.min(box.left, window.innerWidth - CARD_WIDTH - WINDOW_EDGE));
  const opensAbove = box.bottom + CARD_ROOM > window.innerHeight;
  const place = opensAbove ? { bottom: window.innerHeight - box.top + CARD_GAP } : { top: box.bottom + CARD_GAP };
  return { width: CARD_WIDTH, left, ...place };
}

interface Shown {
  id: string;
  el: HTMLElement;
  style: CSSProperties;
}

/** Which person is under the mouse or the focus. The card follows them on scroll; Esc closes it. */
function useShownPerson() {
  const [shown, setShown] = useState<Shown | null>(null);
  const el = shown?.el;

  useEffect(() => {
    if (!el) return;
    const follow = () =>
      setShown((now) => (now && el.isConnected ? { ...now, style: cardStyle(el.getBoundingClientRect()) } : null));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShown(null);
    };
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
      window.removeEventListener('keydown', onKey);
    };
  }, [el]);

  const showFor = (target: EventTarget) => {
    const hit = target instanceof Element ? target.closest<HTMLElement>('[data-interview]') : null;
    const id = hit?.dataset.interview;
    setShown(hit && id ? { id, el: hit, style: cardStyle(hit.getBoundingClientRect()) } : null);
  };
  return { shown, showFor, hide: () => setShown(null) };
}

function InterviewTime({ iso, now }: { iso: string; now: Date }) {
  return (
    <span className="font-semibold">
      {interviewTimeText(iso)}
      {new Date(iso) < now && <span className="font-normal text-muted"> (đã qua)</span>}
    </span>
  );
}

/**
 * Shows the card for the `data-interview` entry under the mouse or the focus. The calendar comes in as `children`, so a
 * change of card does not draw the calendar again. The person is read from the live list, so one who has left it
 * takes their card along; a click closes it too, since it may have moved the calendar away from under the mouse.
 */
export function HoverCardArea({
  interviews,
  now,
  children,
}: {
  interviews: readonly Interview[];
  now: Date;
  children: ReactNode;
}) {
  const { shown, showFor, hide } = useShownPerson();
  const person = interviews.find((i): i is Dated => i.id === shown?.id && i.interviewAt !== null);
  return (
    <div
      onMouseOver={(e) => showFor(e.target)}
      onMouseOut={hide}
      onFocus={(e) => showFor(e.target)}
      onBlur={hide}
      onClick={hide}
    >
      {children}
      {person && shown && (
        <div role="tooltip" style={shown.style} className={`${CARD_CLASS} fixed`}>
          <CardBody person={person} time={<InterviewTime iso={person.interviewAt} now={now} />} />
        </div>
      )}
    </div>
  );
}
