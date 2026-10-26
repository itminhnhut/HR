import {
  NEWS_SUMMARY_MAX,
  NEWS_TITLE_MAX,
  type ArticleHeadingRef,
  type HrNewsPostDto,
  type NewsCategoryDto,
} from '@careers/shared';
import { lazy, Suspense, useCallback, useDeferredValue, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../../../api';
import { useHrNews, useHrNewsPost, useUploadNewsImage } from '../../../api/queries';
import { usePageMeta } from '../../../lib/hooks';
import { ButtonLink } from '../../../ui/Button';
import { FieldError, TextArea, TextField } from '../../../ui/Field';
import { EmptyState, ErrorState, LoadingStatus, Sk } from '../../../ui/feedback';
import { Icon } from '../../../ui/icons';
import { apiMessage } from '../parts';
import { CategoryManager } from './CategoryManager';
import { EditorOutline } from './EditorOutline';
import { ActionBar } from './ActionBar';
import { ActionMessage, previewCard, useEditorActions } from './EditorActions';
import { StatusField } from './EditorStatus';
import { CategoryField, CoverField, GooglePreview, Panel } from './fields';
import { SlugLine } from './SlugLine';
import { TagsField } from './TagsField';
import { draftFrom, renderDraft, shownSlug, toInput, type Draft } from './model';
import { imagesWaitingForAlt } from './saveErrors';
import { NewsStatusBadge } from './parts';
import { LeaveDialog, useLeaveGuard } from './useLeaveGuard';
import { useNewsAutosave } from './useNewsAutosave';

/** The only import of the Lexical editor: its own chunk, loaded when this page opens. */
const ArticleEditor = lazy(() => import('./editor/ArticleEditor'));

const NEW = 'moi';

function EditorSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3 rounded-control border border-field bg-white p-5">
      <Sk w="70%" h={36} />
      <Sk w="100%" h={16} />
      <Sk w="92%" h={16} />
      <Sk w="60%" h={16} />
    </div>
  );
}

/** The form; every change also goes to autosave. */
function useDraft(initial: HrNewsPostDto | null, onChange: (draft: Draft) => void) {
  const [draft, setDraft] = useState(() => draftFrom(initial));
  const latest = useRef(draft);
  const update = useCallback(
    (patch: Partial<Draft>) => {
      const next = { ...latest.current, ...patch };
      latest.current = next;
      setDraft(next);
      onChange(next);
    },
    [onChange],
  );
  return [draft, update] as const;
}

