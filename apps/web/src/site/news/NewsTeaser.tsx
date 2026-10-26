import { newsCategoryPath } from '@careers/shared';
import { useNewsList } from '../../api/queries';
import { SITE } from '../../lib/site';
import { Band } from '../Band';
import { SectionHeading, TextLink } from '../SectionHeading';
import { NewsCard } from './NewsCard';
import { NEWS_GRID } from './NewsListParts';

/** The company-life category; if it is renamed or empty, the teaser shows the latest posts instead. */
const LIFE_SLUG = 'doi-song-top-flow';
const COUNT = 3;

/**
 * "Đời sống TOP FLOW": the three newest posts of company life, under the jobs (home) and on the About page.
 * A full-width stripe on the soft brand tint: the warm part of the page.
 */
export function NewsTeaser({ className = '' }: { className?: string }) {
  const life = useNewsList({ page: 1, category: LIFE_SLUG });
  const latest = useNewsList({ page: 1 });
  if (life.isPending) return null;
  const lifePosts = life.data?.posts ?? [];
  const isLife = lifePosts.length >= COUNT;
  const posts = (isLife ? lifePosts : (latest.data?.posts ?? [])).slice(0, COUNT);
  if (posts.length === 0) return null;
  return (
    <Band tone="white">
      <section aria-labelledby="news-teaser" className={`flex flex-col gap-5 ${className}`}>
        <SectionHeading id="news-teaser" title={isLife ? `Đời sống ${SITE.company}` : 'Tin tức mới'}>
          <TextLink to={isLife ? newsCategoryPath(LIFE_SLUG) : '/tin-tuc'}>Xem tất cả bài viết</TextLink>
        </SectionHeading>
        <div className={`stagger ${NEWS_GRID}`}>
          {posts.map((post) => (
            <NewsCard key={post.slug} post={post} heading="h3" />
          ))}
        </div>
      </section>
    </Band>
  );
}
