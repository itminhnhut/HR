/**
 * Type and pixel size of an uploaded image, read from its first bytes (not from the browser's name or MIME
 * type, which anyone can fake). Only the formats the site accepts: JPEG, PNG and WebP. No image library:
 * the size sits at a fixed place in each format's header.
 */

export type ImageExt = 'jpg' | 'png' | 'webp';

export interface ImageInfo {
  ext: ImageExt;
  width: number;
  height: number;
}

export const IMAGE_CONTENT_TYPE: Record<ImageExt, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const startsWith = (bytes: Uint8Array, expected: number[], at = 0) =>
  bytes.length >= at + expected.length && expected.every((b, i) => bytes[at + i] === b);
const ascii = (bytes: Uint8Array, at: number, length: number) =>
  String.fromCharCode(...bytes.subarray(at, at + length));

const u16be = (b: Uint8Array, at: number) => (b[at] << 8) | b[at + 1];
const u16le = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const u24le = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8) | (b[at + 2] << 16);
const u32be = (b: Uint8Array, at: number) => ((b[at] << 24) >>> 0) + ((b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]);

function sized(ext: ImageExt, width: number, height: number): ImageInfo | null {
  return width > 0 && height > 0 ? { ext, width, height } : null;
}

function readPng(b: Uint8Array): ImageInfo | null {
  // The first chunk is always IHDR: width and height as 32-bit big-endian numbers.
  if (b.length < 24 || ascii(b, 12, 4) !== 'IHDR') return null;
  return sized('png', u32be(b, 16), u32be(b, 20));
}

function readWebp(b: Uint8Array): ImageInfo | null {
  if (b.length < 30 || ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') return null;
  const chunk = ascii(b, 12, 4);
  if (chunk === 'VP8X') return sized('webp', u24le(b, 24) + 1, u24le(b, 27) + 1);
  if (chunk === 'VP8L') {
    if (b[20] !== 0x2f) return null;
    const width = 1 + (b[21] | ((b[22] & 0x3f) << 8));
    const height = 1 + ((b[22] >> 6) | (b[23] << 2) | ((b[24] & 0x0f) << 10));
    return sized('webp', width, height);
  }
  if (chunk === 'VP8 ') {
    if (!startsWith(b, [0x9d, 0x01, 0x2a], 23)) return null;
    return sized('webp', u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff);
  }
  return null;
}

/** EXIF orientation 5–8 means the camera stored the photo turned a quarter: browsers show it swapped. */
function exifTurnsQuarter(b: Uint8Array, start: number, end: number): boolean {
  if (end - start < 14 || ascii(b, start, 6) !== 'Exif\u0000\u0000') return false;
  const tiff = start + 6;
  const little = ascii(b, tiff, 2) === 'II';
  const u16 = (at: number) => (little ? u16le(b, at) : u16be(b, at));
  const u32 = (at: number) => (little ? u16le(b, at) + u16le(b, at + 2) * 0x10000 : u32be(b, at));
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > end) return false;
  const entries = u16(ifd);
  for (let i = 0; i < entries; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > end) return false;
    if (u16(entry) === 0x0112) return u16(entry + 8) >= 5 && u16(entry + 8) <= 8;
  }
  return false;
}

/** Start-of-frame markers (baseline, progressive, lossless…) carry the size; C4, C8 and CC are not frames. */
const isStartOfFrame = (marker: number) =>
  marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

function readJpeg(b: Uint8Array): ImageInfo | null {
  let at = 2;
  let turned = false;
  while (at + 9 < b.length) {
    if (b[at] !== 0xff) return null;
    const marker = b[at + 1];
    if (marker === 0xff) {
      at += 1; // fill byte
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2; // markers without a length
      continue;
    }
    const length = u16be(b, at + 2);
    if (length < 2) return null;
    if (marker === 0xe1) turned ||= exifTurnsQuarter(b, at + 4, Math.min(b.length, at + 2 + length));
    if (isStartOfFrame(marker)) {
      const height = u16be(b, at + 5);
      const width = u16be(b, at + 7);
      return turned ? sized('jpg', height, width) : sized('jpg', width, height);
    }
    if (marker === 0xd9 || marker === 0xda) return null; // image data before any frame header
    at += 2 + length;
  }
  return null;
}

export function readImageInfo(bytes: Uint8Array): ImageInfo | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return readJpeg(bytes);
  if (startsWith(bytes, PNG_SIGNATURE)) return readPng(bytes);
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46])) return readWebp(bytes);
  return null;
}
