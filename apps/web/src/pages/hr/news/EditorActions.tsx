import {
  newsPath,
  toSlug,
  type NewsStatus,
  type NewsCardDto,
  type NewsCategoryDto,
  type RenderedArticle,
} from '@careers/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '../../../api';
import { useDeleteNews, useNewsAction } from '../../../api/queries';
import { Notice } from '../../../ui/feedback';
import { errorMessage } from '../parts';
import { descriptionFor, minutesFor, toInput, type Draft } from './model';
import { jumpToField } from './EditorStatus';
import { missingFields, transitionFor } from './statusRules';
import type { Autosave } from './useNewsAutosave';

interface Message {
  tone: 'ok' | 'error';
  text: string;
  /** Public page, after publishing. */
  link?: string;
}

function doneMessage(kind: 'publish' | 'unpublish', wasHidden: boolean, slug: string): Message {
  if (kind === 'unpublish') {
    return { tone: 'ok', text: 'Đã ẩn bài. Bài không còn trên trang và Google; đường dẫn được giữ để hiện lại sau.' };
  }
  const text = wasHidden
    ? 'Đã hiện lại. Bài đang hiện trên trang tin tức.'
    : 'Đã đăng. Bài đang hiện trên trang tin tức.';
  return { tone: 'ok', text, link: newsPath(slug) };
}

const NOT_SAVED: Message = {
  tone: 'error',
  text: 'Bài chưa lưu được nên chưa thực hiện. Sửa các ô được đánh dấu rồi thử lại.',
};

function useDeletePost(autosave: Autosave, allowLeave: () => void, onError: (m: Message) => void) {
  const navigate = useNavigate();
  const remove = useDeleteNews();
  const deletePost = async () => {
    try {
      if (autosave.post) await remove.mutateAsync(autosave.post.id);
      allowLeave();
      navigate('/hr/tin-tuc', { state: { notice: 'Đã xoá bài.' } });
    } catch (error) {
      onError({ tone: 'error', text: errorMessage(error) });
    }
  };
  return { deletePost, deleting: remove.isPending };
}

/** Publish, take down, delete; with the messages and field errors they bring back. */
export function useEditorActions({
  autosave,
  draft,
  allowLeave,
}: {
  autosave: Autosave;
  draft: Draft;
  allowLeave: () => void;
}) {
  const action = useNewsAction();
  const [message, setMessage] = useState<Message | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { deletePost, deleting } = useDeletePost(autosave, allowLeave, setMessage);

  const [confirmHide, setConfirmHide] = useState(false);
  // Publishing (or showing again) always passes the confirm sheet with its checklist first.
  const [confirmPublish, setConfirmPublish] = useState(false);

  const run = async (kind: 'publish' | 'unpublish') => {
    setMessage(null);
    setFieldErrors({});
    // A new post that was never typed in still needs to exist before it can be published.
    if (!autosave.post) autosave.change(toInput(draft));
    const saved = await autosave.flush();
    if (!saved) return setMessage(NOT_SAVED);
    try {
      const post = await action.mutateAsync({ id: saved.id, action: kind });
      autosave.setPost(post);
      setMessage(doneMessage(kind, saved.status === 'hidden', post.slug));
    } catch (error) {
      const errors = error instanceof ApiError ? error.fieldErrors : {};
      setFieldErrors(errors);
      setMessage({ tone: 'error', text: errorMessage(error) });
      // On a phone the message is far from the fields: go to the first one to fix.
      const first = missingFields(errors)[0];
      if (first) window.requestAnimationFrame(() => jumpToField(first.key));
    }
  };

  /** The status picker: Đã đăng (publish or show again) and Đã ẩn both ask first. */
  const choose = (next: NewsStatus) => {
    const transition = transitionFor(autosave.post?.status ?? 'draft', next);
    if (transition === 'publish') setConfirmPublish(true);
    if (transition === 'hide') setConfirmHide(true);
  };

  return {
    message,
    fieldErrors,
    busy: action.isPending || deleting,
    choose,
    confirmHide,
    closeHide: () => setConfirmHide(false),
    hide: () => {
      setConfirmHide(false);
      void run('unpublish');
    },
    confirmPublish,
    askPublish: () => setConfirmPublish(true),
    closePublish: () => setConfirmPublish(false),
    publish: () => {
      setConfirmPublish(false);
      void run('publish');
    },
    deletePost,
  };
}

export type EditorActions = ReturnType<typeof useEditorActions>;

export function ActionMessage({ message }: { message: Message | null }) {
  if (!message) return null;
  return (
    <Notice tone={message.tone} icon={message.tone === 'ok' ? 'check' : 'alert'}>
      <span role={message.tone === 'ok' ? 'status' : 'alert'}>
        {message.text}
        {message.link && (
          <>
            {' '}
            <a href={message.link} target="_blank" rel="noopener" className="font-medium text-ok underline">
              Xem trên trang
            </a>
          </>
        )}
      </span>
    </Notice>
  );
}

/** The card the preview and Google snippet show, from the unsaved form. */
export function previewCard(
  draft: Draft,
  slug: string,
  article: RenderedArticle | null,
  categories: NewsCategoryDto[],
  publishedAt: string | null,
): NewsCardDto {
  const category = categories.find((c) => c.id === draft.categoryId);
  const now = new Date().toISOString();
  return {
    slug,
    title: draft.title.trim(),
    summary: descriptionFor(draft.summary, article),
    cover: draft.cover,
    category: { name: category?.name ?? '', slug: category?.slug ?? '' },
    tags: draft.tags.map((name) => ({ name, slug: toSlug(name, '') })),
    publishedAt: publishedAt ?? now,
    updatedAt: now,
    readingMinutes: minutesFor(article),
  };
}
