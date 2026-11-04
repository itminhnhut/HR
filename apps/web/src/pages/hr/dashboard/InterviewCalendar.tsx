import type { EventInput } from '@fullcalendar/react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import viLocale from '@fullcalendar/react/locales/vi';
import '@fullcalendar/react/skeleton.css';
import formaTheme from '@fullcalendar/react/themes/forma';
import '@fullcalendar/react/themes/forma/palettes/blue.css';
import '@fullcalendar/react/themes/forma/theme.css';
import { formatDate, type DashboardDto } from '@careers/shared';
import { useId, useState, type ReactNode, type SyntheticEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { Icon } from '../../../ui/icons';

const VN = 'Asia/Ho_Chi_Minh';
/** Under this width seven columns have no room for names: a list instead. */
const LIST_BELOW = 640;
const PLUGINS = [dayGridPlugin, formaTheme];
/** How many the phone list shows: the rest are one click away. */
const PHONE_SHOWN = 6;
const TOOLBAR = { start: 'title', end: 'today prev,next' };
const TIME_FORMAT = { hour: '2-digit', minute: '2-digit', hour12: false } as const;

/** Those with a time, as the calendar's events: orange still to come, grey already over. */
export function calendarEvents(interviews: DashboardDto['interviews'], now: Date): EventInput[] {
  return interviews.flatMap((i) => {
    if (!i.interviewAt) return [];
    const isOver = new Date(i.interviewAt) < now;
    return [
      {
        id: i.id,
        title: i.fullName,
        start: i.interviewAt,
        color: isOver ? '#64748b' : '#c2410c',
        extendedProps: { jobTitle: i.jobTitle },
      },
    ];
  });
}

type Interview = DashboardDto['interviews'][number];
type Dated = Interview & { interviewAt: string };

const inVietnam = (iso: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('vi-VN', { timeZone: VN, ...options }).format(new Date(iso));

function PhoneRow({ item, now }: { item: Dated; now: Date }) {
  const isOver = new Date(item.interviewAt) < now;
  return (
    <li>
      <Link
        to={`/hr/ho-so?id=${item.id}`}
        className="flex items-center gap-3 rounded-control py-1.5 text-navy no-underline hover:bg-hover"
      >
        <span
          className={`flex size-12 shrink-0 flex-col items-center justify-center rounded-[10px] leading-none ${isOver ? 'bg-slate-200 text-slate-700' : 'bg-orange-100 text-orange-800'}`}
        >
          <span className="text-base font-bold">{inVietnam(item.interviewAt, { day: '2-digit' })}</span>
          <span className="mt-0.5 text-[10px] font-semibold">T{inVietnam(item.interviewAt, { month: 'numeric' })}</span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold">{item.fullName}</span>
          <span className="truncate text-xs text-slate">{item.jobTitle}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="text-sm font-bold tabular-nums">
            {inVietnam(item.interviewAt, { hour: '2-digit', minute: '2-digit', hour12: false })}
          </span>
          <span className="text-xs text-muted">
            {isOver ? 'Đã qua' : inVietnam(item.interviewAt, { weekday: 'short' })}
          </span>
        </span>
      </Link>
    </li>
  );
}

/** Soonest first, as the server lists them. */
function PhoneList({ interviews, now }: { interviews: DashboardDto['interviews']; now: Date }) {
  const dated = interviews.filter((i): i is Dated => i.interviewAt !== null);
  const hidden = dated.length - PHONE_SHOWN;
  return (
    <>
      <ul className="m-0 flex list-none flex-col p-0">
        {dated.slice(0, PHONE_SHOWN).map((item) => (
          <PhoneRow key={item.id} item={item} now={now} />
        ))}
      </ul>
      {hidden > 0 && <span className="text-xs text-muted">và {hidden} lịch hẹn khác</span>}
    </>
  );
}

const CARD_WIDTH = 280;

function CardLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="m-0 text-navy">{children}</dd>
    </div>
  );
}

