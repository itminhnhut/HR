import { NEWS_IMAGE_SIZES, newsCategoryPath, type NewsCardDto, type NewsPostDto } from '@careers/shared';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { ApiError } from '../../api';
import { useJobs, useNewsList, useNewsPost } from '../../api/queries';
import { newsCategoryClasses } from '../../lib/colors';
import { usePageMeta } from '../../lib/hooks';
import { newsUrl } from '../../lib/site';
import { ArticleBody, ArticleMetaLine } from '../../site/news/ArticleBody';
import { Contents } from '../../site/news/Contents';
import { NewsCard } from '../../site/news/NewsCard';
import { NewsImage } from '../../site/news/NewsImage';
import { NEWS_GRID, PopularTags } from '../../site/news/NewsListParts';
import { ShareButtons } from '../../site/news/ShareButtons';
import { TagChips } from '../../site/news/TagChips';
import { useArticleMeta } from '../../site/news/useArticleMeta';
import { NotFoundView } from '../../site/NotFoundView';
import { PAGE_WIDTH, PageHero, PageHeroSkeleton } from '../../site/PageHero';
import { SectionHeading } from '../../site/SectionHeading';
import { ButtonLink } from '../../ui/Button';
import { ErrorState, LoadingStatus, Sk } from '../../ui/feedback';
import { SimilarJobs } from '../job/JobAside';

function OpenJobs() {
  const jobs = useJobs();
  return <SimilarJobs jobs={jobs.data?.jobs.slice(0, 3) ?? []} title="Vị trí đang tuyển" />;
}

function Related({ posts }: { posts: NewsCardDto[] }) {
  if (posts.length === 0) return null;
  return (
    <section aria-labelledby="related" className="flex flex-col gap-5">
      <SectionHeading id="related" title="Bài viết liên quan" />
      <div className={`stagger ${NEWS_GRID}`}>
        {posts.map((p) => (
          <NewsCard key={p.slug} post={p} heading="h3" />
        ))}
      </div>
    </section>
  );
}

/** Thin bar at the very top showing how far through the article the reader is, in the category's colour. */
function ReadingProgress({ fill }: { fill: string }) {
  const [ratio, setRatio] = useState(0);
  useEffect(() => {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setRatio(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return (
    <div aria-hidden="true" className="fixed inset-x-0 top-0 z-40 h-[3px]">
      <div className={`h-full origin-left ${fill}`} style={{ transform: `scaleX(${ratio})` }} />
    </div>
  );
}

/**
 * The cover keeps its own shape, capped at 420px tall so the first lines of text are on the first screen of
 * a laptop, and never wider than the picture itself (an upscaled picture looks soft). The box has its size
 * before the picture arrives (no jump).
 */
function Cover({ post }: { post: NewsPostDto }) {
  const width = post.cover?.width ?? 1200;
  const height = post.cover?.height ?? 675;
  return (
    <div
      className="relative -mt-12 mx-auto max-h-[420px] w-full overflow-hidden rounded-card border border-line bg-tint sm:-mt-14"
      style={{ aspectRatio: `${width} / ${height}`, maxWidth: post.cover ? width : undefined }}
    >
      <NewsImage
        src={post.cover?.url}
        srcset={post.cover?.srcset}
        sizes={NEWS_IMAGE_SIZES.cover}
        category={post.category}
        alt={post.cover?.alt ?? post.title}
        width={width}
        height={height}
        priority
        className="absolute inset-0 size-full"
      />
    </div>
  );
}

function Article({ post }: { post: NewsPostDto }) {
  useArticleMeta(post);
  // The news list's first page carries the popular hashtags (usually cached already from /tin-tuc).
  const popular = useNewsList({ page: 1 }).data?.popularTags ?? [];
  const mine = post.tags.map((t) => t.slug);
  const color = newsCategoryClasses(post.category.slug);
  return (
    <>
      <ReadingProgress fill={color.fill} />
      <PageHero
        crumbs={[
          { label: 'Tin tức', to: '/tin-tuc' },
          { label: post.category.name, to: newsCategoryPath(post.category.slug) },
          { label: post.title },
        ]}
        eyebrow={post.category.name}
        eyebrowClassName={color.textOnDark}
        title={post.title}
        overlap
      >
        <ArticleMetaLine post={post} />
      </PageHero>
      <main className={`relative ${PAGE_WIDTH} flex flex-col gap-14 pb-20 sm:gap-16`}>
        <div className="flex flex-col gap-8 sm:gap-10">
          <Cover post={post} />
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-14">
            <Contents headings={post.headings} side={<PopularTags tags={popular} highlight={mine} stacked />} />
            <article className="flex min-w-0 max-w-[720px] flex-1 flex-col gap-8">
              <ArticleBody html={post.html} />
              <TagChips tags={post.tags} />
              <div className="border-t border-line pt-6">
                <ShareButtons url={newsUrl(post.slug)} title={post.title} />
              </div>
              {/* Phones and tablets: the side column is not shown, so the popular hashtags come here. */}
              <div className="lg:hidden">
                <PopularTags tags={popular} highlight={mine} />
              </div>
            </article>
          </div>
        </div>
        <Related posts={post.related} />
        <OpenJobs />
      </main>
    </>
  );
}

/** Same boxes as the article, shown at once and faded in only if loading takes a moment. */
function PostSkeleton() {
  return (
    <>
      <LoadingStatus />
      <PageHeroSkeleton overlap />
      <main aria-hidden="true" className={`${PAGE_WIDTH} flex min-h-svh flex-col gap-14 pb-20`}>
        <div className="skeleton-in -mt-12 aspect-[16/9] max-h-[420px] w-full animate-pulse-soft rounded-card bg-skeleton sm:-mt-14" />
        <div className="skeleton-in flex max-w-[720px] flex-col gap-3">
          <Sk w="100%" h={16} />
          <Sk w="96%" h={16} />
          <Sk w="88%" h={16} />
          <Sk w="60%" h={16} />
        </div>
      </main>
    </>
  );
}

function PostMissing() {
  return (
    <NotFoundView
      crumbs={[{ label: 'Tin tức', to: '/tin-tuc' }, { label: 'Không tìm thấy' }]}
      title="Không tìm thấy bài viết"
      intro="Bài có thể đã được gỡ hoặc link chưa đúng."
      actions={
        <ButtonLink to="/tin-tuc" variant="light" size="lg" icon="newspaper">
          Xem bài viết khác
        </ButtonLink>
      }
    />
  );
}

/** /tin-tuc/:slug */
export function NewsPostPage() {
  const { slug = '' } = useParams();
  const query = useNewsPost(slug);
  const post = query.data;
  const notFound = query.error instanceof ApiError && query.error.status === 404;
  usePageMeta(post?.title, post?.summary);

  if (query.isPending) return <PostSkeleton />;
  if (notFound) return <PostMissing />;
  if (!post) {
    return (
      <>
        <PageHero crumbs={[{ label: 'Tin tức', to: '/tin-tuc' }]} title="Chưa tải được bài viết" />
        <main className={`${PAGE_WIDTH} py-10`}>
          <ErrorState onRetry={() => query.refetch()} />
        </main>
      </>
    );
  }
  // key: moving to a related post starts at the top with fresh meta tags.
  return <Article key={post.slug} post={post} />;
}

export default NewsPostPage;