/** Grows with the text (2 rows at least); `field-sizing` where supported, scrollHeight elsewhere. */
function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + 2}px`;
}

/** "Mô tả ngắn": news cards, Zalo/Facebook previews and Google. Empty = the start of the article. */
function SummaryField({ value, error, onChange }: { value: string; error?: string; onChange: (v: string) => void }) {
  return (
    <TextArea
      label="Mô tả ngắn"
      optional
      rows={2}
      value={value}
      maxLength={NEWS_SUMMARY_MAX}
      counter={{ value: value.length, max: NEWS_SUMMARY_MAX }}
      onChange={(e) => {
        autoGrow(e.currentTarget);
        onChange(e.target.value);
      }}
      placeholder="Một hai câu nói bài viết về điều gì."
      hint="Hiện ở danh sách tin, khi chia sẻ Zalo/Facebook và dưới tiêu đề trên Google. Để trống thì lấy đoạn đầu bài."
      error={error}
      className="[&_textarea]:resize-none [&_textarea]:[field-sizing:content] [&_textarea]:min-h-[76px]"
    />
  );
}

interface Fields {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
  errors: Record<string, string>;
}

function MainColumn({
  draft,
  update,
  errors,
  initial,
  slug,
  slugLocked,
}: Fields & { initial: HrNewsPostDto | null; slug: string; slugLocked: boolean }) {
  const upload = useUploadNewsImage();
  const onContent = useCallback((content: unknown) => update({ content }), [update]);
  return (
    // Below xl the two columns melt into one list (display: contents) so "Thông tin bài" can sit above
    // "Nội dung": the fields needed to publish are then seen before the long text.
    <div className="flex min-w-0 flex-1 flex-col gap-5 max-xl:contents">
      <div data-field="title" className="max-xl:order-1">
        <TextField
          label="Tiêu đề"
          value={draft.title}
          maxLength={NEWS_TITLE_MAX}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Ví dụ: Một ngày làm việc của kỹ sư kinh doanh"
          error={errors.title}
          hint="Nên dưới 65 ký tự để Google hiện đủ."
          className="[&_input]:font-serif [&_input]:text-[22px]"
        />
      </div>
      <div className="max-xl:order-2">
        <SlugLine
          shown={slug}
          value={draft.slugTouched ? draft.slug : ''}
          locked={slugLocked}
          onChange={(typed) => update({ slug: typed, slugTouched: typed.trim() !== '' })}
        />
      </div>
      <div data-field="summary" className="max-xl:order-3">
        <SummaryField value={draft.summary} error={errors.summary} onChange={(summary) => update({ summary })} />
      </div>
      <div data-field="content" className="flex flex-col gap-2 max-xl:order-6">
        <span className="text-sm font-medium text-navy">Nội dung</span>
        <Suspense fallback={<EditorSkeleton />}>
          <ArticleEditor
            initialContent={initial?.content ?? null}
            onChange={onContent}
            uploadImage={upload.mutateAsync}
            errorId={errors.content ? 'news-content-error' : undefined}
          />
        </Suspense>
        <FieldError id="news-content-error">{errors.content}</FieldError>
      </div>
    </div>
  );
}

function SideColumn({
  draft,
  update,
  errors,
  categories,
  slug,
  description,
  headings,
  status,
}: Fields & {
  categories: NewsCategoryDto[];
  slug: string;
  description: string;
  headings: ArticleHeadingRef[];
  status: ReactNode;
}) {
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  return (
    <aside className="flex w-full flex-col gap-5 max-xl:contents xl:w-[360px] xl:shrink-0">
      {/* On phones the status picker is in the bar at the bottom. */}
      <div className="max-sm:hidden max-xl:order-4">{status}</div>
      <div className="max-xl:order-5">
        <Panel title="Thông tin bài">
          <div data-field="categoryId">
            <CategoryField
              value={draft.categoryId}
              categories={categories}
              error={errors.categoryId}
              onChange={(categoryId) => update({ categoryId })}
              onManage={() => setCategoriesOpen(true)}
            />
          </div>
          <div data-field="cover">
            <CoverField value={draft.cover} error={errors.cover} onChange={(cover) => update({ cover })} />
          </div>
          <div data-field="tags">
            <TagsField value={draft.tags} error={errors.tags} onChange={(tags) => update({ tags })} />
          </div>
        </Panel>
      </div>
      <div className="max-xl:order-7">
        <EditorOutline headings={headings} />
      </div>
      <div className="max-xl:order-8">
        <Panel title="Hiển thị trên Google">
          <GooglePreview title={draft.title} slug={slug} description={description} />
        </Panel>
      </div>
      <CategoryManager open={categoriesOpen} categories={categories} onClose={() => setCategoriesOpen(false)} />
    </aside>
  );
}

/** Saving, the leave guard and the /moi → /:id swap after the first save. */
function useEditorState(initial: HrNewsPostDto | null, onCreated: (id: string) => void) {
  const navigate = useNavigate();
  const allowedPath = useRef<string | null>(null);
  const created = useCallback(
    (id: string) => {
      allowedPath.current = `/hr/tin-tuc/${id}`;
      onCreated(id);
      navigate(allowedPath.current, { replace: true });
    },
    [onCreated, navigate],
  );
  const autosave = useNewsAutosave(initial, created);
  const { change } = autosave;
  const [draft, update] = useDraft(
    initial,
    useCallback((d: Draft) => change(toInput(d)), [change]),
  );
  const { allowAll: allowLeave, blocker } = useLeaveGuard(autosave.dirty, allowedPath);
  return { autosave, draft, update, allowLeave, blocker };
}

/** Back link, the post's status, and the page heading for screen readers. */
function EditorTop({ post }: { post: HrNewsPostDto | null }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/hr/tin-tuc"
          className="inline-flex items-center gap-2 text-sm text-slate no-underline hover:text-navy"
        >
          <Icon name="arrowLeft" size={16} />
          Tin tức
        </Link>
        <NewsStatusBadge status={post?.status ?? 'draft'} />
      </div>
      <h1 className="sr-only">{post ? 'Sửa bài viết' : 'Viết bài mới'}</h1>
    </>
  );
}

function NewsEditor({
  initial,
  categories,
  onCreated,
}: {
  initial: HrNewsPostDto | null;
  categories: NewsCategoryDto[];
  onCreated: (id: string) => void;
}) {
  const { autosave, draft, update, allowLeave, blocker } = useEditorState(initial, onCreated);
  const actions = useEditorActions({ autosave, draft, allowLeave });
  const deferredContent = useDeferredValue(draft.content);
  const article = useMemo(() => renderDraft(deferredContent), [deferredContent]);
  const imagesWithoutAlt = useMemo(() => imagesWaitingForAlt(deferredContent), [deferredContent]);
  const errors = { ...autosave.fieldErrors, ...actions.fieldErrors };
  const slug = shownSlug(draft, autosave.post);
  const card = previewCard(draft, slug, article, categories, autosave.post?.publishedAt ?? null);
  usePageMeta(draft.title ? `Sửa: ${draft.title}` : 'Viết bài');

  return (
    <>
      <EditorTop post={autosave.post} />
      <ActionMessage message={actions.message} />
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <MainColumn
          draft={draft}
          update={update}
          errors={errors}
          initial={initial}
          slug={slug}
          slugLocked={!!autosave.post?.slugLocked}
        />
        <SideColumn
          draft={draft}
          update={update}
          errors={errors}
          categories={categories}
          slug={slug}
          description={card.summary}
          headings={article?.headings ?? []}
          status={<StatusField autosave={autosave} busy={actions.busy} onChoose={actions.choose} />}
        />
      </div>
      <ActionBar autosave={autosave} actions={actions} preview={{ card, article, imagesWithoutAlt }} />
      <LeaveDialog blocker={blocker} />
    </>
  );
}

/** Loads the post (and categories) once; the editor then keeps its own copy. */
function EditorLoader({ id, onCreated }: { id: string; onCreated: (id: string) => void }) {
  // The id at mount: after the first save of /moi the address changes, the editor must not reload.
  const [loadId] = useState(id === NEW ? null : id);
  const news = useHrNews();
  const post = useHrNewsPost(loadId);
  if (news.isPending || (loadId && post.isPending)) return <LoadingStatus />;
  if (post.error instanceof ApiError && post.error.status === 404) {
    return (
      <EmptyState
        icon="search"
        title="Không tìm thấy bài"
        actions={
          <ButtonLink to="/hr/tin-tuc" icon="newspaper">
            Về danh sách bài
          </ButtonLink>
        }
      >
        Bài có thể đã bị xoá.
      </EmptyState>
    );
  }
  if (news.isError || post.isError) {
    const error = news.error ?? post.error;
    return <ErrorState onRetry={() => (news.isError ? news.refetch() : post.refetch())} message={apiMessage(error)} />;
  }
  return <NewsEditor initial={post.data ?? null} categories={news.data?.categories ?? []} onCreated={onCreated} />;
}

/**
 * /hr/tin-tuc/moi and /hr/tin-tuc/:id. One route, so the first autosave can swap /moi for the new id without
 * remounting the editor; opening another post (or a new one) does start a fresh editor.
 */
export function HrNewsEditPage() {
  const { id = NEW } = useParams();
  const [session, setSession] = useState({ id, n: 0, adopt: null as string | null });
  if (session.id !== id) {
    setSession(id === session.adopt ? { ...session, id } : { id, n: session.n + 1, adopt: null });
  }
  const onCreated = useCallback((newId: string) => setSession((s) => ({ ...s, adopt: newId })), []);
  return <EditorLoader key={session.n} id={id} onCreated={onCreated} />;
}

export default HrNewsEditPage;
