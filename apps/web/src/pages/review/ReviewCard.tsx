import {
  formatTimestamp,
  REVIEW_DECISION_LABEL,
  REVIEW_TEXT_MAX,
  type ReviewDecision,
  type ReviewItemPublicDto,
} from '@careers/shared';
import { useState } from 'react';
import { useReviewDecide } from '../../api/queries';
import { Icon } from '../../ui/icons';
import { errorMessage } from '../hr/parts';

const EDGE: Record<ReviewDecision, string> = {
  approve: 'border-ok-line shadow-[inset_4px_0_0_var(--color-ok)]',
  reject: 'border-error/30 shadow-[inset_4px_0_0_var(--color-error)]',
  ask: 'border-cat-amber-line shadow-[inset_4px_0_0_var(--color-cat-amber)]',
};

function MatchRing({ percent }: { percent: number | null }) {
  if (percent == null) {
    return (
      <span className="flex size-[58px] shrink-0 items-center justify-center rounded-full bg-tint text-center text-[10px] leading-tight text-slate">
        Chưa
        <br />
        chấm
      </span>
    );
  }
  const color = percent >= 75 ? 'var(--color-ok)' : percent >= 50 ? 'var(--color-cat-amber)' : 'var(--color-error)';
  return (
    <span
      role="img"
      aria-label={`Khớp CV ${percent}%`}
      className="grid size-[58px] shrink-0 place-items-center rounded-full"
      style={{ background: `conic-gradient(${color} ${percent}%, var(--color-tint) 0)` }}
    >
      <span className="flex size-[46px] flex-col items-center justify-center rounded-full bg-white leading-none">
        <span className="text-sm font-bold text-navy">{percent}%</span>
        <span className="mt-0.5 text-[9.5px] text-muted">khớp</span>
      </span>
    </span>
  );
}

const VERDICT = {
  met: ['✓', 'bg-ok-soft text-ok'],
  unmet: ['✕', 'bg-error-soft text-error'],
  unknown: ['?', 'bg-tint text-slate'],
} as const;

