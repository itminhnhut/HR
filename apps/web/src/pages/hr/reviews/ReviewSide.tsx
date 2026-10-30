import { REVIEW_DECISION_LABEL, type ReviewBatchDto, type ReviewEventDto } from '@careers/shared';
import { useState } from 'react';
import { useReviewAction } from '../../../api/queries';
import { copyText, useFlash } from '../../../lib/hooks';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/icons';
import { errorMessage } from '../parts';
import { defaultRespondBy, fromLocalInput, reviewLink, shortTime, zaloMessage } from './reviewModel';

function CopyAction({ text, label, done }: { text: string; label: string; done: string }) {
  const [copied, flash] = useFlash();
  return (
    <Button
      type="button"
      size="sm"
      variant={copied ? 'success' : 'outline'}
      icon={copied ? 'check' : 'copy'}
      onClick={() => copyText(text).then((ok) => ok && flash())}
    >
      {copied ? done : label}
    </Button>
  );
}

function Extend({ batch, onDone }: { batch: ReviewBatchDto; onDone: () => void }) {
  const action = useReviewAction(batch.id);
  const [value, setValue] = useState(() => defaultRespondBy(new Date()));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        action.mutate({ type: 'extend', respondBy: fromLocalInput(value) }, { onSuccess: onDone });
      }}
      className="flex flex-col gap-2 rounded-control bg-mist p-3"
    >
      <label className="flex flex-col gap-1 text-xs text-slate">
        Hạn phản hồi mới
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="field-focus min-h-11 rounded-control border border-field bg-white px-3 text-sm text-navy"
        />
      </label>
      {action.error && (
        <span role="alert" className="text-xs text-error">
          {errorMessage(action.error)}
        </span>
      )}
      <span className="flex gap-2">
        <Button type="submit" size="sm" disabled={action.isPending}>
          Lưu hạn mới
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Huỷ
        </Button>
      </span>
    </form>
  );
}

/** The private link: copy it (or a ready Zalo message), its dates, extend, revoke, add people. */
export function LinkPanel({ batch, onAdd }: { batch: ReviewBatchDto; onAdd: () => void }) {
  const action = useReviewAction(batch.id);
  const [extending, setExtending] = useState(false);
  const link = reviewLink(batch.token);
  const revoked = batch.state === 'revoked';
  const facts: [string, string][] = [
    ['Gửi cho', batch.reviewerName],
    ['Người gửi', batch.senderName],
    ['Hạn phản hồi', shortTime(batch.respondBy)],
    ['Link hết hạn', revoked ? 'Đã khoá' : shortTime(batch.expiresAt)],
    ['Sếp đã mở', batch.openedAt ? shortTime(batch.openedAt) : 'Chưa mở'],
    ['Xem xong', batch.doneAt ? shortTime(batch.doneAt) : 'Chưa'],
  ];
  return (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-white p-4">
      <h2 className="m-0 text-xs font-semibold uppercase tracking-[0.06em] text-muted">Link gửi sếp</h2>
      {revoked ? (
        <p className="m-0 text-sm text-slate">Link đã khoá: sếp không mở được nữa.</p>
      ) : (
        <>
          <input
            readOnly
            value={link}
            aria-label="Link duyệt"
            onFocus={(e) => e.target.select()}
            className="min-h-11 w-full rounded-control border border-field bg-mist px-3 text-[13px] text-slate"
          />
          <span className="flex flex-wrap gap-2">
            <CopyAction text={link} label="Copy link" done="Đã copy link" />
            <CopyAction text={zaloMessage(batch, link)} label="Copy tin nhắn Zalo" done="Đã copy tin nhắn" />
          </span>
        </>
      )}
      <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="m-0 text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      {!revoked && extending && <Extend batch={batch} onDone={() => setExtending(false)} />}
      {!revoked && !extending && (
        <span className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" icon="plus" onClick={onAdd}>
            Thêm ứng viên
          </Button>
          <Button size="sm" variant="outline" icon="clock" onClick={() => setExtending(true)}>
            Gia hạn
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon="lock"
            disabled={action.isPending}
            onClick={() => window.confirm('Khoá link? Sếp sẽ không mở được nữa.') && action.mutate({ type: 'revoke' })}
          >
            Khoá link
          </Button>
        </span>
      )}
    </section>
  );
}

const EVENT_TEXT: Record<ReviewEventDto['kind'], (e: ReviewEventDto) => string> = {
  sent: (e) => `${e.actor} gửi ${e.detail ?? ''}`,
  opened: (e) => `${e.actor} mở link`,
  cv: (e) => `${e.actor} xem CV ${e.applicationName ?? 'hồ sơ đã xoá'}`,
  decided: (e) =>
    `${e.actor} chọn "${e.decision ? REVIEW_DECISION_LABEL[e.decision] : ''}" cho ${e.applicationName ?? 'hồ sơ đã xoá'}`,
  cleared: (e) => `${e.actor} bỏ chọn cho ${e.applicationName ?? 'hồ sơ đã xoá'}`,
  done: (e) => `${e.actor} báo đã xem xong`,
  added: (e) => `${e.actor} thêm ${e.applicationName ?? 'hồ sơ đã xoá'}`,
  removed: (e) => `${e.actor} bỏ ${e.applicationName ?? 'hồ sơ đã xoá'} khỏi đợt`,
  extended: (e) => `${e.actor} gia hạn · ${e.detail ?? ''}`,
  revoked: (e) => `${e.actor} khoá link`,
  replied: (e) => `${e.actor} trả lời về ${e.applicationName ?? 'hồ sơ đã xoá'}`,
  bypassed: (e) => `${e.actor} hẹn ${e.applicationName ?? 'hồ sơ đã xoá'} khi sếp chưa duyệt`,
};

const DOT: Partial<Record<ReviewEventDto['kind'], string>> = {
  opened: 'bg-link',
  cv: 'bg-link',
  done: 'bg-ok',
  revoked: 'bg-error',
  bypassed: 'bg-error',
};

const decisionDot = (e: ReviewEventDto) =>
  e.decision === 'approve'
    ? 'bg-ok'
    : e.decision === 'reject'
      ? 'bg-error'
      : e.decision === 'ask'
        ? 'bg-cat-amber'
        : '';

/** "Nhật ký": who did what, newest first. Quotes the reason when there is one. */
export function ReviewLog({ events }: { events: ReviewEventDto[] }) {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-white p-4">
      <h2 className="m-0 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted">
        <Icon name="clock" size={14} /> Nhật ký
      </h2>
      <ol className="m-0 flex list-none flex-col gap-3 p-0 text-[13px]">
        {events.map((e, i) => (
          <li key={`${e.at}-${i}`} className="grid grid-cols-[10px_minmax(0,1fr)] gap-2.5">
            <span
              aria-hidden="true"
              className={`mt-1.5 size-2 rounded-full ${decisionDot(e) || DOT[e.kind] || 'bg-silver'}`}
            />
            <span className="flex flex-col">
              <span className="text-ink">{EVENT_TEXT[e.kind](e)}</span>
              {e.detail && e.kind !== 'sent' && e.kind !== 'extended' && (
                <span className="italic text-slate">“{e.detail}”</span>
              )}
              <time dateTime={e.at} className="text-xs text-muted">
                {shortTime(e.at)}
              </time>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
