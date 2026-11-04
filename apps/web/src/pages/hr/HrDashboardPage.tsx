import { formatDate, STATUS_LABEL, type DashboardDto, type ReportPeriod } from '@careers/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { useDashboard } from '../../api/queries';
import { usePageMeta } from '../../lib/hooks';
import { ButtonLink } from '../../ui/Button';
import { ErrorState, LoadingStatus, Sk, useDelayedFlag } from '../../ui/feedback';
import { Icon, type IconName } from '../../ui/icons';
import { AWAITING_LOOK, STATUS_STYLE, type StatusLook } from './applicants/statusStyle';
import { InterviewCalendar } from './dashboard/InterviewCalendar';
import { RealtimePanel } from './dashboard/RealtimePanel';
import { Panel } from './dashboard/Panel';
import { PerDayChart } from './dashboard/PerDayChart';
import { defaultReportPeriod, PeriodPicker, periodLabel } from './dashboard/PeriodPicker';
import { SourceFunnel } from './dashboard/SourceFunnel';
import { SourceTrendChart } from './dashboard/SourceTrendChart';
import { IconTile } from './design/IconTile';
import { TONE, type Tone } from './design/tone';
import { apiMessage, PageHeading } from './parts';

function StatCard({
  icon,
  tone,
  label,
  value,
  hint,
  to,
}: {
  icon: IconName;
  tone: Tone;
  label: string;
  value: number;
  hint?: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="card-hover flex items-center gap-4 rounded-card border border-line bg-white p-5 text-navy no-underline"
    >
      <IconTile icon={icon} tone={tone} size={52} />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-medium text-slate">{label}</span>
        <span className={`font-serif text-[32px] leading-none ${TONE[tone].text}`}>{value}</span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </span>
    </Link>
  );
}

function Interviews({ data }: { data: DashboardDto }) {
  return (
    <Panel
      title="Lịch hẹn phỏng vấn"
      icon="calendar"
      tone="orange"
      action={
        <Link
          to="/hr/ho-so?trang-thai=interview"
          className="icon-nudge inline-flex items-center gap-1 text-sm font-medium no-underline hover:underline max-sm:min-h-11"
        >
          Xem tất cả
          <Icon name="arrowRight" size={15} />
        </Link>
      }
    >
      <InterviewCalendar data={data} now={new Date()} />
    </Panel>
  );
}

function EndingJobs({ data }: { data: DashboardDto }) {
  return (
    <Panel title="Tin sắp hết hạn hoặc vừa hết hạn" icon="clock" tone="rose">
      {data.endingJobs.length === 0 ? (
        <p className="m-0 text-sm text-slate">Không có tin nào cần để ý.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {data.endingJobs.map((j) => (
            <li
              key={j.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft py-3 last:border-b-0"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-semibold text-navy">{j.title}</span>
                <span className="text-[13px] text-slate">
                  {STATUS_LABEL[j.status]} · hạn {formatDate(j.deadline)}
                </span>
              </span>
              <Link to="/hr/tin" className="text-sm no-underline hover:underline">
                Sửa hạn nộp
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Where the period's applications came from (spec-cv-intake.md): a line per source, each opens the list. */
function SourceTrend({ data }: { data: DashboardDto }) {
  return (
    <Panel title="Hồ sơ theo nguồn" icon="globe" tone="teal">
      <SourceTrendChart data={data} />
    </Panel>
  );
}

function FunnelPanel({ data }: { data: DashboardDto }) {
  return (
    <Panel title="Hiệu quả theo nguồn" icon="trend" tone="green">
      <SourceFunnel rows={data.sourceFunnel} />
    </Panel>
  );
}

/** One choice of days for every report under it. */
function Reports({
  data,
  period,
  onPeriod,
}: {
  data: DashboardDto;
  period: ReportPeriod;
  onPeriod: (p: ReportPeriod) => void;
}) {
  return (
    <section aria-label="Báo cáo" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h2 className="m-0 text-lg font-semibold text-navy">Báo cáo hồ sơ</h2>
          <span className="text-[13px] text-slate">{periodLabel(period)}</span>
        </div>
        <PeriodPicker value={period} onChange={onPeriod} />
      </div>
      <PerDayChart data={data} />
      <SourceTrend data={data} />
      <FunnelPanel data={data} />
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Sk key={i} w="100%" h={110} />
        ))}
      </div>
      <Sk w="100%" h={280} />
    </div>
  );
}

/** Where every application stands now, each opening its list, and how many came in lately. */
function StatusCards({ data }: { data: DashboardDto }) {
  const { statusCounts: counts, awaitingResults, waitingOver3Days, last7Days } = data;
  const card = (look: StatusLook, value: number, tab: string, hint?: string) => (
    <StatCard
      key={tab}
      icon={look.icon}
      tone={look.tone}
      label={look.label}
      value={value}
      hint={hint}
      to={`/hr/ho-so?trang-thai=${tab}`}
    />
  );
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:gap-4">
      {card(
        STATUS_STYLE.new,
        counts.new,
        'new',
        waitingOver3Days > 0 ? `${waitingOver3Days} hồ sơ chờ hơn 3 ngày` : undefined,
      )}
      {card(STATUS_STYLE.seen, counts.seen, 'seen')}
      {card(STATUS_STYLE.interview, counts.interview, 'interview')}
      {card(AWAITING_LOOK, awaitingResults, 'awaiting')}
      {card(STATUS_STYLE.passed, counts.passed, 'passed')}
      {card(STATUS_STYLE.hired, counts.hired, 'hired')}
      {card(STATUS_STYLE.rejected, counts.rejected, 'rejected')}
      <StatCard icon="trend" tone="green" label="Hồ sơ 7 ngày qua" value={last7Days} to="/hr/ho-so?trang-thai=all" />
    </div>
  );
}

export function HrDashboardPage() {
  usePageMeta('Tổng quan');
  const [period, setPeriod] = useState(defaultReportPeriod);
  const dashboard = useDashboard(period);
  const showSkeleton = useDelayedFlag(dashboard.isPending);
  const data = dashboard.data;

  return (
    <>
      <PageHeading
        title="Tổng quan"
        titleHiddenOnPhone
        subtitle="Việc cần làm hôm nay và số hồ sơ nhận được."
        action={
          <ButtonLink to="/hr/tin/moi" icon="plus" className="text-sm font-medium hover:text-white max-sm:w-full">
            Đăng tin mới
          </ButtonLink>
        }
      />
      {dashboard.isPending && (
        <>
          <LoadingStatus />
          {showSkeleton && <DashboardSkeleton />}
        </>
      )}
      {dashboard.isError && <ErrorState onRetry={() => dashboard.refetch()} message={apiMessage(dashboard.error)} />}
      {data && (
        <div className="flex flex-col gap-5">
          <StatusCards data={data} />
          <RealtimePanel />
          <Interviews data={data} />
          <EndingJobs data={data} />
          <Reports data={data} period={period} onPeriod={setPeriod} />
        </div>
      )}
    </>
  );
}

export default HrDashboardPage;
