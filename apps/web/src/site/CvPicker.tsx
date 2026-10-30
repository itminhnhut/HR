import { CV_MAX_BYTES } from '@careers/shared';
import { useId, useState } from 'react';
import type { CvInput } from '../api';
import { FieldError } from '../ui/Field';
import { Icon } from '../ui/icons';

type Mode = 'file' | 'link' | 'saved';

/** Same check as the server, so a wrong file is caught before it is sent. */
export function cvFileProblem(file: File): string | null {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf) return 'CV cần là file PDF.';
  if (file.size > CV_MAX_BYTES) return 'File lớn hơn 4 MB. Nén lại hoặc dán link CV.';
  return null;
}

/**
 * Pick a new CV: a PDF, a link, or (candidates) the CV saved in the account. Reports the choice as a CvInput,
 * or null while nothing usable is picked.
 */
export function CvPicker({
  onChange,
  error,
  savedFileName,
}: {
  onChange: (cv: CvInput | null) => void;
  error?: string;
  /** The account's saved CV; offers "Dùng CV đã lưu" when set. */
  savedFileName?: string | null;
}) {
  const id = useId();
  const [mode, setMode] = useState<Mode>('file');
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState('');
  const [problem, setProblem] = useState('');
  const modes: [Mode, string][] = [
    ['file', 'Tải file PDF'],
    ['link', 'Dán link'],
    ...(savedFileName ? ([['saved', 'Dùng CV đã lưu']] as [Mode, string][]) : []),
  ];
  const pick = (next: Mode) => {
    setMode(next);
    setProblem('');
    onChange(
      next === 'saved'
        ? { useSaved: true }
        : next === 'file' && file
          ? { file }
          : next === 'link' && link
            ? { link }
            : null,
    );
  };
  return (
    <div className="flex flex-col gap-2.5">
      <div role="group" aria-label="Cách gửi CV" className="flex flex-wrap gap-1.5">
        {modes.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={mode === key}
            onClick={() => pick(key)}
            className={`min-h-9 rounded-full border px-3 text-[13px] ${mode === key ? 'border-navy bg-navy font-semibold text-white' : 'border-field bg-white text-slate hover:bg-mist'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === 'file' && (
        <label
          htmlFor={id}
          className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-control border border-dashed px-3.5 py-2.5 text-sm hover:bg-mist ${problem || error ? 'border-error' : 'border-silver'}`}
        >
          <Icon name="upload" size={18} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1 truncate text-navy">
            {file ? file.name : 'Chọn file CV (PDF, tối đa 4 MB)'}
          </span>
          <input
            id={id}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(e) => {
              const next = e.target.files?.[0] ?? null;
              const why = next ? cvFileProblem(next) : null;
              setProblem(why ?? '');
              setFile(why ? null : next);
              onChange(next && !why ? { file: next } : null);
            }}
          />
        </label>
      )}
      {mode === 'link' && (
        <input
          type="url"
          value={link}
          placeholder="https://drive.google.com/…"
          aria-label="Link CV"
          onChange={(e) => {
            setLink(e.target.value);
            onChange(e.target.value.trim() ? { link: e.target.value.trim() } : null);
          }}
          className={`field-focus min-h-[46px] rounded-control border px-3.5 text-sm text-navy ${error ? 'border-error' : 'border-field'}`}
        />
      )}
      {mode === 'saved' && (
        <p className="m-0 flex items-center gap-2 rounded-control bg-mist px-3.5 py-3 text-sm text-navy">
          <Icon name="file" size={16} className="text-accent" /> {savedFileName}
        </p>
      )}
      <FieldError>{problem || error}</FieldError>
    </div>
  );
}
