import { parseCvContact, type ParsedCvDto } from '@careers/shared';
import { CV_PROBLEM_MESSAGE, checkCvFile } from '../lib/cv-store.js';
import { invalid } from '../lib/http-error.js';
import { pdfText } from '../lib/pdf-text.js';

const NOTHING_READ: ParsedCvDto = { fullName: null, phone: null, email: null, readable: false };

/**
 * "Thêm hồ sơ" pre-fill: name, phone and email read from the CV's text layer. The file is only read,
 * never stored; a scanned CV (no text) is not an error, just readable: false.
 */
export async function readCvContact(file: File | null): Promise<ParsedCvDto> {
  if (!file) throw invalid('Chọn file CV (PDF).', { cv: 'Chọn file CV (PDF).' });
  const problem = await checkCvFile(file);
  if (problem) throw invalid(CV_PROBLEM_MESSAGE[problem], { cv: CV_PROBLEM_MESSAGE[problem] });
  const text = await pdfText(new Uint8Array(await file.arrayBuffer()));
  if (!text) return NOTHING_READ;
  const { fullName, phone, email } = parseCvContact(text);
  return { fullName, phone, email, readable: true };
}
