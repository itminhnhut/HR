import {
  NEWS_IMAGE_MAX_BYTES,
  NEWS_IMAGE_TYPES,
  NEWS_PAGE_SIZE,
  toSlug,
  type NewsListResponse,
  type NewsTagCountDto,
} from '@careers/shared';
import type { MockNewsPost } from './mock-news-seed';
import {
  applyInput,
  categoryDto,
  categoryList,
  categoryNameProblem,
  CHECK_FIELDS,
  checkInput,
  findPost,
  NOT_FOUND,
  published,
  publishProblems,
  relatedPosts,
  rendered,
  sampleFor,
  tagDto,
  tagSuggestions,
  toCard,
  toHrPost,
  toRow,
  touch,
} from './mock-news-model';
import type { MockDb } from './mock-seed';
import { delay, fail, load, requireHr, save } from './mock-store';
import type { Api, NewsListQuery } from './types';

/** Same rules as the BE (spec-news.md): drafts are free-form, publishing needs the essentials. */

type NewsApi = Pick<
  Api,
  | 'listNews'
  | 'getNews'
  | 'hrNews'
  | 'hrNewsPost'
  | 'hrCreateNews'
  | 'hrSaveNews'
  | 'hrPublishNews'
  | 'hrUnpublishNews'
  | 'hrDeleteNews'
  | 'hrNewsTags'
  | 'hrCreateNewsCategory'
  | 'hrRenameNewsCategory'
  | 'hrDeleteNewsCategory'
  | 'hrUploadNewsImage'
>;

const byName = (me: { name: string | null; email: string }) => me.name || me.email;

/** Published posts for a category or hashtag page; null when that category or tag has none (404). */
function filtered(db: MockDb, { category, tag }: NewsListQuery) {
  const cat = category ? db.newsCategories.find((c) => c.slug === category) : null;
  if (category && !cat) return null;
  const posts = published(db).filter(
    (p) => (!cat || p.categoryId === cat.id) && (!tag || p.tags.some((t) => tagDto(t).slug === tag)),
  );
  if (tag && posts.length === 0) return null;
  const tagName = tag ? posts[0]?.tags.find((t) => tagDto(t).slug === tag) : undefined;
  return { posts, cat, tag: tagName ? tagDto(tagName) : null };
}

function listPage(db: MockDb, query: NewsListQuery): NewsListResponse | null {
  const found = filtered(db, query);
  if (!found) return null;
  const pageCount = Math.max(1, Math.ceil(found.posts.length / NEWS_PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page ?? 1), pageCount);
  return {
    posts: found.posts.slice((page - 1) * NEWS_PAGE_SIZE, page * NEWS_PAGE_SIZE).map((p) => toCard(db, p)),
    // Only categories with something to read.
    categories: categoryList(db, true).filter((c) => c.postCount > 0),
    page,
    pageCount,
    category: found.cat ? categoryDto(db, found.cat.id, true) : null,
    tag: found.tag,
    popularTags: popularTags(db),
  };
}

