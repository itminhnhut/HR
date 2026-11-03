import {
  formatTimestamp,
  type ApplicationDetailDto,
  type CvScoreDto,
  type MatchItem,
  type MatchVerdict,
} from '@careers/shared';
import { useEffect, useRef } from 'react';
import { useScoreCv } from '../../../api/queries';
import { Button } from '../../../ui/Button';
import { FieldError } from '../../../ui/Field';
import { Icon, type IconName } from '../../../ui/icons';
import { errorMessage } from '../parts';

const GROUPS: { verdict: MatchVerdict; title: string; short: string; icon: IconName; tone: string }[] = [
  { verdict: 'unmet', title: 'Không thoả', short: 'không thoả', icon: 'x', tone: 'text-error' },
  { verdict: 'met', title: 'Thoả', short: 'thoả', icon: 'check', tone: 'text-ok' },
  {
    verdict: 'unknown',
    title: 'Không chấm được từ CV (HR tự đánh giá)',
    short: 'HR tự đánh giá',
    icon: 'info',
    tone: 'text-slate',
  },
];

/** How many of the requirements a CV can show were judged; null for results stored before lines were marked. */
export function coverageOf(items: readonly MatchItem[]): { judged: number; total: number } | null {
  if (items.every((i) => i.counted === undefined)) return null;
  const counted = items.filter((i) => i.counted);
  return { judged: counted.filter((i) => i.verdict !== 'unknown').length, total: counted.length };
}

/** Colour of a percentage, the same in the list and here. */
export function percentTone(percent: number): string {
  if (percent >= 80) return 'bg-ok-soft text-ok';
  if (percent >= 50) return 'bg-tint text-accent';
  return 'bg-error-soft text-error';
}

function Item({ item }: { item: MatchItem }) {
  // For a met line the CV quote says it all ("CV có Excel" adds nothing); otherwise the reason explains it.
  const reason = item.verdict === 'met' && item.evidence ? null : item.reason;
  return (
    <li className="flex flex-col gap-0.5 border-b border-line-soft py-2 text-sm last:border-b-0">
      <span className="font-medium text-navy">{item.requirement}</span>
      {reason && <span className="text-[13px] text-body">{reason}</span>}
      {item.evidence && <span className="text-[13px] italic text-muted">Trong CV: “{item.evidence}”</span>}
    </li>
  );
}

function Heading({ result, tooLittle }: { result: CvScoreDto | null; tooLittle: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <strong className="text-sm font-semibold text-navy">Chấm CV theo yêu cầu</strong>
      {result?.percent != null && (
        <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${percentTone(result.percent)}`}>
          {result.percent}%
        </span>
      )}
      {tooLittle && (
        <span className="rounded-full bg-tint px-2.5 py-0.5 text-sm font-semibold text-slate">Chưa đủ dữ liệu</span>
      )}
    </span>
  );
}

function Counts({ items }: { items: readonly MatchItem[] }) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
      {GROUPS.map((g) => {
        const n = items.filter((i) => i.verdict === g.verdict).length;
        return n > 0 ? (
          <span key={g.verdict} className={`inline-flex items-center gap-1 font-medium ${g.tone}`}>
            <Icon name={g.icon} size={13} stroke={2} />
            {n} {g.short}
          </span>
        ) : null;
      })}
    </span>
  );
}

function Groups({ items }: { items: readonly MatchItem[] }) {
  return GROUPS.map((g) => {
    const lines = items.filter((i) => i.verdict === g.verdict);
    if (lines.length === 0) return null;
    // Open by default so HR sees which lines are met or not; a click folds a group away.
    return (
      <details key={g.verdict} open className="group">
        <summary
          className={`flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold ${g.tone}`}
        >
          <Icon name="chevronDown" size={14} className="-rotate-90 transition-transform group-open:rotate-0" />
          {g.title} ({lines.length})
        </summary>
        <ul className="m-0 list-none p-0 pl-5">
          {lines.map((item) => (
            <Item key={item.requirement} item={item} />
          ))}
        </ul>
      </details>
    );
  });
}

/**
 * Automatic CV check against the job's requirements: met / not met (with the CV quote as evidence) and what a
 * CV cannot show. A hint for HR, never a decision: it does not change the status.
 */
export function CvMatch({ app }: { app: ApplicationDetailDto }) {
  const score = useScoreCv();
  const result = app.cvScore;
  const asked = useRef(false);
  const canRead = !!app.cvFileName && !app.cvLink;
  const coverage = result ? coverageOf(result.items) : null;
  const tooLittle = result != null && result.percent == null && !result.note && coverage != null && coverage.total > 0;

  // Score once when a CV file is opened and has no result yet; the server reuses stored results.
  useEffect(() => {
    if (asked.current || result || !canRead) return;
    asked.current = true;
    score.mutate(app.id);
  }, [app.id, canRead, score, result]);

  return (
    <section
      aria-label="Chấm CV theo yêu cầu"
      className="flex flex-col gap-3 rounded-card border border-line px-4 py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Heading result={result} tooLittle={tooLittle} />
        <Button
          variant="outline"
          size="sm"
          icon="search"
          disabled={score.isPending}
          onClick={() => score.mutate(app.id)}
        >
          {score.isPending ? 'Đang chấm…' : result ? 'Chấm lại' : 'Chấm CV'}
        </Button>
      </div>
      {score.isError && <FieldError>{errorMessage(score.error)}</FieldError>}
      {result?.note && <span className="text-sm text-slate">{result.note}</span>}
      {coverage != null && coverage.total > 0 && (
        <span className="text-[13px] text-slate">
          Chấm được {coverage.judged}/{coverage.total} yêu cầu đo được từ CV.
          {tooLittle && ' Chưa đủ để ra %, HR xem trực tiếp.'}
        </span>
      )}
      {result && result.items.length > 0 && <Counts items={result.items} />}
      {result && <Groups items={result.items} />}
      {result && (
        <span className="text-xs text-muted">
          Gợi ý tự động, chấm lúc {formatTimestamp(result.scoredAt)}. % = số yêu cầu thoả / số yêu cầu đo được từ CV
          (dòng chưa rõ tính là chưa thể hiện; kỹ năng mềm và điểm cộng không tính); không tự đổi trạng thái hồ sơ.
        </span>
      )}
    </section>
  );
}
