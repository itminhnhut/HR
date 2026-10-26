import type { HrNewsPostDto, NewsPostInput } from '@careers/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../api';
import { useSaveNews } from '../../../api/queries';
import { hasTitleOrBody } from './model';
import { saveErrorMessage } from './saveErrors';

/** How long typing must pause before a save (spec-news.md: ~1.5 s). */
export const AUTOSAVE_MS = 1500;

export type SaveState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: Date }
  | { kind: 'error'; message: string };

export interface Autosave {
  /** The post as the server last returned it (null until the first save of a new post). */
  post: HrNewsPostDto | null;
  setPost: (post: HrNewsPostDto) => void;
  state: SaveState;
  /** Field messages from the last refused save (422). */
  fieldErrors: Record<string, string>;
  /** True while something typed is not saved yet. */
  dirty: boolean;
  /**
   * Published posts are not saved while HR types (half-written edits would go live): changes wait for
   * "Cập nhật bài" (`flush`). Drafts and hidden posts save by themselves.
   */
  manual: boolean;
  /** Call on every change with the whole form; saves after a pause (unless `manual`). */
  change: (input: NewsPostInput) => void;
  /** Saves now (before publishing or leaving). Resolves to the saved post, or null when saving failed. */
  flush: () => Promise<HrNewsPostDto | null>;
}

/** One save of the latest form: tracks versions so a save never marks newer typing as saved. */
function useSaveOnce(initial: HrNewsPostDto | null, onCreated: (id: string) => void) {
  const save = useSaveNews();
  const [post, setPostState] = useState(initial);
  const [state, setState] = useState<SaveState>({ kind: 'idle' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const postRef = useRef(initial);
  const input = useRef<NewsPostInput | null>(null);
  const version = useRef(0);
  const savedVersion = useRef(0);
  const latest = useRef({ mutate: save.mutateAsync, onCreated });
  latest.current = { mutate: save.mutateAsync, onCreated };

  const setPost = useCallback((next: HrNewsPostDto) => {
    postRef.current = next;
    setPostState(next);
  }, []);

  const saveOnce = useCallback(async (): Promise<HrNewsPostDto | null> => {
    const v = version.current;
    const body = input.current;
    if (!body || v === savedVersion.current) return postRef.current;
    const wasNew = !postRef.current;
    // Nothing worth a draft yet (no title, no text): nothing is created on the server.
    if (wasNew && !hasTitleOrBody(body)) return null;
    setState({ kind: 'saving' });
    try {
      const saved = await latest.current.mutate({ id: postRef.current?.id ?? null, input: body });
      savedVersion.current = v;
      setPost(saved);
      setFieldErrors({});
      if (wasNew) latest.current.onCreated(saved.id);
      setState(version.current === v ? { kind: 'saved', at: new Date() } : { kind: 'pending' });
      return saved;
    } catch (error) {
      setFieldErrors(error instanceof ApiError ? error.fieldErrors : {});
      setState({ kind: 'error', message: saveErrorMessage(error) });
      return null;
    }
  }, [setPost]);

  const unsaved = () => version.current !== savedVersion.current;
  const isLive = () => postRef.current?.status === 'published';
  /** A new post with no title and no text yet: there is nothing to save, so nothing is "unsaved" either. */
  const isEmptyNew = (next: NewsPostInput) => !postRef.current && !hasTitleOrBody(next);
  const markClean = () => {
    savedVersion.current = version.current;
  };
  return {
    post,
    setPost,
    state,
    setState,
    fieldErrors,
    saveOnce,
    input,
    version,
    unsaved,
    isLive,
    isEmptyNew,
    markClean,
  };
}

/**
 * Autosave for the news editor: the first save of /moi creates the post (onCreated), later ones update it.
 * Saves never overlap: changes made while one runs are saved right after it.
 */
export function useNewsAutosave(initial: HrNewsPostDto | null, onCreated: (id: string) => void): Autosave {
  const {
    post,
    setPost,
    state,
    setState,
    fieldErrors,
    saveOnce,
    input,
    version,
    unsaved,
    isLive,
    isEmptyNew,
    markClean,
  } = useSaveOnce(initial, onCreated);
  const running = useRef<Promise<HrNewsPostDto | null> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stillUnsaved = useRef(unsaved);
  stillUnsaved.current = unsaved;

  const flush = useCallback(async (): Promise<HrNewsPostDto | null> => {
    clearTimeout(timer.current);
    while (running.current) await running.current;
    running.current = saveOnce().finally(() => {
      running.current = null;
    });
    const saved = await running.current;
    // Typed while saving: save that too, after the usual pause (a live post waits for "Cập nhật bài").
    if (saved && stillUnsaved.current() && !isLive()) timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
    return saved;
  }, [saveOnce, isLive]);

  const change = useCallback(
    (next: NewsPostInput) => {
      input.current = next;
      version.current += 1;
      clearTimeout(timer.current);
      if (isEmptyNew(next)) {
        markClean();
        setState((s) => (s.kind === 'saving' ? s : { kind: 'idle' }));
        return;
      }
      setState((s) => (s.kind === 'saving' ? s : { kind: 'pending' }));
      if (!isLive()) timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
    },
    [flush, input, version, setState, isLive, isEmptyNew, markClean],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  const dirty = state.kind === 'pending' || state.kind === 'saving' || state.kind === 'error';
  return { post, setPost, state, fieldErrors, dirty, manual: post?.status === 'published', change, flush };
}
