import { formatTimestamp, type ApplicationDetailDto } from '@careers/shared';
import { useId, useState, type KeyboardEvent } from 'react';
import { Button } from '../../../ui/Button';
import { FieldError } from '../../../ui/Field';
import { Icon } from '../../../ui/icons';
import { CvAction } from './CvAction';
import { BonusBadge, MatchBadge } from './CvMatch';
import {
  bySection,
  coverageOf,
  defaultTab,
  groupLines,
  MATCH_TABS,
  reasonOf,
  tabOf,
  type MatchLine,
  type MatchTab,
} from './cvMatchLines';
import { ReplaceCv } from './CvPanel';
import { DetailDrawer } from './DetailDrawer';
import { VerdictCount, VerdictIcon } from './VerdictMark';

const DRAWER_CV_ACTION =
  'inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-control px-3 text-sm no-underline';

function Line({ line }: { line: MatchLine }) {
  const reason = reasonOf(line);
  return (
    <li className="flex gap-2.5 border-b border-line-soft py-2.5 text-sm last:border-b-0">
      <VerdictIcon tab={tabOf(line)} className="mt-0.5" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium text-navy">{line.requirement}</span>
        {reason && <span className="text-[13px] text-body">{reason}</span>}
        {line.evidence && <span className="text-[13px] italic text-muted">Trong CV: “{line.evidence}”</span>}
      </span>
    </li>
  );
}

/** Left, Right, Home and End move between the tabs, and the tab in focus is the one shown. */
function nextTab(key: string, current: MatchTab): MatchTab | null {
  const at = MATCH_TABS.findIndex((t) => t.key === current);
  const count = MATCH_TABS.length;
  if (key === 'ArrowRight') return MATCH_TABS[(at + 1) % count]?.key ?? null;
  if (key === 'ArrowLeft') return MATCH_TABS[(at - 1 + count) % count]?.key ?? null;
  if (key === 'Home') return MATCH_TABS[0]?.key ?? null;
  if (key === 'End') return MATCH_TABS[count - 1]?.key ?? null;
  return null;
}

function emptyMessage(tab: MatchTab, hasResult: boolean, isScoring: boolean): string {
  if (isScoring) return 'Đang chấm CV…';
  if (!hasResult) return 'CV này chưa được chấm.';
  return MATCH_TABS.find((t) => t.key === tab)?.empty ?? '';
}

function TabPanel({ id, tabId, lines, empty }: { id: string; tabId: string; lines: MatchLine[]; empty: string }) {
  return (
    <div
      id={id}
      role="tabpanel"
      aria-labelledby={tabId}
      tabIndex={0}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-2 focus-visible:-outline-offset-2 max-sm:px-4"
    >
      {lines.length > 0 ? (
        bySection(lines).map((part) => (
          <section key={part.title} aria-label={part.title} className="pb-2">
            <h3 className="m-0 pt-2.5 text-xs font-semibold tracking-wide text-slate uppercase">
              {part.title} ({part.lines.length})
            </h3>
            <ul className="m-0 list-none p-0">
              {part.lines.map((line) => (
                <Line key={line.requirement} line={line} />
              ))}
            </ul>
          </section>
        ))
      ) : (
        <p className="m-0 px-2 py-10 text-center text-sm text-slate">{empty}</p>
      )}
    </div>
  );
}

function TabBar({
  id,
  active,
  groups,
  onChoose,
  onKeyDown,
}: {
  id: string;
  active: MatchTab;
  groups: Record<MatchTab, MatchLine[]>;
  onChoose: (tab: MatchTab) => void;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Kết quả chấm CV"
      onKeyDown={onKeyDown}
      className="flex flex-none gap-x-5 border-b border-field px-5 max-sm:gap-x-4 max-sm:px-4"
    >
      {MATCH_TABS.map(({ key, label }) => {
        const on = key === active;
        return (
          <button
            key={key}
            id={`${id}-tab-${key}`}
            type="button"
            role="tab"
            aria-label={`${label}: ${groups[key].length}`}
            aria-selected={on}
            aria-controls={on ? `${id}-panel` : undefined}
            tabIndex={on ? 0 : -1}
            onClick={() => onChoose(key)}
            className={`-mb-px inline-flex min-h-12 shrink-0 items-center gap-1.5 whitespace-nowrap border-0 border-b-2 bg-transparent px-0.5 text-sm ${on ? 'border-navy font-semibold text-navy' : 'border-transparent text-slate hover:text-navy'}`}
          >
            <VerdictIcon tab={key} isMuted={groups[key].length === 0} />
            {label}
            <VerdictCount tab={key} count={groups[key].length} />
          </button>
        );
      })}
    </div>
  );
}

