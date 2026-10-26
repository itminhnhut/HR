import type { NewsImageVariant } from '@careers/shared';
import type { UploadedImage } from '../../../api';
import { webpVariants, type ImageVariant } from './shrinkImage';

/** An uploaded picture with its smaller copies (srcset); older uploads and some browsers have none. */
export interface UploadedPicture extends UploadedImage {
  srcset?: NewsImageVariant[];
}

export type UploadFile = (file: File) => Promise<UploadedImage>;
export type MakeVariants = (file: File) => Promise<ImageVariant[]>;

/**
 * Uploads the (already shrunk) picture, then its smaller WebP copies. A copy that fails is left out: the
 * picture still works, browsers just download a larger file. srcset lists the copies and the picture itself.
 */
export async function uploadPicture(
  file: File,
  upload: UploadFile,
  makeVariants: MakeVariants = webpVariants,
): Promise<UploadedPicture> {
  const main = await upload(file);
  const variants = await makeVariants(file);
  const settled = await Promise.allSettled(
    variants.map(async (v): Promise<NewsImageVariant> => {
      const uploaded = await upload(v.file);
      return { url: uploaded.url, width: uploaded.width };
    }),
  );
  const widths = new Set<number>();
  const smaller = settled
    .flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
    // The demo store answers every upload with a sample picture: only real, distinct smaller sizes count.
    .filter((v) => v.width < main.width && !widths.has(v.width) && widths.add(v.width))
    .sort((a, b) => a.width - b.width);
  return smaller.length > 0 ? { ...main, srcset: [...smaller, { url: main.url, width: main.width }] } : main;
}
