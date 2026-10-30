import type { ParsedCvDto } from '@careers/shared';
import { useCallback, useReducer, useRef } from 'react';
import { api } from '../../../api';
import { formatPhoneInput } from '../../../lib/phone-input';

/** The "Thêm hồ sơ" boxes a CV can fill. */
export type CvField = 'fullName' | 'phone' | 'email';
export type ContactValues = Record<CvField, string>;

const CV_FIELDS: readonly CvField[] = ['fullName', 'phone', 'email'];
const FIELD_LABEL: Record<CvField, string> = { fullName: 'họ tên', phone: 'SĐT', email: 'email' };

/** Shown under a box filled from the CV, until HR edits it. */
export const FROM_CV_HINT = 'Lấy từ CV';

type Reading =
  | { step: 'idle' }
  | { step: 'reading' }
  | { step: 'failed' }
  | { step: 'done'; readable: boolean; filled: CvField[]; missing: CvField[] };

interface State {
  values: ContactValues;
  /** Boxes holding what the CV said; HR's own typing removes a box from here. */
  fromCv: readonly CvField[];
  reading: Reading;
}

type Action =
  | { type: 'edit'; field: CvField; value: string }
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'fail' }
  | { type: 'read'; parsed: ParsedCvDto };

const INITIAL: State = { values: { fullName: '', phone: '', email: '' }, fromCv: [], reading: { step: 'idle' } };

const boxValue = (field: CvField, value: string) => (field === 'phone' ? formatPhoneInput(value) : value.trim());

/**
 * Fills the boxes HR has not typed in: empty ones, and ones still holding a previous CV's details (a newer CV
 * replaces them, a detail it lacks is cleared). What HR typed is never overwritten.
 */
function applyParsed(state: State, parsed: ParsedCvDto): State {
  const typedByHr = (f: CvField) => state.values[f].trim() !== '' && !state.fromCv.includes(f);
  const fillable = CV_FIELDS.filter((f) => !typedByHr(f));
  const found = (f: CvField) => (parsed[f] ?? '').trim() !== '';
  const values = fillable.reduce<ContactValues>(
    (v, f) => ({ ...v, [f]: found(f) ? boxValue(f, parsed[f] ?? '') : '' }),
    state.values,
  );
  const filled = fillable.filter(found);
  const missing = CV_FIELDS.filter((f) => !found(f));
  return { values, fromCv: filled, reading: { step: 'done', readable: parsed.readable, filled, missing } };
}

function reduce(state: State, action: Action): State {
  switch (action.type) {
    case 'edit':
      return {
        ...state,
        values: { ...state.values, [action.field]: action.value },
        fromCv: state.fromCv.filter((f) => f !== action.field),
      };
    case 'start':
      return { ...state, reading: { step: 'reading' } };
    case 'stop':
      return { ...state, reading: { step: 'idle' } };
    case 'fail':
      return { ...state, reading: { step: 'failed' } };
    case 'read':
      return applyParsed(state, action.parsed);
  }
}

const listOf = (fields: readonly CvField[]) => fields.map((f) => FIELD_LABEL[f]).join(', ');

/** The line under the CV picker, or null when no CV was read. */
export function autofillNote(reading: Reading): string | null {
  if (reading.step === 'idle') return null;
  if (reading.step === 'reading') return 'Đang đọc CV…';
  if (reading.step === 'failed') return 'Không đọc được CV lúc này, nhập tay giúp. Vẫn lưu hồ sơ được.';
  if (!reading.readable) return 'Không đọc được chữ trong CV (ảnh scan), nhập tay giúp.';
  const lines = [
    reading.filled.length > 0 ? `Đã điền sẵn ${listOf(reading.filled)} từ CV — kiểm tra lại trước khi lưu.` : '',
    reading.missing.length > 0 ? `Không tìm thấy ${listOf(reading.missing)} trong CV.` : '',
  ].filter(Boolean);
  return lines.length > 0 ? lines.join(' ') : 'Đã đọc CV, giữ nguyên các ô bạn đã nhập.';
}

/**
 * Họ và tên / Số điện thoại / Email of "Thêm hồ sơ", pre-filled from the picked PDF (POST parse-cv).
 * A failed read only shows a note: HR types the details and saves as usual.
 */
export function useCvAutofill() {
  const [state, dispatch] = useReducer(reduce, INITIAL);
  /** The PDF being read; a reply for any other file (picked earlier, or since dropped) is ignored. */
  const current = useRef<File | null>(null);

  const readCv = useCallback(async (file: File) => {
    if (current.current === file) return;
    current.current = file;
    dispatch({ type: 'start' });
    try {
      const parsed = await api.hrParseCv(file);
      if (current.current === file) dispatch({ type: 'read', parsed });
    } catch {
      // Reading is a convenience: the note asks HR to type the details, saving still works.
      if (current.current === file) dispatch({ type: 'fail' });
    }
  }, []);

  /** No PDF picked any more (a link, or a wrong file): drop the reading and its note, keep the boxes. */
  const forgetCv = useCallback(() => {
    if (current.current === null) return;
    current.current = null;
    dispatch({ type: 'stop' });
  }, []);

  const edit = useCallback((field: CvField) => (value: string) => dispatch({ type: 'edit', field, value }), []);

  return {
    values: state.values,
    edit,
    readCv,
    forgetCv,
    isFromCv: (field: CvField) => state.fromCv.includes(field),
    note: autofillNote(state.reading),
  };
}
