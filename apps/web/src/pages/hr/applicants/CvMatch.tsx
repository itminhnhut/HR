import { CV_LINK_NOTE, type ApplicationDetailDto, type CvScoreDto } from '@careers/shared';
import { useEffect, useRef, useState } from 'react';
import { useScoreCv } from '../../../api/queries';
import { buttonClass } from '../../../ui/Button';
import { FieldError } from '../../../ui/Field';
import { Icon } from '../../../ui/icons';
import { errorMessage } from '../parts';
import { bonusCount, coverageOf, groupLines, MATCH_TABS, type MatchTab } from './cvMatchLines';
import { CvMatchDrawer } from './CvMatchDrawer';
import { VerdictCount, VerdictIcon } from './VerdictMark';

/** Colour of a percentage, the same in the list and here. */
export function percentTone(percent: number): string {
  if (percent >= 80) return 'bg-ok-soft text-ok';
  if (percent >= 50) return 'bg-tint text-accent';
  return 'bg-error-soft text-error';
}

/** Lines were judged, but too few of them to give a percent. */
function isTooLittle(result: CvScoreDto | null): boolean {
  if (!result || result.percent != null || result.note) return false;
  const coverage = coverageOf(result.items);
  return coverage != null && coverage.total > 0;
}

/** The percent, or plainly why there is none. Shown in the detail and at the top of the drawer. */
export function MatchBadge({ result, isScoring }: { result: CvScoreDto | null; isScoring: boolean }) {
  const pill = 'rounded-full px-2.5 py-0.5 text-sm font-semibold';
  if (isScoring) return <span className={`${pill} bg-tint text-slate`}>Đang chấm…</span>;
  if (result?.percent != null)
    return <span className={`${pill} ${percentTone(result.percent)}`}>{result.percent}%</span>;
  if (isTooLittle(result)) return <span className={`${pill} bg-tint text-slate`}>Chưa đủ dữ liệu</span>;
  if (!result) return <span className={`${pill} bg-tint text-slate`}>Chưa chấm</span>;
  return null;
}

/** Beside the percent, never in it: what settles a tie between two CVs. */
export function BonusBadge({ result }: { result: CvScoreDto | null }) {
  const count = bonusCount(result?.items ?? []);
  if (count === 0) return null;
  return <span className="rounded-full bg-ok-soft px-2.5 py-0.5 text-sm font-semibold text-ok">+{count} điểm cộng</span>;
}

/** One stat per verdict: its icon, a big number and the word. Pressing one opens the drawer on that tab. */
function Stats({ result, onOpen }: { result: CvScoreDto; onOpen: (tab: MatchTab) => void }) {
  const groups = groupLines(result.items);
  return (
    <div className="grid grid-cols-3 gap-2">
      {MATCH_TABS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          aria-label={`${label}: ${groups[key].length}`}
          onClick={() => onOpen(key)}
          className="flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-control border border-line bg-white px-1 py-1.5 text-xs text-body transition-colors hover:bg-mist"
        >
          <span className="flex items-center gap-1.5">
            <VerdictIcon tab={key} isMuted={groups[key].length === 0} />
            <VerdictCount tab={key} count={groups[key].length} />
          </span>
          {label}
        </button>
      ))}
    </div>
  );
}

/** The row in the detail. */
function Summary({
  result,
  isScoring,
  note,
  error,
  onOpen,
}: {
  result: CvScoreDto | null;
  isScoring: boolean;
  note: string | null;
  error: string | null;
  onOpen: (tab?: MatchTab | null) => void;
}) {
  return (
    <section aria-label="Chấm CV theo yêu cầu" className="flex flex-col gap-2 rounded-card border border-line p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <strong className="text-sm font-semibold text-navy">Chấm CV</strong>
          <MatchBadge result={result} isScoring={isScoring} />
          <BonusBadge result={result} />
        </span>
        <button
          type="button"
          onClick={() => onOpen()}
          className={buttonClass('outline', 'compact', 'whitespace-nowrap')}
        >
          Xem chấm CV
          <Icon name="chevronRight" size={16} />
        </button>
      </div>
      {result && result.items.length > 0 && <Stats result={result} onOpen={onOpen} />}
      {note && <span className="text-[13px] text-slate">{note}</span>}
      <FieldError>{error}</FieldError>
    </section>
  );
}

/**
 * Automatic CV check against the job's requirements, as one row in the detail: the percent and the counts, with
 * every line in a drawer of its own. A hint for HR, never a decision: it does not change the status.
 */
export function CvMatch({ app }: { app: ApplicationDetailDto }) {
  const score = useScoreCv();
  const [isOpen, setIsOpen] = useState(false);
  const [startTab, setStartTab] = useState<MatchTab | null>(null);
  const result = app.cvScore;
  const asked = useRef(false);
  const canRead = !!app.cvFileName && !app.cvLink;
  // A link is never scored by itself, so say why there is no result before HR asks for one.
  const note = result ? result.note : app.cvLink ? CV_LINK_NOTE : null;

  // Score once when a CV file is opened and has no result yet; the server reuses stored results.
  useEffect(() => {
    if (asked.current || result || !canRead) return;
    asked.current = true;
    score.mutate(app.id);
  }, [app.id, canRead, score, result]);

  const openDrawer = (tab: MatchTab | null = null) => {
    setStartTab(tab);
    setIsOpen(true);
    if (!result && !score.isPending) score.mutate(app.id);
  };

  return (
    <>
      <Summary
        result={result}
        isScoring={score.isPending}
        note={note}
        error={score.isError ? errorMessage(score.error) : null}
        onOpen={openDrawer}
      />
      <CvMatchDrawer
        app={app}
        open={isOpen}
        onClose={() => setIsOpen(false)}
        startTab={startTab}
        isScoring={score.isPending}
        error={score.isError ? errorMessage(score.error) : null}
        onScore={() => score.mutate(app.id)}
        note={note}
      />
    </>
  );
}
