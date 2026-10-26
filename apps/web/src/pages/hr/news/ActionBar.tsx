import type { NewsCardDto, NewsStatus, RenderedArticle } from '@careers/shared';
import { useEffect, useState } from 'react';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/icons';
import type { EditorActions } from './EditorActions';
import { HideConfirm, jumpToField, MissingFields, StatusField } from './EditorStatus';
import { NewsPreviewDialog } from './NewsPreviewDialog';
import { ConfirmDialog, formatClock } from './parts';
import { PublishDialog } from './PublishDialog';
import type { Autosave } from './useNewsAutosave';

/** A published post: nothing reaches the page until "Cập nhật bài". */
const LIVE_IDLE = 'Đang hiển thị trên trang – thay đổi chỉ lên trang khi bấm Cập nhật bài';

function saveText(autosave: Autosave): string {
  const { state, manual } = autosave;
  if (state.kind === 'error') {
    return state.message.startsWith('Chưa lưu được') ? state.message : `Chưa lưu được: ${state.message}`;
  }
  if (manual) {
    if (state.kind === 'pending') return 'Có thay đổi chưa cập nhật';
    if (state.kind === 'saving') return 'Đang cập nhật…';
    return state.kind === 'saved' ? `Đã cập nhật lúc ${formatClock(state.at)}. ${LIVE_IDLE}` : LIVE_IDLE;
  }
  if (state.kind === 'pending') return 'Có thay đổi chưa lưu';
  if (state.kind === 'saving') return 'Đang lưu…';
  if (state.kind === 'saved') return `Đã lưu lúc ${formatClock(state.at)}`;
  return autosave.post ? 'Chưa có thay đổi' : 'Gõ tiêu đề hoặc nội dung, bài sẽ tự lưu nháp';
}

function SaveStatus({ autosave }: { autosave: Autosave }) {
  const { state } = autosave;
  const failed = state.kind === 'error';
  return (
    <span
      role="status"
      className={`flex min-w-0 flex-1 items-center gap-2 text-xs sm:text-sm ${failed ? 'text-error' : 'text-slate'}`}
    >
      {failed && <Icon name="alert" size={16} className="shrink-0" />}
      <span className="line-clamp-2 min-w-0">{saveText(autosave)}</span>
      {failed && (
        <button
          type="button"
          onClick={() => void autosave.flush()}
          className="shrink-0 border-0 bg-transparent p-0 text-sm font-medium text-link underline"
        >
          Thử lại
        </button>
      )}
    </span>
  );
}

/** The footer's main button follows the post: a draft is published, a hidden post shown again. */
export const publishLabel = (status: NewsStatus): string => (status === 'hidden' ? 'Hiện lại' : 'Đăng bài');

/**
 * "Đăng bài" (draft) and "Hiện lại" (hidden) open the confirm sheet; "Cập nhật bài" (published) sends the
 * waiting changes to the live page and is off while there are none.
 */
function PrimaryAction({
  autosave,
  actions,
  imagesWithoutAlt,
}: {
  autosave: Autosave;
  actions: EditorActions;
  imagesWithoutAlt: number;
}) {
  const status = autosave.post?.status ?? 'draft';
  if (status === 'published') {
    // A live post shows every picture: the update waits for their descriptions.
    const blocked = autosave.state.kind === 'saving' || imagesWithoutAlt > 0;
    return (
      <Button size="sm" icon="check" onClick={() => void autosave.flush()} disabled={!autosave.dirty || blocked}>
        Cập nhật bài
      </Button>
    );
  }
  return (
    <Button size="sm" icon="send" onClick={actions.askPublish} disabled={actions.busy}>
      {publishLabel(status)}
    </Button>
  );
}

/** Set apart on the left, in the error colour, so it is not pressed instead of the main button. */
function DeletePost({ actions, isPublished }: { actions: EditorActions; isPublished: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        icon="trash"
        onClick={() => setOpen(true)}
        disabled={actions.busy}
        aria-label="Xoá bài"
        className="text-error hover:bg-error-soft"
      >
        <span className="max-sm:sr-only">Xoá</span>
      </Button>
      <ConfirmDialog
        open={open}
        title="Xoá bài viết?"
        confirmLabel="Xoá bài"
        busy={actions.busy}
        onConfirm={() => {
          setOpen(false);
          void actions.deletePost();
        }}
        onClose={() => setOpen(false)}
      >
        Bài sẽ bị xoá hẳn{isPublished ? ' và gỡ khỏi trang tin tức' : ''}. Không khôi phục được.
      </ConfirmDialog>
    </>
  );
}

