import { parseCvContact, type ParsedCvDto } from '@careers/shared';
import { CV_PROBLEM_MESSAGE, checkCvFile } from '../lib/cv-store.js';
import { invalid } from '../lib/http-error.js';
import { readPdf, type PdfProblem } from '../lib/pdf-text.js';

const NOTHING_READ: ParsedCvDto = { fullName: null, phone: null, email: null, readable: false };
const CHOOSE_FILE = 'Chọn file CV (PDF).';
const EMPTY_FILE = 'File CV rỗng (0 byte). Chọn lại file khác hoặc dán link CV.';

/** Shown instead of the "scan" note: HR can still save the file, only its text cannot be read. */
const PDF_PROBLEM_MESSAGE: Record<PdfProblem, string> = {
  password:
    'CV có đặt mật khẩu nên không đọc được, nhập tay giúp. Cần xem nội dung thì nhờ ứng viên gửi bản không khoá.',
  corrupt: 'File PDF bị hỏng nên không đọc được, nhập tay giúp. Cần xem nội dung thì nhờ ứng viên gửi lại file khác.',
};

export interface CvUpload {
  file: File | null;
  /** The form carried a named file with no bytes; a form with no file chosen does not. */
  isEmptyFile?: boolean;
}

/**
 * "Thêm hồ sơ" pre-fill: name, phone and email read from the CV's text layer. The file is only read, never stored;
 * a scanned CV (no text) is not an error, just readable: false. A locked or broken PDF adds `problem`, the reason.
 */
export async function readCvContact({ file, isEmptyFile = false }: CvUpload): Promise<ParsedCvDto> {
  if (isEmptyFile) throw invalid(EMPTY_FILE, { cv: EMPTY_FILE });
  if (!file) throw invalid(CHOOSE_FILE, { cv: CHOOSE_FILE });
  const problem = await checkCvFile(file);
  if (problem) throw invalid(CV_PROBLEM_MESSAGE[problem], { cv: CV_PROBLEM_MESSAGE[problem] });
  const reading = await readPdf(new Uint8Array(await file.arrayBuffer()));
  if (reading.problem) return { ...NOTHING_READ, problem: PDF_PROBLEM_MESSAGE[reading.problem] };
  if (!reading.text) return NOTHING_READ;
  const { fullName, phone, email } = parseCvContact(reading.text);
  return { fullName, phone, email, readable: true };
}
