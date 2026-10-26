import { z } from 'zod';

/** A smaller copy of an uploaded news image, for `srcset`. */
export interface NewsImageVariant {
  url: string;
  width: number;
}

/** Widths the editor makes at upload (WebP), each only when narrower than the uploaded picture. */
export const NEWS_IMAGE_VARIANT_WIDTHS = [480, 960, 1600] as const;
/** The variants plus the uploaded picture itself, with room to spare. */
export const NEWS_SRCSET_MAX = 6;
/** Share previews (Facebook, Zalo, Google) want at least this width; narrower covers look blurry there. */
export const NEWS_COVER_MIN_WIDTH = 1200;

/** `sizes` hints: how wide the picture is shown, so the browser picks the smallest file that is sharp. */
export const NEWS_IMAGE_SIZES = {
  card: '(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw',
  cover: '(min-width: 1200px) 1110px, 100vw',
} as const;

/** The widths to make for a picture `width` px wide: never larger than the original. */
export const variantWidths = (width: number): number[] => NEWS_IMAGE_VARIANT_WIDTHS.filter((w) => w < width);

/** "a.webp 480w, b.webp 960w", narrowest first; '' when there are none. */
export function srcsetAttr(variants: readonly NewsImageVariant[] | undefined): string {
  return [...(variants ?? [])]
    .sort((a, b) => a.width - b.width)
    .map((v) => `${v.url} ${v.width}w`)
    .join(', ');
}

/** "/api/news-images/a.jpg": a path on this site (the local development store), never "//host/…" or "/\\host". */
export const isSitePath = (url: string) => /^\/(?![/\\])[^\s\\]*$/.test(url);

const isWebAddress = (url: string) => URL.canParse(url) && /^https?:$/.test(new URL(url).protocol);

/**
 * Where an uploaded image may live: a web address (Vercel Blob) or a path on this site (local development).
 * The API narrows it further to its own image store.
 */
export const imageAddressSchema = z
  .string()
  .max(500)
  .refine((url) => isSitePath(url) || isWebAddress(url), 'Địa chỉ ảnh không hợp lệ.');

/** Share previews, JSON-LD and sitemaps need full addresses: "/a.jpg" → "https://site/a.jpg". */
export const absoluteUrl = (siteUrl: string, url: string) =>
  isSitePath(url) ? `${siteUrl.replace(/\/+$/, '')}${url}` : url;

const variantSchema = (url: z.ZodType<string>) => z.object({ url, width: z.number().int().min(1).max(10_000) });

/** `srcset` of a cover or an article image; `isAllowedImage` limits the addresses to our own storage. */
export const srcsetSchema = (isAllowedImage?: (url: string) => boolean) =>
  z
    .array(
      variantSchema(
        isAllowedImage
          ? z.string().refine(isAllowedImage, 'Ảnh phải được tải lên từ trình soạn bài.')
          : imageAddressSchema,
      ),
    )
    .max(NEWS_SRCSET_MAX)
    .optional();
