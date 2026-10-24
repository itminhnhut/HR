import { CANDIDATE_STAGE_LABEL, type CandidateStage } from '@careers/shared';
import { Icon } from '../ui/icons';

const STEP_ORDER: CandidateStage[] = ['sent', 'seen', 'interview'];

/** One colour per stage, from the style guide palette: quiet early on, green for an interview invitation. */
const TONE: Record<CandidateStage, { pill: string; bar: string }> = {
  sent: { pill: 'bg-tint text-body', bar: 'bg-slate' },
  seen: { pill: 'bg-remind text-accent', bar: 'bg-accent' },
  interview: { pill: 'bg-ok-soft text-ok', bar: 'bg-ok' },
  closed: { pill: 'bg-mist text-muted', bar: 'bg-silver' },
};

/** What the candidate may see of an application: a coloured pill, plus the 3-step bar on wider screens. */
export function ApplicationStage({ stage }: { stage: CandidateStage }) {
  const label = CANDIDATE_STAGE_LABEL[stage];
  return (
    <>
      <span className="sr-only">Trạng thái: {label}</span>
      <StagePill stage={stage} label={label} />
      <StageBar stage={stage} />
    </>
  );
}

function StagePill({ stage, label }: { stage: CandidateStage; label: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center gap-1.5 self-start whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium ${TONE[stage].pill}`}
    >
      {stage === 'interview' ? (
        <Icon name="check" size={14} stroke={2} />
      ) : (
        <span className="size-[7px] rounded-full bg-current" />
      )}
      {label}
    </span>
  );
}

function StageBar({ stage }: { stage: CandidateStage }) {
  const reached = stage === 'closed' ? -1 : STEP_ORDER.indexOf(stage);
  return (
    <div aria-hidden="true" className="hidden grid-cols-3 gap-2 sm:grid">
      {STEP_ORDER.map((s, i) => {
        const done = stage === 'closed' ? false : i <= reached;
        const current = i === reached;
        return (
          <span
            key={s}
            className={`flex min-w-0 flex-col gap-1.5 whitespace-nowrap text-[11px] ${
              current
                ? `font-semibold ${stage === 'interview' ? 'text-ok' : 'text-navy'}`
                : done
                  ? 'text-body'
                  : 'text-muted'
            }`}
          >
            <span
              className={`h-1 rounded-full ${stage === 'closed' ? 'bg-line' : done ? TONE[stage].bar : 'bg-line'}`}
            />
            {s === 'interview' ? 'Phỏng vấn' : CANDIDATE_STAGE_LABEL[s]}
          </span>
        );
      })}
    </div>
  );
}
