import { afterEach, describe, expect, it, vi } from 'vitest';
import { fitWithin, shrinkPhoto } from './photoShrink';

/** Photos go up smaller: the long side at most 2000px, the shape kept (spec-giay-to-nghi.md). */
describe('how big a photo goes up', () => {
  it.each([
    [4000, 3000, 2000, 1500],
    [3000, 4000, 1500, 2000],
    [1200, 900, 1200, 900],
    [2000, 2000, 2000, 2000],
  ])('TC-GT-40: should fit %ix%i into %ix%i', (w, h, width, height) => {
    expect(fitWithin(w, h, 2000)).toEqual({ width, height });
  });
});

/** The browser's decoder and canvas are outside our code: they are stood in for here. */
describe('which photo goes up', () => {
  const bitmap = (width: number, height: number) => ({ width, height, close: vi.fn() }) as unknown as ImageBitmap;
  const jpeg = (size: number, name = 'giay-om.jpg') => new File([new Uint8Array(size)], name, { type: 'image/jpeg' });

  afterEach(() => vi.unstubAllGlobals());

  it('should send a small JPEG as it is', async () => {
    // Arrange
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap(1200, 900)));
    const file = jpeg(300_000);

    // Act
    const sent = await shrinkPhoto(file);

    // Assert
    expect(sent).toBe(file);
  });

  it('should send a PDF as it is, without trying to read it as a photo', async () => {
    // Arrange
    const read = vi.fn();
    vi.stubGlobal('createImageBitmap', read);
    const pdf = new File(['%PDF-1.4'], 'giay-ra-vien.pdf', { type: 'application/pdf' });

    // Act
    const sent = await shrinkPhoto(pdf);

    // Assert
    expect(sent).toBe(pdf);
    expect(read).not.toHaveBeenCalled();
  });

  it('should send the photo as it is, with a warning, when the browser cannot read it', async () => {
    // Arrange
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new DOMException('cannot decode', 'InvalidStateError')));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const heic = new File([new Uint8Array(10)], 'IMG_0001.HEIC', { type: 'image/heic' });

    // Act
    const sent = await shrinkPhoto(heic);

    // Assert
    expect(sent).toBe(heic);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('should turn a big photo upright into a JPEG at most 2000px on the long side', async () => {
    // Arrange
    const read = vi.fn().mockResolvedValue(bitmap(3000, 4000));
    vi.stubGlobal('createImageBitmap', read);
    const drawn: number[][] = [];
    const ctx = { fillStyle: '', fillRect: vi.fn(), drawImage: (_b: unknown, ...xywh: number[]) => drawn.push(xywh) };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) => done(new Blob([new Uint8Array(900_000)], { type: 'image/jpeg' })));

    // Act
    const sent = await shrinkPhoto(jpeg(8_000_000, 'IMG_0002.jpeg'));

    // Assert
    expect(read).toHaveBeenCalledWith(expect.any(File), { imageOrientation: 'from-image' });
    expect(drawn).toEqual([[0, 0, 1500, 2000]]);
    expect(sent.name).toBe('IMG_0002.jpg');
    expect(sent.type).toBe('image/jpeg');
    expect(sent.size).toBe(900_000);
    vi.restoreAllMocks();
  });
});