function MatchList({ items }: { items: ReviewItemPublicDto['matchItems'] }) {
  if (items.length === 0) return null;
  return (
    <div className="mx-4 rounded-card border border-line-soft bg-hover px-3 py-2.5">
      <h3 className="m-0 mb-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-muted">
        So với yêu cầu tin tuyển dụng
      </h3>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13.5px] text-body">
        {items.map((m) => (
          <li key={m.requirement} className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className={`mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${VERDICT[m.verdict][1]}`}
            >
              {VERDICT[m.verdict][0]}
            </span>
            <span>
              {m.requirement}
              {/* Only why it is not met: the scorer's notes on "?" lines are written for HR. */}
              {m.reason && m.verdict === 'unmet' && <span className="text-slate"> · {m.reason}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CvButton({ item, onOpen }: { item: ReviewItemPublicDto; onOpen: () => void }) {
  const cls =
    'mx-4 flex min-h-12 items-center justify-between gap-3 rounded-card border border-line bg-white px-3.5 text-left text-sm font-semibold text-navy no-underline hover:border-silver';
  const inner = (
    <>
      <span className="inline-flex items-center gap-2.5">
        <Icon name="file" size={18} />
        Xem CV
        <span className="font-normal text-muted">{item.cv === 'link' ? 'link ứng viên gửi' : 'PDF'}</span>
      </span>
      <Icon name={item.cv === 'link' ? 'external' : 'chevronRight'} size={16} />
    </>
  );
  if (item.cv === 'file')
    return (
      <button type="button" onClick={onOpen} className={cls}>
        {inner}
      </button>
    );
  if (item.cv === 'link' && item.cvLink)
    return (
      <a href={item.cvLink} target="_blank" rel="noreferrer" className={cls}>
        {inner}
      </a>
    );
  return <p className="mx-4 my-0 text-[13px] text-muted">Ứng viên không gửi CV.</p>;
}

const BUTTONS: { key: ReviewDecision; label: string; on: string; idle: string }[] = [
  { key: 'approve', label: '✓ Duyệt PV', on: 'border-ok bg-ok text-white', idle: 'border-ok-line bg-white text-ok' },
  {
    key: 'reject',
    label: 'Không',
    on: 'border-error bg-error text-white',
    idle: 'border-error/40 bg-white text-error',
  },
  {
    key: 'ask',
    label: 'Hỏi HR',
    on: 'border-cat-amber bg-cat-amber text-white',
    idle: 'border-cat-amber-line bg-white text-cat-amber',
  },
];

const PROMPT: Record<ReviewDecision, string> = {
  approve: 'Ghi chú cho HR (không bắt buộc)',
  reject: 'Lý do không phỏng vấn',
  ask: 'Anh/chị cần HR hỏi thêm gì?',
};

/** Choose, and for "Không" / "Hỏi HR" write why; every change is saved at once. */
function Decide({ item, token, readOnly }: { item: ReviewItemPublicDto; token: string; readOnly: boolean }) {
  const decide = useReviewDecide(token);
  const [picked, setPicked] = useState<ReviewDecision | null>(item.decision);
  const [comment, setComment] = useState(item.reviewerComment ?? '');
  const locked = readOnly || item.scheduled;
  const save = (decision: ReviewDecision | null, text = comment) =>
    decide.mutate({ itemId: item.id, input: { decision, comment: decision ? text.trim() || null : null } });
  const choose = (key: ReviewDecision) => {
    if (picked === key && item.decision === key) {
      setPicked(null);
      setComment('');
      save(null, '');
      return;
    }
    setPicked(key);
    if (key === 'approve') save('approve');
  };
  const needsText = picked === 'reject' || picked === 'ask';
  const unsaved = picked !== item.decision || (comment.trim() || null) !== (item.reviewerComment ?? null);
  return (
    <div className="mt-auto flex flex-col gap-2.5 border-t border-line-soft bg-hover px-4 py-3.5">
      <div role="group" aria-label={`Quyết định cho ${item.fullName}`} className="grid grid-cols-[1.3fr_1fr_1fr] gap-2">
        {BUTTONS.map((b) => (
          <button
            key={b.key}
            type="button"
            disabled={locked || decide.isPending}
            aria-pressed={picked === b.key}
            onClick={() => choose(b.key)}
            className={`min-h-11 rounded-control border text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${picked === b.key ? b.on : b.idle}`}
          >
            {b.label}
          </button>
        ))}
      </div>
      {picked && !locked && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(picked);
          }}
          className="flex flex-col gap-2"
        >
          <label className="flex flex-col gap-1 text-[12.5px] text-slate">
            {PROMPT[picked]}
            <textarea
              value={comment}
              maxLength={REVIEW_TEXT_MAX}
              rows={2}
              onChange={(e) => setComment(e.target.value)}
              autoFocus={needsText && !item.decision}
              className="field-focus rounded-control border border-field bg-white px-3 py-2 text-sm text-navy"
            />
          </label>
          {unsaved && (
            <button
              type="submit"
              disabled={decide.isPending || (needsText && comment.trim().length < 2)}
              className="min-h-10 w-fit rounded-control border-0 bg-navy px-4 text-sm font-semibold text-white disabled:bg-silver"
            >
              {needsText ? `Lưu: ${REVIEW_DECISION_LABEL[picked]}` : 'Lưu ghi chú'}
            </button>
          )}
        </form>
      )}
      <SaveState item={item} pending={decide.isPending} error={decide.error} unsaved={unsaved && needsText} />
    </div>
  );
}

function SaveState({
  item,
  pending,
  error,
  unsaved,
}: {
  item: ReviewItemPublicDto;
  pending: boolean;
  error: unknown;
  unsaved: boolean;
}) {
  if (item.scheduled)
    return <span className="text-[12.5px] font-medium text-ok">HR đã hẹn phỏng vấn, không đổi được nữa.</span>;
  if (pending) return <span className="text-[12.5px] text-slate">Đang lưu…</span>;
  if (error)
    return (
      <span role="alert" className="text-[12.5px] text-error">
        {errorMessage(error)}
      </span>
    );
  if (unsaved) return <span className="text-[12.5px] text-cat-amber">Ghi lý do rồi bấm Lưu.</span>;
  if (!item.decision) return null;
  return <span className="text-[12.5px] text-ok">✓ Đã lưu · {REVIEW_DECISION_LABEL[item.decision]}</span>;
}

/** One application: everything to decide (CV match, HR's view, the candidate's words, the CV) and the choice. */
export function ReviewCard({
  item,
  token,
  readOnly,
  onOpenCv,
}: {
  item: ReviewItemPublicDto;
  token: string;
  readOnly: boolean;
  onOpenCv: () => void;
}) {
  return (
    <article
      className={`flex flex-col gap-3 overflow-hidden rounded-card border bg-white pt-4 ${item.decision ? EDGE[item.decision] : 'border-line'}`}
    >
      <div className="flex items-start gap-3.5 px-4">
        <MatchRing percent={item.matchPercent} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="m-0 text-[17px] font-semibold leading-snug">{item.fullName}</h2>
          <p className="m-0 text-[13px] text-slate">
            {item.jobTitle} · nộp {formatTimestamp(item.appliedAt)}
          </p>
          <span
            className={`w-fit rounded-full border px-2.5 py-0.5 text-xs font-semibold ${item.hrPick === 'yes' ? 'border-ok-line bg-ok-soft text-ok' : 'border-cat-amber-line bg-cat-amber-soft text-cat-amber'}`}
          >
            {item.hrPick === 'yes' ? '★ HR đề xuất phỏng vấn' : 'HR: cân nhắc'}
          </span>
          {item.cvUpdated && (
            <span className="w-fit rounded-full border border-cat-violet-line bg-cat-violet-soft px-2.5 py-0.5 text-xs font-semibold text-cat-violet">
              CV vừa cập nhật, xem lại bản mới
            </span>
          )}
        </div>
      </div>
      <MatchList items={item.matchItems} />
      {item.hrComment && (
        <div className="mx-4 rounded-r-card border-l-[3px] border-accent bg-tint px-3 py-2.5 text-[13.5px] text-ink">
          <h3 className="m-0 mb-1 text-xs font-semibold uppercase tracking-[0.06em] text-accent">Nhận xét của HR</h3>
          {item.hrComment}
        </div>
      )}
      {item.message && (
        <p className="mx-4 my-0 text-[13.5px] italic text-slate">
          “{item.message}” <span className="not-italic">— lời nhắn ứng viên</span>
        </p>
      )}
      {item.decision === 'ask' && item.hrReply && (
        <p className="mx-4 my-0 rounded-card border border-cat-amber-line bg-cat-amber-soft px-3 py-2 text-[13.5px] text-ink">
          <b>HR trả lời:</b> {item.hrReply}
        </p>
      )}
      <CvButton item={item} onOpen={onOpenCv} />
      <Decide key={`${item.decision}-${item.reviewerComment}`} item={item} token={token} readOnly={readOnly} />
    </article>
  );
}
