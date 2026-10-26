import { NEWS_IMAGE_MAX_BYTES } from '@careers/shared';
import { IMAGE_CONTENT_TYPE, readImageInfo } from '../lib/image-info.js';
import type { ImageStore } from '../lib/image-store.js';
import { invalid } from '../lib/http-error.js';

/** What the editor gets back; HR adds the alt text. */
export interface UploadedNewsImage {
  url: string;
  width: number;
  height: number;
}

/** Same bound as newsImageSchema: anything bigger is not a web image. */
const MAX_SIDE = 10_000;
const MAX_MB = NEWS_IMAGE_MAX_BYTES / 1024 / 1024;

const refuse = (message: string) => invalid(message, { file: message });

/**
 * Stores an article or cover image. The type and size come from the file's own bytes: a renamed PDF, an
 * SVG (which can carry scripts) or a GIF is refused whatever its name or MIME type says.
 */
export async function uploadNewsImage(store: ImageStore, file: File | null): Promise<UploadedNewsImage> {
  if (!file) throw refuse('Chọn ảnh để tải lên.');
  if (file.size > NEWS_IMAGE_MAX_BYTES) throw refuse(`Ảnh lớn hơn ${MAX_MB} MB. Giảm kích thước ảnh rồi thử lại.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = readImageInfo(bytes);
  if (!info) throw refuse('Chỉ nhận ảnh JPEG, PNG hoặc WebP.');
  if (info.width > MAX_SIDE || info.height > MAX_SIDE) {
    throw refuse(`Ảnh quá lớn (tối đa ${MAX_SIDE.toLocaleString('vi-VN')} px mỗi chiều).`);
  }
  const { url } = await store.put(new Blob([bytes], { type: IMAGE_CONTENT_TYPE[info.ext] }), info.ext);
  return { url, width: info.width, height: info.height };
}
