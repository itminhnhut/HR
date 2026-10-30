import {
  REFERRAL_SOURCE,
  APPLICATION_STATUS_LABEL,
  formatTimestamp,
  type DuplicateApplicationDto,
} from '@careers/shared';
import { useState, type FormEvent } from 'react';
import { api, ApiError, type CvInput } from '../../../api';
import { useAddApplication, useHrJobs } from '../../../api/queries';
import { CvPicker } from '../../../site/CvPicker';
import { Button } from '../../../ui/Button';
import { CloseButton, Dialog } from '../../../ui/Dialog';
import { Checkbox, FieldError, SelectField, TextArea, TextField } from '../../../ui/Field';
import { Notice } from '../../../ui/feedback';
import { PhoneField } from '../../../ui/PhoneField';
import { errorMessage } from '../parts';
import { SourceSelect } from '../sources/SourceSelect';
import { FROM_CV_HINT, useCvAutofill, type CvField } from './useCvAutofill';

/** The existing application the API points to when this phone already applied for this job. */
function existingOf(error: unknown): DuplicateApplicationDto | null {
  if (!(error instanceof ApiError) || error.code !== 'duplicate') return null;
  const existing: unknown = error.details.existing;
  const ok = typeof existing === 'object' && existing !== null && 'id' in existing && typeof existing.id === 'string';
  return ok ? (existing as DuplicateApplicationDto) : null;
}

