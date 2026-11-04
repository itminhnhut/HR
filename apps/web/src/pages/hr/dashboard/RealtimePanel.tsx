import { formatTimestamp, type RealtimeDto, type RealtimeRow } from '@careers/shared';
import { useRealtime } from '../../../api/queries';
import { Icon, type IconName } from '../../../ui/icons';
import { IconTile } from '../design/IconTile';
import { SectionTitle } from '../design/SectionTitle';
import { TONE, type Tone } from '../design/tone';

const PANEL = 'flex min-w-0 flex-col gap-4 rounded-card border border-line bg-white p-5 sm:p-6';

function MinuteBars({ perMinute }: { perMinute: readonly number[] }) {
  const max = Math.max(1, ...perMinute);
  const last = perMinute.length - 1;
  const summary = perMinute.reduce((peak, users) => Math.max(peak, users), 0);
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div
        role="img"
        aria-label={`Người truy cập theo từng phút trong 30 phút gần nhất, cao nhất ${summary} người một phút.`}
        className="flex h-16 items-end gap-[3px]"
      >
        {perMinute.map((users, i) => (
          <span
            key={i}
            title={`${i === last ? 'Phút này' : `${last - i} phút trước`}: ${users} người`}
            style={{ height: `${users > 0 ? Math.max(10, (users / max) * 100) : 4}%` }}
            className={`min-w-0 flex-1 rounded-t-[3px] ${users === 0 ? 'bg-line' : i === last ? 'bg-primary-deep' : 'bg-blue-400'}`}
          />
        ))}
      </div>
      <div aria-hidden="true" className="flex justify-between text-xs text-muted">
        <span>30 phút trước</span>
        <span>Bây giờ</span>
      </div>
    </div>
  );
}

/** The names and how many people, with a bar so the biggest stands out. */
function TopList({
  title,
  icon,
  tone,
  rows,
}: {
  title: string;
  icon: IconName;
  tone: Tone;
  rows: readonly RealtimeRow[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.users));
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-2">
      <h3 className="m-0 flex items-center gap-2 text-sm font-semibold text-navy">
        <Icon name={icon} size={15} className={TONE[tone].text} />
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="m-0 text-sm text-muted">Chưa có dữ liệu.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {rows.map((row) => (
            <li key={row.name} className="flex flex-col gap-1">
              <span className="flex items-baseline justify-between gap-3 text-[13px] text-body">
                <span className="truncate" title={row.name}>
                  {row.name}
                </span>
                <span className="font-semibold tabular-nums text-navy">{row.users}</span>
              </span>
              <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-tint">
                <span
                  className={`block h-full rounded-full ${TONE[tone].bar}`}
                  style={{ width: `${(row.users / max) * 100}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LiveMark() {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold text-green-700">
      <span aria-hidden="true" className="live-dot size-2 rounded-full bg-green-600" />
      Trực tiếp
    </span>
  );
}

function Note({ icon, tone, title, children }: { icon: IconName; tone: Tone; title: string; children: string }) {
  return (
    <section className={`${PANEL} sm:flex-row sm:items-center`}>
      <IconTile icon={icon} tone={tone} size={40} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <strong className="text-sm font-semibold text-navy">{title}</strong>
        <span className="text-[13px] text-slate">{children}</span>
      </span>
    </section>
  );
}

/** What the server answered, as the panel shows it. */
export function RealtimeView({ data }: { data: RealtimeDto }) {
  if (data.status === 'off') {
    return (
      <Note icon="bars" tone="slate" title="Đang truy cập: chưa kết nối Google Analytics">
        Số người đang xem web sẽ hiện ở đây sau khi thêm khoá kết nối trên Vercel.
      </Note>
    );
  }
  if (data.status === 'error') {
    return (
      <Note icon="alert" tone="amber" title="Đang truy cập: chưa lấy được số liệu">
        Google Analytics chưa trả lời, trang sẽ tự thử lại sau ít phút.
      </Note>
    );
  }
  return (
    <section aria-label="Đang truy cập" className={PANEL}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0">
          <SectionTitle icon="bars" tone="green">
            Đang truy cập
          </SectionTitle>
        </h2>
        <LiveMark />
      </div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex flex-col">
          <span className="font-serif text-[40px] leading-none text-green-700">{data.activeUsers}</span>
          <span className="mt-1 text-[13px] text-slate">người, 30 phút gần nhất</span>
        </div>
        <MinuteBars perMinute={data.perMinute} />
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <TopList title="Trang đang xem" icon="file" tone="blue" rows={data.pages} />
        <TopList title="Thành phố" icon="pin" tone="orange" rows={data.cities} />
        <TopList title="Thiết bị" icon="laptop" tone="teal" rows={data.devices} />
      </div>
      <p className="m-0 text-xs text-muted">
        Từ Google Analytics, cập nhật mỗi phút, lần cuối {formatTimestamp(data.fetchedAt)}. Không tính trang admin; số
        có thể lệch nhẹ so với trang Analytics.
      </p>
    </section>
  );
}

export function RealtimePanel() {
  const realtime = useRealtime();
  if (realtime.isPending) return null;
  return <RealtimeView data={realtime.data ?? { status: 'error' }} />;
}
