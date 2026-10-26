import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readImageInfo } from './image-info.js';

/** Real 7×5 images written by Pillow (see src/test/images). */
const image = (name: string) => new Uint8Array(readFileSync(new URL(`../test/images/${name}`, import.meta.url)));

describe('readImageInfo', () => {
  it.each([
    ['baseline-7x5.jpg', 'jpg'],
    ['progressive-7x5.jpg', 'jpg'],
    ['plain-7x5.png', 'png'],
    ['lossy-7x5.webp', 'webp'],
    ['lossless-7x5.webp', 'webp'],
    ['alpha-7x5.webp', 'webp'],
  ])('should read the type and real size of %s', (name, ext) => {
    const info = readImageInfo(image(name));

    expect(info).toEqual({ ext, width: 7, height: 5 });
  });

  it('should swap width and height when EXIF says the photo is turned a quarter', () => {
    const info = readImageInfo(image('rotated-7x5-orientation6.jpg'));

    expect(info).toEqual({ ext: 'jpg', width: 5, height: 7 });
  });

  it('should refuse a PDF or text renamed to .jpg', () => {
    const pdf = new TextEncoder().encode('%PDF-1.7\n%%EOF\n');
    const html = new TextEncoder().encode('<svg onload="alert(1)"></svg>');

    expect(readImageInfo(pdf)).toBeNull();
    expect(readImageInfo(html)).toBeNull();
  });

  it('should refuse a GIF even though browsers show it', () => {
    const gif = new TextEncoder().encode('GIF89a\u0007\u0000\u0005\u0000');

    expect(readImageInfo(gif)).toBeNull();
  });

  it('should refuse a file cut off before its size is written', () => {
    const png = image('plain-7x5.png').slice(0, 18);
    const jpg = image('baseline-7x5.jpg').slice(0, 40);
    const webp = image('lossy-7x5.webp').slice(0, 24);

    expect(readImageInfo(png)).toBeNull();
    expect(readImageInfo(jpg)).toBeNull();
    expect(readImageInfo(webp)).toBeNull();
  });

  it('should refuse an image that claims a zero size', () => {
    const png = image('plain-7x5.png');
    const broken = new Uint8Array(png);
    broken.set([0, 0, 0, 0], 16);

    expect(readImageInfo(broken)).toBeNull();
  });
});
