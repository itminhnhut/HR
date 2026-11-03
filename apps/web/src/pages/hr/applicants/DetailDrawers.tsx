import { APPLICATION_STATUS_LABEL, formatTimestamp, type ApplicationDetailDto } from '@careers/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { Icon, type IconName } from '../../../ui/icons';
import { ContactHistory } from './ComposeMessage';
import { DetailDrawer } from './DetailDrawer';

const shortDate = (iso: string) => formatTimestamp(iso).slice(0, 5);

/** One line in the detail that says the essential, and opens the whole of it in a drawer. */
function DrawerRow({
  icon,
  label,
  tone = 'border-line bg-white hover:bg-mist',
  onClick,
}: {
  icon: IconName;
  label: string;
  tone?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 w-full items-center gap-2.5 rounded-control border px-3.5 py-2 text-left text-sm font-medium text-navy transition-colors ${tone}`}
    >
      <Icon name={icon} size={16} className="shrink-0 text-accent" />
      <span className="min-w-0 flex-1">{label}</span>
      <Icon name="chevronRight" size={16} className="shrink-0 text-slate" />
    </button>
  );
}

/** What HR prepared for this person: a count and the latest here, every line in the drawer. */
export function ContactHistoryRow({ app }: { app: ApplicationDetailDto }) {
  const [isOpen, setIsOpen] = useState(false);
  const latest = app.contacts[0];
  if (!latest) return null;
  return (
    <>
      <DrawerRow
        icon="mail"
        label={`Đã soạn thư ${app.contacts.length} lần, gần nhất ${shortDate(latest.createdAt)}`}
        onClick={() => setIsOpen(true)}
      />
      <DetailDrawer
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title="Lịch sử liên hệ"
        subtitle={`${app.fullName} · ${app.jobTitle}`}
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-5 max-sm:p-4">
          <ContactHistory app={app} limit={app.contacts.length} />
        </div>
      </DetailDrawer>
    </>
  );
}

/** The same person's other applications: worth noticing, so the row stays in the detail; the list is in the drawer. */
export function OtherApplicationsRow({ app }: { app: ApplicationDetailDto }) {
  const [isOpen, setIsOpen] = useState(false);
  if (app.otherApplications.length === 0) return null;
  return (
    <>
      <DrawerRow
        icon="layers"
        label={`Người này đã nộp thêm ${app.otherApplications.length} vị trí khác`}
        tone="border-ring bg-tint hover:bg-remind"
        onClick={() => setIsOpen(true)}
      />
      <DetailDrawer
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title="Vị trí khác đã nộp"
        subtitle={`${app.fullName} · ${app.jobTitle}`}
      >
        <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0 text-sm">
          {app.otherApplications.map((o) => (
            <li
              key={o.id}
              className="flex min-h-11 flex-wrap items-center gap-x-2 border-b border-line-soft px-5 py-2 max-sm:px-4"
            >
              <Link to={`/hr/ho-so?id=${o.id}`} className="inline-flex min-h-11 items-center font-medium">
                {o.jobTitle}
              </Link>
              <span className="text-muted">
                {APPLICATION_STATUS_LABEL[o.status]} · {shortDate(o.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </DetailDrawer>
    </>
  );
}