/** Same as the server: hashtags of published posts, most used first, at most 12. */
function popularTags(db: MockDb): NewsTagCountDto[] {
  const counts = new Map<string, NewsTagCountDto>();
  for (const post of published(db)) {
    for (const name of post.tags) {
      const tag = tagDto(name);
      const seen = counts.get(tag.slug);
      counts.set(tag.slug, { ...(seen ?? tag), postCount: (seen?.postCount ?? 0) + 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.postCount - a.postCount || a.name.localeCompare(b.name, 'vi'))
    .slice(0, 12);
}

function newPost(by: string): MockNewsPost {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    ...{ categoryId: null, title: '', slug: '', summary: '', cover: null, content: null, tags: [] },
    slugLocked: false,
    status: 'draft',
    publishedAt: null,
    updatedAt: now,
    updatedBy: by,
    createdAt: now,
  };
}

export const newsMockApi: NewsApi = {
  async listNews(query) {
    const page = listPage(load(), query);
    return page ? delay(page) : fail(404, query.tag ? 'Không tìm thấy hashtag.' : 'Không tìm thấy chuyên mục.');
  },

  async getNews(slug) {
    const db = load();
    const post = published(db).find((p) => p.slug === slug);
    if (!post) return fail(404, NOT_FOUND);
    const { html, headings } = rendered(post);
    const related = relatedPosts(db, post).map((p) => toCard(db, p));
    return delay({ ...toCard(db, post), html, headings, related });
  },

  async hrNews() {
    const db = load();
    requireHr(db);
    const posts = [...db.newsPosts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((p) => toRow(db, p));
    return delay({ posts, categories: categoryList(db, false) });
  },

  async hrNewsPost(id) {
    const db = load();
    requireHr(db);
    const post = findPost(db, id);
    return post ? delay(toHrPost(post)) : fail(404, NOT_FOUND);
  },

  async hrNewsTags(q) {
    const db = load();
    requireHr(db);
    return delay({ tags: tagSuggestions(db, q) });
  },

  async hrCreateNews(raw) {
    const db = load();
    const me = requireHr(db);
    const checked = checkInput(db, raw);
    if (!checked.ok) return fail(422, CHECK_FIELDS, checked.errors);
    const post = newPost(byName(me));
    applyInput(db, post, checked.input);
    db.newsPosts.unshift(post);
    save();
    return delay(toHrPost(post));
  },

  async hrSaveNews(id, raw) {
    const db = load();
    const me = requireHr(db);
    const post = findPost(db, id);
    if (!post) return fail(404, NOT_FOUND);
    const checked = checkInput(db, raw);
    if (!checked.ok) return fail(422, CHECK_FIELDS, checked.errors);
    // A live post must stay complete: saving is publishing the change.
    if (post.status === 'published') {
      const problems = publishProblems({ ...post, ...checked.input });
      if (Object.keys(problems).length) return fail(422, `Bài đang đăng nên chưa lưu được. ${CHECK_FIELDS}`, problems);
    }
    applyInput(db, post, checked.input);
    touch(post, byName(me));
    save();
    return delay(toHrPost(post));
  },

  /** From draft or hidden. A post shown again keeps its first publish date. */
  async hrPublishNews(id) {
    const db = load();
    const me = requireHr(db);
    const post = findPost(db, id);
    if (!post) return fail(404, NOT_FOUND);
    const problems = publishProblems(post);
    if (Object.keys(problems).length) return fail(422, `Chưa đăng được. ${CHECK_FIELDS}`, problems);
    post.status = 'published';
    post.slugLocked = true;
    post.publishedAt ??= new Date().toISOString();
    touch(post, byName(me));
    save();
    return delay(toHrPost(post));
  },

  /** Published → hidden: off the site, same address. */
  async hrUnpublishNews(id) {
    const db = load();
    const me = requireHr(db);
    const post = findPost(db, id);
    if (!post) return fail(404, NOT_FOUND);
    // Same as the server: a draft was never published (422); hiding a hidden post changes nothing.
    if (post.status === 'draft') return fail(422, 'Bản nháp chưa đăng nên không cần ẩn.');
    if (post.status === 'hidden') return delay(toHrPost(post));
    post.status = 'hidden';
    touch(post, byName(me));
    save();
    return delay(toHrPost(post));
  },

  async hrDeleteNews(id) {
    const db = load();
    requireHr(db);
    if (!findPost(db, id)) return fail(404, NOT_FOUND);
    db.newsPosts = db.newsPosts.filter((p) => p.id !== id);
    save();
    return delay({ ok: true as const });
  },

  async hrCreateNewsCategory(name) {
    const db = load();
    requireHr(db);
    const problem = categoryNameProblem(db, name, null);
    if (problem) return fail(422, problem, { name: problem });
    const clean = name.trim();
    const id = crypto.randomUUID();
    db.newsCategories.push({ id, name: clean, slug: toSlug(clean, 'chuyen-muc'), createdAt: new Date().toISOString() });
    save();
    return delay(categoryDto(db, id, false));
  },

  async hrRenameNewsCategory(id, name) {
    const db = load();
    requireHr(db);
    const cat = db.newsCategories.find((c) => c.id === id);
    if (!cat) return fail(404, 'Không tìm thấy chuyên mục.');
    const problem = categoryNameProblem(db, name, id);
    if (problem) return fail(422, problem, { name: problem });
    // The slug stays: category links already shared or indexed keep working.
    cat.name = name.trim();
    save();
    return delay(categoryDto(db, id, false));
  },

  async hrDeleteNewsCategory(id) {
    const db = load();
    requireHr(db);
    if (!db.newsCategories.some((c) => c.id === id)) return fail(404, 'Không tìm thấy chuyên mục.');
    const count = db.newsPosts.filter((p) => p.categoryId === id).length;
    if (count > 0) {
      return fail(409, `Chuyên mục còn ${count} bài. Chuyển các bài sang chuyên mục khác rồi xoá.`);
    }
    db.newsCategories = db.newsCategories.filter((c) => c.id !== id);
    save();
    return delay({ ok: true as const });
  },

  async hrUploadNewsImage(file) {
    const db = load();
    requireHr(db);
    if (!(NEWS_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      return fail(422, 'Chỉ nhận ảnh JPEG, PNG hoặc WebP.', { file: 'Chỉ nhận ảnh JPEG, PNG hoặc WebP.' });
    }
    if (file.size > NEWS_IMAGE_MAX_BYTES) {
      const mb = NEWS_IMAGE_MAX_BYTES / 1024 / 1024;
      return fail(422, `Ảnh lớn hơn ${mb} MB, nén lại rồi tải lên.`, { file: `Ảnh lớn hơn ${mb} MB.` });
    }
    return delay(sampleFor(file));
  },
};
