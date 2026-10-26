import { NEWS_IMAGE_MAX_BYTES, NEWS_IMAGE_TYPES, variantWidths } from '@careers/shared';

/** Longest side after shrinking: sharp on any screen, small enough for the 4 MB upload limit. */
export const IMAGE_MAX_SIDE = 2000;
const QUALITY = 0.85;

/** Size to draw at: the longest side at most `max`, never larger than the original. */
export function shrinkSize(width: number, height: number, max = IMAGE_MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

const isAcceptedType = (type: string) => (NEWS_IMAGE_TYPES as readonly string[]).includes(type);

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

/** WebP keeps transparency; browsers that cannot write it give back PNG, so fall back to JPEG on white. */
async function encode(bitmap: ImageBitmap, width: number, height: number): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, width, height);
  const webp = await toBlob(canvas, 'image/webp');
  if (webp?.type === 'image/webp') return webp;
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  return toBlob(canvas, 'image/jpeg');
}

/**
 * Phone photos are often 4000 px and 5–10 MB: shrink to ≤ 2000 px (WebP, or JPEG ~0.85) before uploading.
 * Small enough files go up untouched; anything this browser cannot read is returned as is (the size check
 * and the API decide then).
 */
export async function shrinkImage(file: File): Promise<File> {
  if (!isAcceptedType(file.type) || typeof createImageBitmap !== 'function') return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Not a readable picture: send it as is, the size check and the API give the reason.
    return file;
  }
  try {
    const size = shrinkSize(bitmap.width, bitmap.height);
    const needsResize = size.width < bitmap.width;
    if (!needsResize && file.size <= NEWS_IMAGE_MAX_BYTES) return file;
    const blob = await encode(bitmap, size.width, size.height);
    if (!blob || blob.size >= file.size) return file;
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, '') + `.${ext}`, { type: blob.type });
  } finally {
    bitmap.close();
  }
}

/** A smaller WebP copy of a picture, `width` px wide. */
export interface ImageVariant {
  file: File;
  width: number;
}

/** WebP only: a browser that cannot write it (blob comes back as PNG) makes no copies at all. */
async function webpAt(bitmap: ImageBitmap, width: number, name: string): Promise<ImageVariant | null> {
  const height = Math.max(1, Math.round((bitmap.height * width) / bitmap.width));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await toBlob(canvas, 'image/webp');
  if (blob?.type !== 'image/webp') return null;
  return { file: new File([blob], `${name}-${width}.webp`, { type: 'image/webp' }), width };
}

/**
 * Smaller WebP copies (480, 960, 1600 px wide) for srcset, only those narrower than the picture: never
 * upscaled. None when this browser cannot read the picture or write WebP; the picture alone still works.
 */
export async function webpVariants(file: File): Promise<ImageVariant[]> {
  if (!isAcceptedType(file.type) || typeof createImageBitmap !== 'function') return [];
  const bitmap = await createImageBitmap(file).catch((error: unknown) => {
    // Unreadable here (the main upload already passed the server's checks): the picture goes without copies.
    console.warn('Could not make smaller image copies', error);
    return null;
  });
  if (!bitmap) return [];
  try {
    const name = file.name.replace(/\.[a-z0-9]+$/i, '');
    const made: ImageVariant[] = [];
    // One at a time: a phone holds only one extra canvas in memory.
    for (const width of variantWidths(bitmap.width)) {
      const variant = await webpAt(bitmap, width, name);
      if (!variant) break;
      made.push(variant);
    }
    return made;
  } finally {
    bitmap.close();
  }
}