function ResultTabs({
  lines,
  hasResult,
  isScoring,
  startTab,
}: {
  lines: readonly MatchLine[];
  hasResult: boolean;
  isScoring: boolean;
  /** The verdict HR pressed in the detail; otherwise the tab follows the result. */
  startTab: MatchTab | null;
}) {
  const groups = groupLines(lines);
  // Follows the result until HR picks a tab: a score that arrives while the drawer is open still opens on "Không đạt".
  const [chosen, setChosen] = useState<MatchTab | null>(startTab);
  const active = chosen ?? defaultTab(groups);
  const id = useId();

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = nextTab(e.key, active);
    if (!next) return;
    e.preventDefault();
    setChosen(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  };

  return (
    <>
      <TabBar id={id} active={active} groups={groups} onChoose={setChosen} onKeyDown={onKeyDown} />
      <TabPanel
        id={`${id}-panel`}
        tabId={`${id}-tab-${active}`}
        lines={groups[active]}
        empty={emptyMessage(active, hasResult, isScoring)}
      />
    </>
  );
}

/** A CV the system cannot read as a file: what would make scoring possible, with the existing add-a-CV form. */
function AddPdf({ app }: { app: ApplicationDetailDto }) {
  const [isAdding, setIsAdding] = useState(false);
  if (isAdding) return <ReplaceCv app={app} onDone={() => setIsAdding(false)} />;
  return (
    <span className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-slate">
      {app.cvLink ? 'Muốn chấm được, hãy tải file PDF của CV.' : 'Hồ sơ này chưa có CV. Tải file PDF để chấm.'}
      <Button size="compact" variant="outline" icon="upload" onClick={() => setIsAdding(true)}>
        Tải file PDF
      </Button>
    </span>
  );
}

function DrawerNotes({ app, note, error }: { app: ApplicationDetailDto; note: string | null; error: string | null }) {
  const coverage = coverageOf(app.cvScore?.items ?? []);
  const hasCoverage = coverage != null && coverage.total > 0;
  const canRead = !!app.cvFileName && !app.cvLink;
  if (!note && !error && canRead && !hasCoverage) return null;
  return (
    <div className="flex flex-none flex-col gap-2 border-b border-line-soft bg-mist px-5 py-3 max-sm:px-4">
      {note && <span className="text-sm text-slate">{note}</span>}
      {hasCoverage && (
        <span className="text-[13px] text-slate">
          Chấm được {coverage.judged}/{coverage.total} yêu cầu đo được từ CV.
        </span>
      )}
      {!canRead && <AddPdf app={app} />}
      <FieldError>{error}</FieldError>
    </div>
  );
}

/** Everything about the CV check on one screen, in the narrow drawer. */
export function CvMatchDrawer({
  app,
  open,
  onClose,
  startTab,
  isScoring,
  error,
  onScore,
  note,
}: {
  app: ApplicationDetailDto;
  open: boolean;
  onClose: () => void;
  startTab: MatchTab | null;
  isScoring: boolean;
  error: string | null;
  onScore: () => void;
  note: string | null;
}) {
  const result = app.cvScore;
  const lines: readonly MatchLine[] = result?.items ?? [];
  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title="Chấm CV"
      subtitle={`${app.fullName} · ${app.jobTitle}`}
      badge={
        <>
          <MatchBadge result={result} isScoring={isScoring} />
          <BonusBadge result={result} />
        </>
      }
      action={
        <>
          {/* HR compares the lines with the CV. */}
          <CvAction app={app} shape={DRAWER_CV_ACTION} isOptional />
          <Button variant="outline" size="compact" disabled={isScoring} onClick={onScore} className="whitespace-nowrap">
            <Icon name="search" size={16} />
            {isScoring ? 'Đang chấm…' : result ? 'Chấm lại' : 'Chấm CV'}
          </Button>
        </>
      }
    >
      <DrawerNotes app={app} note={note} error={error} />
      <ResultTabs lines={lines} hasResult={!!result} isScoring={isScoring} startTab={startTab} />
      {result && (
        <p className="m-0 flex-none border-t border-line-soft px-5 py-2.5 text-xs text-muted max-sm:px-4">
          Gợi ý tự động, chấm lúc {formatTimestamp(result.scoredAt)}. % = số yêu cầu thoả / số yêu cầu chấm được; Mô tả
          công việc và Điểm cộng không tính vào %; không tự đổi trạng thái hồ sơ.
        </p>
      )}
    </DetailDrawer>
  );
}
