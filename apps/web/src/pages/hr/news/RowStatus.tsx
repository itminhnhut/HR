import type { HrNewsRowDto, NewsStatus } from '@careers/shared';
import { useState } from 'react';
import { ApiError } from '../../../api';
import { useNewsAction } from '../../../api/queries';
import { errorMessage } from '../parts';
import { HideConfirm } from './EditorStatus';
import { StatusMenu } from './StatusMenu';
import { missingFields, transitionFor, wasPublished } from './statusRules';

/** What the list says after a status change from a row. */
export interface RowNotice {
  tone: 'ok' | 'error';
  text: string;
  /** "Mở bài để bổ sung": the editor of that post. */
  editLink?: string;
}

const named = (row: HrNewsRowDto) => `"${row.title || 'Chưa có tiêu đề'}"`;

/** A refused publish: which fields are missing, with a way to the editor. */
function refusal(row: HrNewsRowDto, error: unknown): RowNotice {
  const fields = error instanceof ApiError ? missingFields(error.fieldErrors) : [];
  if (fields.length === 0) return { tone: 'error', text: errorMessage(error) };
  const list = fields.map((f) => f.label.toLowerCase()).join(', ');
  return {
    tone: 'error',
    text: `Bài ${named(row)} còn thiếu ${list}, mở bài để bổ sung.`,
    editLink: `/hr/tin-tuc/${row.id}`,
  };
}

/** The status picker of one row in the HR list: same rules as the editor (statusRules). */
export function RowStatus({ row, onNotice }: { row: HrNewsRowDto; onNotice: (notice: RowNotice | null) => void }) {
  const action = useNewsAction();
  const [confirmHide, setConfirmHide] = useState(false);
  const run = (kind: 'publish' | 'unpublish') => {
    onNotice(null);
    action.mutate(
      { id: row.id, action: kind },
      {
        onSuccess: () =>
          onNotice({
            tone: 'ok',
            text: kind === 'publish' ? `Đã đăng bài ${named(row)}.` : `Đã ẩn bài ${named(row)}.`,
          }),
        onError: (error) =>
          onNotice(kind === 'publish' ? refusal(row, error) : { tone: 'error', text: errorMessage(error) }),
      },
    );
  };
  const choose = (next: NewsStatus) => {
    const transition = transitionFor(row.status, next);
    if (transition === 'publish') run('publish');
    if (transition === 'hide') setConfirmHide(true);
  };
  return (
    <>
      <StatusMenu
        status={row.status}
        everPublished={wasPublished(row)}
        busy={action.isPending}
        onChoose={choose}
        postTitle={row.title}
      />
      <HideConfirm
        open={confirmHide}
        busy={action.isPending}
        onConfirm={() => {
          setConfirmHide(false);
          run('unpublish');
        }}
        onClose={() => setConfirmHide(false)}
      />
    </>
  );
}
