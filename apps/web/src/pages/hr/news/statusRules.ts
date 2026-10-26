import { NEWS_STATUS_LABEL, type NewsStatus } from '@careers/shared';

/**
 * The "Trạng thái" picker (editor and HR list): which statuses HR may pick, and what each means.
 * A draft has never been published; once published a post can be shown or hidden, never a draft again
 * (its address is locked and may already be shared).
 */

export interface StatusOption {
  status: NewsStatus;
  label: string;
  hint: string;
  /** Shown but not choosable, with `note` saying why. */
  disabled?: boolean;
  note?: string;
}

const HINTS: Record<NewsStatus, string> = {
  draft: 'Chỉ HR thấy',
  published: 'Hiện trên trang và Google',
  hidden: 'Gỡ khỏi trang, giữ đường dẫn',
};

export const NO_BACK_TO_DRAFT = 'Bài đã từng đăng nên không về nháp được – chọn Đã ẩn để gỡ khỏi trang';

const option = (status: NewsStatus): StatusOption => ({
  status,
  label: NEWS_STATUS_LABEL[status],
  hint: HINTS[status],
});

/** Never published: Nháp, Đã đăng. Published before: Nháp (disabled, with why), Đã đăng, Đã ẩn. */
export function statusOptions(everPublished: boolean): StatusOption[] {
  if (!everPublished) return [option('draft'), option('published')];
  return [{ ...option('draft'), disabled: true, note: NO_BACK_TO_DRAFT }, option('published'), option('hidden')];
}

/** A published or hidden post, or one with a publish date, has been published. */
export const wasPublished = (post: { status: NewsStatus; publishedAt: string | null } | null): boolean =>
  !!post && (post.status !== 'draft' || post.publishedAt !== null);

/** What a status change does: publish (also "show again"), hide, or nothing. */
export function transitionFor(from: NewsStatus, to: NewsStatus): 'publish' | 'hide' | null {
  if (from === to || to === 'draft') return null;
  return to === 'published' ? 'publish' : 'hide';
}

/** The form fields the API names in its errors, in the order they appear on the page. */
export const FIELD_LABELS: [key: string, label: string][] = [
  ['title', 'Tiêu đề'],
  ['categoryId', 'Chuyên mục'],
  ['cover', 'Ảnh bìa'],
  ['summary', 'Mô tả ngắn'],
  ['content', 'Nội dung'],
  ['tags', 'Hashtag'],
];

/** "Chuyên mục · Ảnh bìa": the fields with an error, in page order. */
export function missingFields(errors: Record<string, string>): { key: string; label: string }[] {
  return FIELD_LABELS.filter(([key]) => errors[key]).map(([key, label]) => ({ key, label }));
}