function Duplicate({
  existing,
  cv,
  onOpen,
}: {
  existing: DuplicateApplicationDto;
  cv: CvInput | null;
  onOpen: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const updateCv = async () => {
    if (!cv) return;
    setBusy(true);
    try {
      await api.hrReplaceCv(existing.id, cv);
      onOpen(existing.id);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };
  return (
    <Notice tone="remind" icon="alert">
      <span role="alert" className="flex flex-col gap-2">
        <span>
          Đã có hồ sơ của <b>{existing.fullName}</b> cho vị trí này (nộp {formatTimestamp(existing.createdAt)},{' '}
          {APPLICATION_STATUS_LABEL[existing.status]}).
        </span>
        <span className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" type="button" onClick={() => onOpen(existing.id)}>
            Mở hồ sơ đó
          </Button>
          {cv && (
            <Button size="sm" type="button" disabled={busy} onClick={updateCv}>
              Cập nhật CV vào hồ sơ đó
            </Button>
          )}
        </span>
        {error && <span className="text-error">{error}</span>}
      </span>
    </Notice>
  );
}

/** "Thêm hồ sơ": an application HR received by email, Zalo, a referral or a job site (spec-cv-intake.md). */
export function AddApplicationDialog({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (id: string) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} label="Thêm hồ sơ" variant="panel">
      {open && <AddForm onClose={onClose} onAdded={onAdded} />}
    </Dialog>
  );
}

type Autofill = ReturnType<typeof useCvAutofill>;

/** The CV comes first: picking a PDF reads the name, phone and email into the boxes below. */
function CvSection({
  autofill,
  onChange,
  error,
}: {
  autofill: Autofill;
  onChange: (cv: CvInput | null) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-2 sm:col-span-2">
      <span className="text-sm font-medium text-navy">
        CV <span className="font-normal text-muted">(không bắt buộc, thêm sau được)</span>
      </span>
      <CvPicker onChange={onChange} error={error} />
      {autofill.note && (
        <p role="status" className="m-0 text-[13px] leading-relaxed text-muted">
          {autofill.note}
        </p>
      )}
    </div>
  );
}

/** Họ và tên, SĐT, Email: a box filled from the CV says so until HR edits it. */
function ContactFields({ autofill, errors }: { autofill: Autofill; errors: Record<string, string | undefined> }) {
  const { values, edit, isFromCv } = autofill;
  const fromCv = (field: CvField) => (isFromCv(field) ? FROM_CV_HINT : undefined);
  return (
    <>
      <TextField
        label="Họ và tên"
        value={values.fullName}
        onChange={(e) => edit('fullName')(e.target.value)}
        error={errors.fullName}
        hint={fromCv('fullName')}
      />
      <PhoneField
        label="Số điện thoại"
        value={values.phone}
        onChange={edit('phone')}
        error={errors.phone}
        hint={fromCv('phone')}
      />
      <TextField
        label="Email"
        optional
        type="email"
        value={values.email}
        onChange={(e) => edit('email')(e.target.value)}
        error={errors.email}
        hint={
          fromCv('email') ??
          'Có email thì ứng viên đăng nhập Google bằng email đó sẽ thấy hồ sơ và tự cập nhật CV được.'
        }
        className="sm:col-span-2"
      />
    </>
  );
}

function AddForm({ onClose, onAdded }: { onClose: () => void; onAdded: (id: string) => void }) {
  const jobs = (useHrJobs().data?.jobs ?? []).filter((j) => j.status !== 'draft');
  const add = useAddApplication();
  const autofill = useCvAutofill();
  const [form, setForm] = useState({ jobId: '', source: '', referrer: '', note: '' });
  const [cv, setCv] = useState<CvInput | null>(null);
  const [consent, setConsent] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const existing = existingOf(add.error);

  const [local, setLocal] = useState<Record<string, string>>({});
  const errors = { ...(add.error instanceof ApiError ? add.error.fieldErrors : {}), ...local };
  const pickCv = (next: CvInput | null) => {
    setCv(next);
    // Only a picked PDF is read; a link is not.
    if (next && 'file' in next) void autofill.readCv(next.file);
    else autofill.forgetCv();
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    // The two choices the server needs in a typed form: checked here, the rest by the server.
    const missing = {
      ...(form.source ? {} : { source: 'Chọn nguồn hồ sơ.' }),
      ...(consent ? {} : { consent: 'Xác nhận ứng viên đã đồng ý trước khi lưu.' }),
    };
    setLocal(missing);
    if (!form.source || !consent) return;
    add.mutate(
      {
        ...form,
        ...autofill.values,
        source: form.source,
        cvLink: cv && 'link' in cv ? cv.link : '',
        cvFile: cv && 'file' in cv ? cv.file : null,
        consent: true,
      },
      { onSuccess: ({ id }) => onAdded(id) },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="flex max-h-dvh flex-col sm:max-h-[calc(100dvh-48px)]">
      <header className="flex items-center gap-3 border-b border-line px-5 py-4 sm:px-7">
        <h2 className="m-0 flex-1 font-serif text-[24px] font-medium">Thêm hồ sơ</h2>
        <CloseButton onClick={onClose} />
      </header>
      <div className="grid flex-1 gap-4 overflow-y-auto px-5 py-5 sm:grid-cols-2 sm:px-7">
        <CvSection autofill={autofill} onChange={pickCv} error={errors.cv ?? errors.cvLink} />
        <div className="flex flex-col gap-1 sm:col-span-2">
          <SelectField label="Vị trí ứng tuyển" value={form.jobId} onChange={(e) => set('jobId')(e.target.value)}>
            <option value="">Chọn vị trí…</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
                {j.status === 'closed' || j.status === 'expired' ? ' (đã đóng)' : ''}
              </option>
            ))}
          </SelectField>
          <FieldError>{errors.jobId}</FieldError>
        </div>
        <div className={`flex flex-col gap-1 ${form.source === REFERRAL_SOURCE ? '' : 'sm:col-span-2'}`}>
          <SourceSelect value={form.source} onChange={set('source')} error={errors.source} />
        </div>
        {form.source === REFERRAL_SOURCE && (
          <TextField
            label="Ai giới thiệu"
            value={form.referrer}
            onChange={(e) => set('referrer')(e.target.value)}
            error={errors.referrer}
            placeholder="Anh Tuấn (kho)"
          />
        )}
        <ContactFields autofill={autofill} errors={errors} />
        <TextArea
          label="Ghi chú nội bộ"
          optional
          rows={2}
          value={form.note}
          onChange={(e) => set('note')(e.target.value)}
          className="sm:col-span-2"
        />
        <div className="rounded-control bg-mist px-3.5 py-3 sm:col-span-2">
          <Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} error={errors.consent}>
            <b className="text-navy">Ứng viên đã chủ động gửi CV và đồng ý cho công ty dùng để tuyển dụng.</b> Chỉ tích
            khi ứng viên tự gửi CV để ứng tuyển. Hệ thống lưu tên bạn là người xác nhận.
          </Checkbox>
        </div>
      </div>
      <footer className="flex flex-col gap-3 border-t border-line bg-white px-5 py-4 sm:px-7">
        {existing && <Duplicate existing={existing} cv={cv} onOpen={onAdded} />}
        {add.error && !existing && Object.keys(errors).length === 0 && (
          <Notice tone="error" icon="alert">
            <span role="alert">{errorMessage(add.error)}</span>
          </Notice>
        )}
        <div className="flex flex-wrap justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" icon="plus" disabled={add.isPending}>
            {add.isPending ? 'Đang lưu…' : 'Lưu hồ sơ'}
          </Button>
        </div>
      </footer>
    </form>
  );
}
