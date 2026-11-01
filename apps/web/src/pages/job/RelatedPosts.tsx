import { newsPath, type RelatedPostDto } from '@careers/shared';
import { newsCategoryClasses } from '../../lib/colors';
import { CARD_TITLE_HOVER, CardLink } from '../../site/Card';
import { NewsImage } from '../../site/news/NewsImage';
import { SectionHeading, TextLink } from '../../site/SectionHeading';

/** Thumbnail width: 96px in a phone row, the card's third of the page from sm. */
const IMAGE_SIZES = '(min-width: 1024px) 360px, (min-width: 640px) 33vw, 96px';

/** A small news card: thumbnail and title in a row on phones, picture on top from sm, like the news grid. */
function RelatedPostCard({ post }: { post: RelatedPostDto }) {
  return (
    <CardLink to={newsPath(post.slug)} className="flex-row gap-3.5 p-3 sm:flex-col sm:gap-0 sm:p-0">
      <span className="relative block aspect-[4/3] w-24 shrink-0 self-start overflow-hidden rounded-control bg-tint sm:aspect-[16/9] sm:w-full sm:rounded-none">
        <NewsImage
          src={post.cover?.url}
          srcset={post.cover?.srcset}
          sizes={IMAGE_SIZES}
          category={post.category}
          alt={post.cover?.alt ?? ''}
          width={post.cover?.width}
          height={post.cover?.height}
          className="absolute inset-0 size-full transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5 sm:p-4">
        {post.category.name && (
          <span
            className={`text-xs font-semibold uppercase tracking-[0.08em] ${newsCategoryClasses(post.category.slug).text}`}
          >
            {post.category.name}
          </span>
        )}
        <h3
          className={`m-0 line-clamp-3 font-serif text-[17px] font-medium leading-snug [text-wrap:pretty] ${CARD_TITLE_HOVER}`}
        >
          {post.title}
        </h3>
      </span>
    </CardLink>
  );
}

/** "Bài viết liên quan": up to three news posts about the same work (the API picks them), real links. */
export function RelatedPosts({ posts }: { posts: RelatedPostDto[] }) {
  if (posts.length === 0) return null;
  return (
    <section aria-labelledby="related-posts" className="flex flex-col gap-5">
      <SectionHeading id="related-posts" title="Bài viết liên quan">
        <TextLink to="/tin-tuc">Xem tất cả bài viết</TextLink>
      </SectionHeading>
      <div className="stagger grid gap-4 sm:grid-cols-3 sm:gap-6">
        {posts.map((post) => (
          <RelatedPostCard key={post.slug} post={post} />
        ))}
      </div>
    </section>
  );
}
