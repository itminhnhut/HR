import { formatDate, STATUS_LABEL, type DashboardDto } from '@careers/shared';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useDashboard } from '../../api/queries';
import { usePageMeta } from '../../lib/hooks';
import { ButtonLink } from '../../ui/Button';
import { SelectField } from '../../ui/Field';
import { ErrorState, LoadingStatus, Sk, useDelayedFlag } from '../../ui/feedback';
import { Icon, type IconName } from '../../ui/icons';
import { interviewLabel } from './applicants/InterviewField';
import { DueForDeletionBanner } from './DueForDeletionBanner';
import { apiMessage, PageHeading } from './parts';

const dayLabel = (iso: string) => formatDate(iso).slice(0, 5);

function StatCard({
  icon,
  label,
  value,
  hint,
  to,
}: {
  icon: IconName;
  label: string;
  value: number;
  hint?: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="card-hover flex flex-col gap-2 rounded-card border border-line bg-white p-5 text-navy no-underline"
    >
      <span className="inline-flex items-center gap-2 text-sm text-slate">
        <Icon name={icon} size={16} className="text-accent" />
        {label}
      </span>
      <span className="font-serif text-[34px] font-medium leading-none">{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </Link>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-card border border-line bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 font-serif text-[22px] font-medium">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Bar chart of applications per day. Tap or hover a bar to read its number. */
function PerDayChart({ data }: { data: DashboardDto }) {
  const [jobId, setJobId] = useState('');
  const [picked, setPicked] = useState<number | null>(null);
  const counts = jobId
    ? (data.perJobPerDay.find((j) => j.jobId === jobId)?.counts ?? data.perDay.map(() => 0))
    : data.perDay.map((d) => d.count);
  const max = Math.max(1, ...counts);
  const total = counts.reduce((a, b) => a + b, 0);
  const shown = picked ?? counts.length - 1;

  return (
    <Panel
      title="Hồ sơ nhận theo ngày"
      action={
        <SelectField
          label="Lọc theo tin"
          hideLabel
          value={jobId}
          onChange={(e) => {
            setJobId(e.target.value);
            setPicked(null);
          }}
          className="min-w-[220px] max-sm:w-full"
        >
          <option value="">Tất cả tin</option>
          {data.perJobPerDay.map((j) => (
            <option key={j.jobId} value={j.jobId}>
              {j.jobTitle}
            </option>
          ))}
        </SelectField>
      }
    >
      <p role="status" className="m-0 text-sm text-body">
        <strong className="font-semibold text-navy">{total}</strong> hồ sơ trong 30 ngày qua ·{' '}
        <span className="text-accent">
          ngày {dayLabel(data.perDay[shown].day)}: <strong className="font-semibold">{counts[shown]}</strong> hồ sơ
        </span>
      </p>
      <div
        role="group"
        aria-label="Hồ sơ theo ngày, dùng phím mũi tên để xem từng ngày"
        className="flex h-[180px] items-end gap-[3px] border-b border-line sm:gap-1"
        onMouseLeave={() => setPicked(null)}
        onKeyDown={(e) => {
          // One Tab stop for the whole chart; arrows move between days.
          const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (!step) return;
          e.preventDefault();
          const next = Math.min(counts.length - 1, Math.max(0, shown + step));
          setPicked(next);
          (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
        }}
      >
        {counts.map((count, i) => {
          const on = i === shown;
          return (
            <button
              key={data.perDay[i].day}
              type="button"
              aria-label={`Ngày ${dayLabel(data.perDay[i].day)}: ${count} hồ sơ`}
              aria-pressed={on}
              tabIndex={on ? 0 : -1}
              onMouseEnter={() => setPicked(i)}
              onFocus={() => setPicked(i)}
              onClick={() => setPicked(i)}
              className="group flex h-full min-w-0 flex-1 items-end border-0 bg-transparent p-0"
            >
              <span
                className={`w-full rounded-t-[3px] transition-colors ${on ? 'bg-navy' : count ? 'bg-accent/70 group-hover:bg-accent' : 'bg-line'}`}
                style={{ height: `${count ? Math.max(6, (count / max) * 100) : 3}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-muted">
        <span>{dayLabel(data.perDay[0].day)}</span>
        <span>{dayLabel(data.perDay[14].day)}</span>
        <span>Hôm nay</span>
      </div>
    </Panel>
  );
}

function Interviews({ data }: { data: DashboardDto }) {
  return (
    <Panel
      title="Lịch hẹn phỏng vấn"
      action={
        <Link to="/hr/ho-so?trang-thai=interview" className="text-sm no-underline hover:underline">
          Xem tất cả
        </Link>
      }
    >
      {data.interviews.length === 0 ? (
        <p className="m-0 text-sm text-slate">Chưa có ai đang hẹn phỏng vấn.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {data.interviews.map((i) => (
            <li key={i.id} className="border-b border-line-soft py-3 last:border-b-0">
              <Link
                to={`/hr/ho-so?id=${i.id}`}
                className="flex flex-col gap-0.5 text-navy no-underline hover:underline"
              >
                <span className="font-semibold">{i.fullName}</span>
                <span className="text-[13px] text-slate">{i.jobTitle}</span>
                <span className="text-[13px] font-medium text-accent">
                  {i.interviewAt ? interviewLabel(i.interviewAt) : 'Chưa chọn giờ'}
                </span>
                {i.noteLine && <span className="truncate text-xs italic text-muted">“{i.noteLine}”</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function EndingJobs({ data }: { data: DashboardDto }) {
  return (
    <Panel title="Tin sắp hết hạn hoặc vừa hết hạn">
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

export function HrDashboardPage() {
  usePageMeta('Tổng quan');
  const dashboard = useDashboard();
  const showSkeleton = useDelayedFlag(dashboard.isPending);
  const data = dashboard.data;
  const last7 = data ? data.perDay.slice(-7).reduce((sum, d) => sum + d.count, 0) : 0;

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
          <DueForDeletionBanner count={data.dueForDeletion} />
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              icon="inbox"
              label="Hồ sơ mới chưa xem"
              value={data.newApplications}
              hint={data.waitingOver3Days > 0 ? `${data.waitingOver3Days} hồ sơ đã chờ hơn 3 ngày` : undefined}
              to="/hr/ho-so?trang-thai=new"
            />
            <StatCard
              icon="calendar"
              label="Đang hẹn phỏng vấn"
              value={data.interviews.length}
              to="/hr/ho-so?trang-thai=interview"
            />
            <StatCard icon="trend" label="Hồ sơ 7 ngày qua" value={last7} to="/hr/ho-so" />
          </div>
          <PerDayChart data={data} />
          <div className="grid items-start gap-5 xl:grid-cols-2">
            <Interviews data={data} />
            <EndingJobs data={data} />
          </div>
        </div>
      )}
    </>
  );
}

export default HrDashboardPage;
