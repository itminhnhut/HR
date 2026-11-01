import { foldVietnamese } from './format.js';

/**
 * "Bài viết liên quan" on a job page: published news posts that talk about the same work, so job pages link
 * into the articles (and Google follows). A simple, deterministic word match; no search engine needed.
 */

export interface RelatedPostCandidate {
  slug: string;
  title: string;
  /** Hashtag names ("Kinh doanh"). */
  tags: string[];
  category: { name: string; slug: string };
  /** ISO timestamp: newer wins a tie. */
  publishedAt: string;
}

export const RELATED_POSTS_MAX = 3;

/** Words every job or careers post has: they say nothing about which job it is (compared without accents). */
const STOPWORDS = new Set(
  (
    'tuyen dung nhan vien cua va tai cho la cac nhung mot voi trong de khi nay duoc nguoi moi ' +
    'viec lam cong ty yeu cau uu tien tu den thi co khong ve o hoac theo sau'
  ).split(' '),
);
/** A post in these categories is about hiring or careers: the fallback when no post matches the job. */
const FALLBACK_CATEGORIES = ['tuyen dung', 'huong nghiep'];
/** One shared syllable ("kế" in "kế toán" and "thiết kế") is chance; two words, or one two-word term, match. */
const MIN_SCORE = 2;

const tokens = (text: string) => foldVietnamese(text).split(/[^a-z0-9]+/);
const meaningful = (word: string) => word.length >= 2 && !STOPWORDS.has(word);

interface Keywords {
  words: Set<string>;
  /** Adjacent meaningful words ("kinh doanh"): a shared term counts more than its syllables. */
  pairs: Set<string>;
}

function keywords(texts: string[]): Keywords {
  const words = new Set<string>();
  const pairs = new Set<string>();
  for (const text of texts) {
    const list = tokens(text);
    list.forEach((word, i) => {
      if (!meaningful(word)) return;
      words.add(word);
      const next = list[i + 1];
      if (next && meaningful(next)) pairs.add(`${word} ${next}`);
    });
  }
  return { words, pairs };
}

const shared = (a: Set<string>, b: Set<string>) => [...a].filter((item) => b.has(item)).length;

const score = (job: Keywords, post: Keywords) => shared(job.words, post.words) + 2 * shared(job.pairs, post.pairs);

const isCareerPost = (post: RelatedPostCandidate) => {
  const name = foldVietnamese(`${post.category.name} ${post.category.slug.replace(/-/g, ' ')}`);
  return FALLBACK_CATEGORIES.some((category) => name.includes(category));
};

const newestFirst = (a: RelatedPostCandidate, b: RelatedPostCandidate) =>
  b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug);

/**
 * Up to three posts for a job: those sharing the most words with the job's title and department (post title
 * and hashtags, accents and case ignored, filler words like "tuyển", "nhân viên" left out), then the newest
 * "Tuyển dụng" / "Hướng nghiệp" posts to fill up. Same input, same answer.
 */
export function pickRelatedPosts<T extends RelatedPostCandidate>(
  job: { title: string; department: string },
  posts: readonly T[],
  max = RELATED_POSTS_MAX,
): T[] {
  const wanted = keywords([job.title, job.department]);
  const ordered = [...posts].sort(newestFirst);
  const scored = ordered
    .map((post) => ({ post, points: score(wanted, keywords([post.title, ...post.tags])) }))
    .filter(({ points }) => points >= MIN_SCORE)
    .sort((a, b) => b.points - a.points || newestFirst(a.post, b.post))
    .map(({ post }) => post);
  const fallback = ordered.filter((post) => isCareerPost(post) && !scored.includes(post));
  return [...scored, ...fallback].slice(0, max);
}
