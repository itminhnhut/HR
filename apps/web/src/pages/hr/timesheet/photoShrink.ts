import { ABSENCE_PHOTO_MAX_SIDE } from '@careers/shared';
import { shrinkSize } from '../news/shrinkImage';

/** Photos of papers go up smaller (spec-giay-to-nghi.md): the long side at most 2000px, as JPEG. */

const QUALITY = 0.85;

/** Size to draw at: the longest side at most `max`, the shape kept, never larger than the photo. */
export const fitWithin = (width: number, height: number, max: number): { width: number; height: number } => shrinkSize(width, height, max);

function toJpeg(bitmap: ImageBitmap, width: number, height: number): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  // JPEG has no transparency: a see-through PNG would turn black without white behind it.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
}

/** Upright as the camera held it (EXIF), or null when this browser cannot read the photo, e.g. HEIC outside Safari. */
async function decode(file: File): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (error) {
    // Sent as it is: the server reads the content and says why it cannot take it.
    console.warn(`Could not read photo ${file.name}, sending it as it is`, error);
    return null;
  }
}

/**
 * A phone photo of 5–10 MB becomes a JPEG of about 0.5–1 MB. A JPEG already small enough goes up as it is,
 * and so does anything that is not a photo (a PDF) or that this browser cannot read.
 */
export async function shrinkPhoto(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') return file;
  const bitmap = await decode(file);
  if (!bitmap) return file;
  try {
    const size = fitWithin(bitmap.width, bitmap.height, ABSENCE_PHOTO_MAX_SIDE);
    const isSmall = size.width === bitmap.width && size.height === bitmap.height;
    if (isSmall && file.type === 'image/jpeg') return file;
    const blob = await toJpeg(bitmap, size.width, size.height);
    if (!blob || (isSmall && blob.size >= file.size)) return file;
    return new File([blob], `${file.name.replace(/\.[a-z0-9]+$/i, '')}.jpg`, { type: 'image/jpeg' });
  } finally {
    bitmap.close();
  }
}