/** A name, and on hover or focus what HR needs to set the time; opens the side the window has room on. */
function NoTimePerson({ person }: { person: Interview }) {
  const id = useId();
  const [opensLeft, setOpensLeft] = useState(false);
  const place = (e: SyntheticEvent<HTMLElement>) => {
    setOpensLeft(e.currentTarget.getBoundingClientRect().left + CARD_WIDTH > window.innerWidth - 16);
  };
  return (
    <li className="group relative min-w-0" onPointerEnter={place} onFocus={place}>
      <Link
        to={`/hr/ho-so?id=${person.id}`}
        aria-describedby={id}
        className="block max-w-[260px] truncate rounded-full border border-amber-300 bg-white px-3 py-1 text-[13px] font-medium text-amber-900 no-underline hover:border-amber-500 hover:bg-amber-100 hover:text-amber-950"
      >
        {person.fullName}
      </Link>
      <div
        id={id}
        role="tooltip"
        style={{ width: CARD_WIDTH }}
        className={`pointer-events-none absolute top-full z-30 mt-1.5 hidden rounded-control border border-line bg-white p-3 text-xs shadow-lg group-focus-within:block group-hover:block ${opensLeft ? 'right-0' : 'left-0'}`}
      >
        <div className="mb-2 text-sm font-semibold text-navy">{person.fullName}</div>
        <dl className="m-0 flex flex-col gap-1">
          <CardLine label="Vị trí">{person.jobTitle}</CardLine>
          <CardLine label="Giờ phỏng vấn">
            <span className="font-semibold text-amber-800">Chưa chọn</span>
          </CardLine>
          <CardLine label="Ngày nộp">{formatDate(person.appliedAt)}</CardLine>
          {person.noteLine && <CardLine label="Ghi chú">{person.noteLine}</CardLine>}
        </dl>
      </div>
    </li>
  );
}

/** Everyone without a time cannot stand on a calendar: each by name, a press away from setting it. */
function NoTimeList({ interviews }: { interviews: DashboardDto['interviews'] }) {
  const people = interviews.filter((i) => !i.interviewAt);
  if (people.length === 0) return null;
  return (
    <section
      aria-label="Chưa chọn giờ phỏng vấn"
      className="flex flex-col gap-2 rounded-control border border-amber-200 bg-amber-50 p-3"
    >
      <h3 className="m-0 flex items-center gap-2 text-sm font-semibold text-amber-900">
        <Icon name="clock" size={16} />
        Chưa chọn giờ phỏng vấn ({people.length})
      </h3>
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {people.map((person) => (
          <NoTimePerson key={person.id} person={person} />
        ))}
      </ul>
    </section>
  );
}

/** Who is on the calendar and who is not, so an empty month never reads as "nobody". */
function Summary({ data, now }: { data: DashboardDto; now: Date }) {
  const { total, noTime } = data.interviewCounts;
  const thisMonth = inVietnam(now.toISOString(), { year: 'numeric', month: '2-digit' });
  const isEarlier = (iso: string) =>
    new Date(iso) < now && inVietnam(iso, { year: 'numeric', month: '2-digit' }) !== thisMonth;
  const earlier = data.interviews.filter((i) => i.interviewAt && isEarlier(i.interviewAt)).length;
  return (
    <p className="m-0 text-sm text-slate">
      <b className="font-semibold text-navy">{total}</b> người đang hẹn phỏng vấn: {total - noTime} có giờ, {noTime}{' '}
      chưa chọn giờ.
      {earlier > 0 && ` ${earlier} lịch đã qua ở các tháng trước.`}
    </p>
  );
}

/** This month's interviews, everyone at "Hẹn phỏng vấn" accounted for; a person opens their profile. */
export function InterviewCalendar({ data, now }: { data: DashboardDto; now: Date }) {
  const navigate = useNavigate();
  if (data.interviewCounts.total === 0) return <p className="m-0 text-sm text-slate">Chưa có ai đang hẹn phỏng vấn.</p>;
  const events = calendarEvents(data.interviews, now);
  const isPhone = window.innerWidth < LIST_BELOW;
  return (
    <div className="flex flex-col gap-3">
      <Summary data={data} now={now} />
      {isPhone ? (
        <PhoneList interviews={data.interviews} now={now} />
      ) : (
        <FullCalendar
          plugins={PLUGINS}
          locale={viLocale}
          timeZone={VN}
          initialView="dayGridMonth"
          now={now}
          headerToolbar={TOOLBAR}
          aspectRatio={2.3}
          dayMaxEvents={3}
          eventDisplay="block"
          titleFormat={({ date }) => `Tháng ${date.month + 1}, ${date.year}`}
          fixedWeekCount={false}
          eventTimeFormat={TIME_FORMAT}
          events={events}
          eventClick={({ event, jsEvent }) => {
            jsEvent.preventDefault();
            navigate(`/hr/ho-so?id=${event.id}`);
          }}
        />
      )}
      <NoTimeList interviews={data.interviews} />
    </div>
  );
}
