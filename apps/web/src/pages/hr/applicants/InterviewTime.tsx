import { toggleClass } from '../shadcn/toggle';
import type { ApplicationDetailDto } from '@careers/shared';
import { useState } from 'react';
import type { ApplicationPatch } from '../../../api';
import { useUpdateApplication } from '../../../api/queries';
import { Icon } from '../../../ui/icons';
import { errorMessage } from '../parts';
import { hrCalendarUrl } from './ComposeMessage';
import { InterviewField } from './InterviewField';

/** Keyed by the saved link, so a link saved elsewhere (e.g. the compose dialog) shows up here at once. */
function MeetLinkInput({ saved, onSave }: { saved: string; onSave: (value: string) => void }) {
  const [value, setValue] = useState(saved);
  return (
    <input
      type="url"
      inputMode="url"
      aria-label="Link Meet"
      placeholder="Dán link Meet: https://meet.google.com/…"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value.trim() !== saved && onSave(value.trim())}
      className="field-focus min-h-11 rounded-control border border-field bg-white px-3.5 text-sm text-navy outline-none"
    />
  );
}

function ModeButtons({
  mode,
  disabled,
  onChange,
}: {
  mode: 'onsite' | 'online';
  disabled: boolean;
  onChange: (mode: 'onsite' | 'online') => void;
}) {
  return (
    <div role="group" aria-label="Hình thức phỏng vấn" className="flex gap-2">
      {(['onsite', 'online'] as const).map((item) => {
        const on = mode === item;
        return (
          <button
            key={item}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => !on && onChange(item)}
            className={toggleClass(on)}
          >
            {item === 'onsite' ? 'Trực tiếp' : 'Online (Meet)'}
          </button>
        );
      })}
    </div>
  );
}

/** Interview time, onsite/online, and for online the Meet link (made by HR in Google Calendar). */
export function InterviewTime({ app, onError }: { app: ApplicationDetailDto; onError: (msg: string) => void }) {
  const update = useUpdateApplication();
  const patch = (p: ApplicationPatch) =>
    update.mutate({ id: app.id, patch: p }, { onError: (e) => onError(errorMessage(e)) });
  const online = app.interviewMode === 'online';
  const calendar = hrCalendarUrl(app);
  return (
    <div className="flex flex-col gap-3">
      <InterviewField
        value={app.interviewAt}
        disabled={update.isPending}
        onChange={(interviewAt) => patch({ interviewAt })}
      />
      <ModeButtons
        mode={app.interviewMode ?? 'onsite'}
        disabled={update.isPending}
        onChange={(interviewMode) => patch({ interviewMode })}
      />
      {calendar && (
        <div className="flex flex-col gap-1 rounded-control border border-line px-4 py-3">
          <a
            href={calendar}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium"
          >
            <Icon name="calendar" size={16} />
            Tạo lịch Google (mời ứng viên)
          </a>
          <span className="text-xs text-muted">
            Lưu sự kiện là Google gửi lời mời lịch cho ứng viên.
            {online ? ' Bấm "Thêm hội nghị truyền hình Google Meet" trước khi lưu, rồi dán link Meet bên dưới.' : ''}
          </span>
        </div>
      )}
      {online && (
        <MeetLinkInput
          key={app.meetingUrl ?? ''}
          saved={app.meetingUrl ?? ''}
          onSave={(v) => patch({ meetingUrl: v })}
        />
      )}
    </div>
  );
}