/** True on a phone while the caret is in the article text (the keyboard is up): the bar steps aside. */
function useWritingOnPhone(): boolean {
  const [writing, setWriting] = useState(false);
  useEffect(() => {
    const phone = window.matchMedia?.('(max-width: 639px)');
    const check = () => setWriting(!!phone?.matches && !!document.activeElement?.closest('[data-lexical-editor]'));
    document.addEventListener('focusin', check);
    document.addEventListener('focusout', check);
    return () => {
      document.removeEventListener('focusin', check);
      document.removeEventListener('focusout', check);
    };
  }, []);
  return writing;
}

interface ActionBarProps {
  autosave: Autosave;
  actions: EditorActions;
  /** `imagesWithoutAlt`: pictures in the article still waiting for a description. */
  preview: { card: NewsCardDto; article: RenderedArticle | null; imagesWithoutAlt: number };
}

/** "2 ảnh cần mô tả": publishing (and updating a live post) waits for them. */
function ImageAltWarning({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <p role="alert" className="m-0 flex w-full flex-wrap items-center gap-x-1.5 text-sm text-error">
      <Icon name="alert" size={16} className="shrink-0" />
      <span>{count} ảnh trong bài cần mô tả (alt) trước khi đăng. Bấm vào ảnh có dòng “Cần mô tả ảnh” để thêm.</span>
      <button
        type="button"
        onClick={() => jumpToField('content')}
        className="min-h-8 border-0 bg-transparent p-0 text-sm font-medium text-error underline underline-offset-2"
      >
        Xem bài
      </button>
    </p>
  );
}

/** The sheets the bar opens: preview, publish (with its checklist) and hide. */
function BarDialogs({
  autosave,
  actions,
  preview,
  previewOpen,
  closePreview,
}: ActionBarProps & {
  previewOpen: boolean;
  closePreview: () => void;
}) {
  return (
    <>
      <NewsPreviewDialog open={previewOpen} card={preview.card} article={preview.article} onClose={closePreview} />
      <PublishDialog
        open={actions.confirmPublish}
        confirmLabel={publishLabel(autosave.post?.status ?? 'draft')}
        card={preview.card}
        article={preview.article}
        imagesWithoutAlt={preview.imagesWithoutAlt}
        busy={actions.busy}
        onConfirm={actions.publish}
        onClose={actions.closePublish}
      />
      <HideConfirm
        open={actions.confirmHide}
        busy={actions.busy}
        onConfirm={actions.hide}
        onClose={actions.closeHide}
      />
    </>
  );
}

/**
 * Status, save state and actions, stuck to the bottom: "Xoá" on its own, then "Xem trước" and the main
 * button. On phones one compact row (status picker inline), hidden while HR writes in the article so the
 * keyboard leaves room to type.
 */
export function ActionBar({ autosave, actions, preview }: ActionBarProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const writing = useWritingOnPhone();
  const isPublished = autosave.post?.status === 'published';
  return (
    <div
      className={`sticky bottom-0 z-10 -mx-4 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line bg-white/95 px-3 py-2 backdrop-blur transition-transform sm:-mx-6 sm:gap-x-4 sm:gap-y-2 sm:px-6 sm:py-3 lg:-mx-10 lg:px-10 ${writing ? 'pointer-events-none translate-y-full' : ''}`}
    >
      <MissingFields errors={actions.fieldErrors} />
      <ImageAltWarning count={preview.imagesWithoutAlt} />
      <div className="sm:hidden">
        <StatusField autosave={autosave} busy={actions.busy} onChoose={actions.choose} variant="badge" />
      </div>
      <SaveStatus autosave={autosave} />
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <DeletePost actions={actions} isPublished={isPublished} />
        <span aria-hidden="true" className="mx-1 h-7 w-px bg-line sm:mx-2" />
        <Button variant="outline" size="sm" icon="eye" onClick={() => setPreviewOpen(true)} aria-label="Xem trước">
          <span className="max-sm:hidden">Xem trước</span>
          <span className="sm:hidden">Xem</span>
        </Button>
        <PrimaryAction autosave={autosave} actions={actions} imagesWithoutAlt={preview.imagesWithoutAlt} />
      </div>
      <BarDialogs
        autosave={autosave}
        actions={actions}
        preview={preview}
        previewOpen={previewOpen}
        closePreview={() => setPreviewOpen(false)}
      />
    </div>
  );
}
