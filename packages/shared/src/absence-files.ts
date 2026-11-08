import { z } from 'zod';
import type { AbsenceReasonKey } from './timesheet.js';

/** Papers kept with an absence: a sick note, a birth or wedding certificate (spec-giay-to-nghi.md). */

/** Vercel's function body limit is 4.5 MB, and each file goes up in its own request. */
export const ABSENCE_FILE_MAX_BYTES = 4 * 1024 * 1024;
export const ABSENCE_FILES_MAX = 10;
/** Photos are made smaller in the browser before they go up: the long side at most this. */
export const ABSENCE_PHOTO_MAX_SIDE = 2000;

export const ABSENCE_FILE_TYPES = [
  { contentType: 'image/jpeg', ext: 'jpg' },
  { contentType: 'image/png', ext: 'png' },
  { contentType: 'image/webp', ext: 'webp' },
  { contentType: 'application/pdf', ext: 'pdf' },
] as const;
export type AbsenceFileType = (typeof ABSENCE_FILE_TYPES)[number];
export type AbsenceFileContentType = AbsenceFileType['contentType'];

/** The reasons that ask for papers until HR changes it in Cấu hình. */
export const PAPER_REASONS_DEFAULT: readonly AbsenceReasonKey[] = ['sick', 'maternity', 'wedding', 'child-wedding', 'funeral-close'];

/** A reason HR added (keyed by its id) asks for none until HR turns it on. */
export const needsPaperByDefault = (reason: string) => (PAPER_REASONS_DEFAULT as readonly string[]).includes(reason);

export const needsPaperSchema = z.object({ needsPaper: z.boolean({ message: 'Chọn có hoặc không.' }) });

export type AbsenceFileProblem = 'empty' | 'too_large' | 'heic' | 'not_allowed' | 'broken_pdf';

export const ABSENCE_FILE_PROBLEM_MESSAGE: Record<AbsenceFileProblem, string> = {
  empty: 'File trống (0 byte). Chọn lại file.',
  too_large: 'File lớn hơn 4 MB. Chụp lại hoặc nén PDF.',
  heic: 'Ảnh HEIC chưa đọc được. Chụp lại, hoặc xuất ảnh ra JPEG rồi gửi.',
  not_allowed: 'Chỉ nhận ảnh JPG, PNG, WEBP hoặc file PDF.',
  broken_pdf: 'File PDF bị lỗi hoặc chưa tải hết. Lưu lại file rồi thử lại.',
};

export interface AbsenceFileDto {
  id: string;
  name: string;
  contentType: AbsenceFileContentType;
  size: number;
  createdBy: string;
  createdAt: string;
}

const ascii = (bytes: Uint8Array, from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
const startsWith = (bytes: Uint8Array, head: readonly number[]) => head.every((b, i) => bytes[i] === b);
/** How far from the end a real PDF writes "%%EOF"; writers and mail gateways may pad after it. */
const PDF_EOF_WINDOW = 1024;
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);

function typeOf(bytes: Uint8Array): AbsenceFileType | 'heic' | null {
  const [jpg, png, webp, pdf] = ABSENCE_FILE_TYPES;
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return jpg;
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return png;
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return webp;
  if (ascii(bytes, 0, 5) === '%PDF-') return pdf;
  if (ascii(bytes, 4, 8) === 'ftyp' && HEIC_BRANDS.has(ascii(bytes, 8, 12))) return 'heic';
  return null;
}

const hasPdfEnd = (bytes: Uint8Array) => ascii(bytes, Math.max(0, bytes.length - PDF_EOF_WINDOW), bytes.length).includes('%%EOF');

/** Checks the file by what is in it, not by the name or type the browser gave it. */
export function absenceFileProblem(bytes: Uint8Array): { problem: AbsenceFileProblem } | { problem: null; contentType: AbsenceFileContentType; ext: AbsenceFileType['ext'] } {
  if (bytes.length === 0) return { problem: 'empty' };
  if (bytes.length > ABSENCE_FILE_MAX_BYTES) return { problem: 'too_large' };
  const type = typeOf(bytes);
  if (type === 'heic') return { problem: 'heic' };
  if (!type) return { problem: 'not_allowed' };
  if (type.ext === 'pdf' && !hasPdfEnd(bytes)) return { problem: 'broken_pdf' };
  return { problem: null, contentType: type.contentType, ext: type.ext };
}
