import { describe, expect, it } from 'vitest';
import type { UploadedImage } from '../../../api';
import { uploadPicture, type MakeVariants } from './uploadPicture';

const picture = new File(['x'], 'anh.jpg', { type: 'image/jpeg' });
const webp = (width: number) => ({ file: new File(['v'], `anh-${width}.webp`, { type: 'image/webp' }), width });

/** A store that answers each upload with a new address and the width the file was made at. */
function fakeStore(mainWidth: number, failing: string[] = []) {
  const sent: string[] = [];
  const upload = async (file: File): Promise<UploadedImage> => {
    sent.push(file.name);
    if (failing.includes(file.name)) throw new Error('Mất mạng');
    const width = Number(/-(\d+)\.webp$/.exec(file.name)?.[1] ?? mainWidth);
    return { url: `https://img.test/${file.name}`, width, height: Math.round(width / 2) };
  };
  return { upload, sent };
}

describe('uploadPicture', () => {
  it('should offer the smaller copies plus the picture itself as the largest size', async () => {
    // Arrange
    const store = fakeStore(2000);
    const makeVariants: MakeVariants = async () => [webp(480), webp(960), webp(1600)];

    // Act
    const result = await uploadPicture(picture, store.upload, makeVariants);

    // Assert
    expect(result).toEqual({
      url: 'https://img.test/anh.jpg',
      width: 2000,
      height: 1000,
      srcset: [
        { url: 'https://img.test/anh-480.webp', width: 480 },
        { url: 'https://img.test/anh-960.webp', width: 960 },
        { url: 'https://img.test/anh-1600.webp', width: 1600 },
        { url: 'https://img.test/anh.jpg', width: 2000 },
      ],
    });
  });

  it('should keep the picture when a smaller copy fails to upload', async () => {
    const store = fakeStore(2000, ['anh-960.webp']);
    const makeVariants: MakeVariants = async () => [webp(480), webp(960)];

    const result = await uploadPicture(picture, store.upload, makeVariants);

    expect(result.srcset?.map((v) => v.width)).toEqual([480, 2000]);
  });

  it('should give a plain picture when the browser cannot make smaller copies', async () => {
    const store = fakeStore(800);

    const result = await uploadPicture(picture, store.upload, async () => []);

    expect(result).toEqual({ url: 'https://img.test/anh.jpg', width: 800, height: 400 });
    expect(store.sent).toEqual(['anh.jpg']);
  });

  it('should leave out copies that came back no smaller than the picture (demo sample images)', async () => {
    const upload = async (): Promise<UploadedImage> => ({ url: 'https://img.test/mau.jpg', width: 1200, height: 675 });

    const result = await uploadPicture(picture, upload, async () => [webp(480)]);

    expect(result).not.toHaveProperty('srcset');
  });

  it('should not upload any copy when the picture itself fails', async () => {
    const store = fakeStore(2000, ['anh.jpg']);

    await expect(uploadPicture(picture, store.upload, async () => [webp(480)])).rejects.toThrow('Mất mạng');
    expect(store.sent).toEqual(['anh.jpg']);
  });
});
