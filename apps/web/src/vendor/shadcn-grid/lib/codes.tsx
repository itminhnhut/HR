import * as React from 'react';
import { Ban, Check, CircleSlash, Clock, Flag, Moon, Sun, Wallet, type LucideIcon } from 'lucide-react';

export interface AttendanceCode {
  value: string;
  name: string;
  /** What it does to the numbers, shown on hover. */
  hint: string;
  key: string;
  icon: LucideIcon;
  /** Colour of the code in a cell and in the legend. */
  tone: string;
  /** Plain "1" is most of the sheet: it stays quiet so exceptions stand out. */
  isQuiet?: boolean;
}

export const CODES: AttendanceCode[] = [
  { value: '1', name: 'Đủ công', hint: 'T2–T6 máy tự chấm. T7, CN do HR điền', key: '1', icon: Check, tone: 'bg-green-50 text-green-700 border-green-200', isQuiet: true },
  { value: 'M', name: 'Đi muộn', hint: 'Đi muộn hoặc về sớm: vẫn tính 1 công, đếm thêm 1 lần', key: 'M', icon: Clock, tone: 'bg-amber-100 text-amber-800 border-amber-300' },
  { value: 'P', name: 'Nghỉ phép', hint: 'Trừ 1 ngày phép, có lương nếu còn phép', key: 'P', icon: Sun, tone: 'bg-sky-100 text-sky-800 border-sky-300' },
  { value: 'P/2', name: 'Nửa phép', hint: 'Tính 0,5 công và 0,5 ngày phép', key: 'H', icon: Moon, tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  { value: 'KL', name: 'Không lương', hint: 'Nghỉ có xin phép, không tính công', key: 'K', icon: Wallet, tone: 'bg-orange-100 text-orange-800 border-orange-300' },
  { value: 'KL/2', name: 'Nửa không lương', hint: 'Tính 0,5 công, nghỉ 0,5 ngày không lương', key: '', icon: Wallet, tone: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'NL', name: 'Nghỉ lễ', hint: 'Không tính công thực tế, vẫn được trả lương', key: 'L', icon: Flag, tone: 'bg-teal-100 text-teal-800 border-teal-300' },
  { value: 'KP', name: 'Không phép', hint: 'Nghỉ không xin phép, không tính công', key: 'X', icon: Ban, tone: 'bg-red-600 text-white border-red-600' },
];

export const OFF_CODE = { name: 'Off', hint: 'Chưa vào làm hoặc đã nghỉ việc, không chấm', icon: CircleSlash };

export const codeOf = (value: unknown) => CODES.find((c) => c.value === value);

/** Notes on a cell, keyed `rowId:columnId`. */
export const NotesContext = React.createContext<{ notes: Record<string, string>; setNote: (key: string, text: string) => void }>({
  notes: {},
  setNote: () => undefined,
});
