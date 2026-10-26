import { srcsetAttr, type NewsImageVariant } from '@careers/shared';
import { useEffect, useRef, useState } from 'react';
import { newsCategoryColor } from '../../lib/colors';

/** Shown when a news image is missing or fails to load (deleted file, network error). */
export const NEWS_FALLBACK_IMAGE = '/images/news-default.jpg';

/** Swaps a broken image for the fallback once (never loops if the fallback itself fails). */
export function useImageFallback(container: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    // "error" does not bubble, so listen in the capture phase for every image inside.
    const onError = (e: Event) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || img.dataset.fallback) return;
      img.dataset.fallback = '1';
      img.removeAttribute('srcset');
      img.src = NEWS_FALLBACK_IMAGE;
    };
    el.addEventListener('error', onError, true);
    return () => el.removeEventListener('error', onError, true);
  }, [container]);
}

/** The category a picture belongs to: its colour and name make the stand-in when the picture is missing. */
export interface NewsImageCategory {
  name: string;
  slug: string;
}

/** The TOP FLOW waves (favicon.svg) in white. */
const WaveLogo = () => (
  <svg viewBox="0 0 30 30" aria-hidden="true" className="w-[18%] min-w-6 max-w-16">
    <rect width="30" height="30" rx="7" fill="#fff" fillOpacity="0.16" />
    <path
      d="M7 14c2.6-2.4 5.2-2.4 8 0s5.4 2.4 8 0M7 18.5c2.6-2.4 5.2-2.4 8 0s5.4 2.4 8 0"
      fill="none"
      stroke="#fff"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Stand-in for a missing or broken picture: a gradient in the category colour with the logo and the category
 * name, in the picture's own shape. It keeps the picture's alt text; with none it is hidden like the picture.
 */
function CategoryFallback(props: {
  category: NewsImageCategory;
  alt: string;
  width: number;
  height: number;
  className: string;
}) {
  const { category, alt, width, height, className } = props;
  const color = `var(--color-cat-${newsCategoryColor(category.slug)})`;
  const label = alt ? { role: 'img', 'aria-label': alt } : { 'aria-hidden': true };
  return (
    <span
      {...label}
      className={`flex flex-col items-center justify-center gap-[4%] overflow-hidden text-center text-white [container-type:inline-size] ${className}`}
      style={{
        aspectRatio: `${width} / ${height}`,
        backgroundImage: `linear-gradient(135deg, ${color} 0%, var(--color-navy) 135%)`,
      }}
    >
      <WaveLogo />
      <span className="max-w-[85%] text-[clamp(11px,5.5cqw,22px)] font-semibold leading-tight [text-wrap:balance]">
        {category.name}
      </span>
    </span>
  );
}

/**
 * A news image that fades in once loaded and falls back to the branded default if it cannot load.
 * `priority` for the image above the fold (cover of the open post). `srcset` (smaller WebP copies made at
 * upload) with `sizes` lets phones download a small file; older images have none and load the one file.
 */
export function NewsImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  srcset,
  sizes,
  category,
}: {
  src: string | null | undefined;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  srcset?: NewsImageVariant[];
  sizes?: string;
  /** Known on cards and the post cover: a missing picture then shows the category stand-in. */
  category?: NewsImageCategory;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // A cached image may finish (or fail) before React attaches onLoad/onError: never leave it invisible.
  useEffect(() => {
    const img = ref.current;
    if (!img?.complete) return;
    if (img.naturalWidth > 0) setLoaded(true);
    else if (img.currentSrc || img.src) setFailed(true);
  }, []);
  const srcSet = !failed && src ? srcsetAttr(srcset) : '';
  if ((failed || !src) && category) {
    return (
      <CategoryFallback
        category={category}
        alt={alt}
        width={width ?? 1200}
        height={height ?? 675}
        className={className}
      />
    );
  }
  return (
    <img
      ref={ref}
      // srcset and sizes before src: some browsers start fetching src the moment it is set.
      srcSet={srcSet || undefined}
      sizes={srcSet ? sizes : undefined}
      src={failed || !src ? NEWS_FALLBACK_IMAGE : src}
      alt={alt}
      width={width ?? 1200}
      height={height ?? 675}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      className={`bg-tint object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
    />
  );
}
