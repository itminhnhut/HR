import { APPLICATION_SOURCE_LABEL, HR_SOURCES, type ApplicationDetailDto, type HrSource } from '@careers/shared';
import { useState } from 'react';
import { ApiError, type CvInput } from '../../../api';
import { useApplicationEdit } from '../../../api/queries';
import { CvPicker } from '../../../site/CvPicker';
import { Button } from '../../../ui/Button';
import { SelectField, TextField } from '../../../ui/Field';
import { Icon } from '../../../ui/icons';
import { PhoneField } from '../../../ui/PhoneField';
import { errorMessage } from '../parts';
import { shortTime } from '../reviews/reviewModel';

const isHrSource = (v: string): v is HrSource => (HR_SOURCES as readonly string[]).includes(v);

function ReplaceCv({ app, onDone }: { app: ApplicationDetailDto; onDone: () => void }) {
  const { replaceCv } = useApplicationEdit(app.id);
  const [cv, setCv] = useState<CvInput | null>(null);
  const fieldError = replaceCv.error instanceof ApiError ? replaceCv.error.fieldErrors.cv : undefined;
  return (
    <div className="flex flex-col gap-2.5 rounded-control border border-line bg-white p-3.5">
      <CvPicker onChange={setCv} error={fieldError} />
      {replaceCv.error && !fieldError && (
        <span role="alert" className="text-[13px] text-error">
          {errorMessage(replaceCv.error)}
        </span>
      )}
      <span className="flex gap-2">
        <Button
          size="sm"
          disabled={!cv || replaceCv.isPending}
          onClick={() => cv && replaceCv.mutate(cv, { onSuccess: onDone })}
        >
          {replaceCv.isPending ? 'Đang lưu…' : 'Lưu CV'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Huỷ
        </Button>
      </span>
      <span className="text-xs text-muted">
        CV cũ sẽ bị xoá, lịch sử vẫn ghi lại tên file. Hệ thống chấm lại % khớp.
      </span>
    </div>
  );
}

/** Phone, email and source of an application HR added (a candidate's own one keeps what they sent). */
function EditContact({ app, onDone }: { app: ApplicationDetailDto; onDone: () => void }) {
  const { updateContact } = useApplicationEdit(app.id);
  const [phone, setPhone] = useState(app.phone);
  const [email, setEmail] = useState(app.email ?? '');
  const [source, setSource] = useState<HrSource>(isHrSource(app.source) ? app.source : 'other');
  const [referrer, setReferrer] = useState(app.referrer ?? '');
  const errors = updateContact.error instanceof ApiError ? updateContact.error.fieldErrors : {};
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        updateContact.mutate({ phone, email, source, referrer }, { onSuccess: onDone });
      }}
      className="grid gap-3 rounded-control border border-line bg-white p-3.5 sm:grid-cols-2"
    >
      <PhoneField label="Số điện thoại" value={phone} onChange={setPhone} error={errors.phone} />
      <TextField
        label="Email"
        optional
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
      />
      <SelectField
        label="Nguồn"
        value={source}
        onChange={(e) => isHrSource(e.target.value) && setSource(e.target.value)}
      >
        {HR_SOURCES.map((s) => (
          <option key={s} value={s}>
            {APPLICATION_SOURCE_LABEL[s]}
          </option>
        ))}
      </SelectField>
      {source === 'referral' && (
        <TextField
          label="Ai giới thiệu"
          value={referrer}
          onChange={(e) => setReferrer(e.target.value)}
          error={errors.referrer}
        />
      )}
      {updateContact.error && Object.keys(errors).length === 0 && (
        <span role="alert" className="text-[13px] text-error sm:col-span-2">
          {errorMessage(updateContact.error)}
        </span>
      )}
      <span className="flex gap-2 sm:col-span-2">
        <Button size="sm" type="submit" disabled={updateContact.isPending}>
          Lưu
        </Button>
        <Button size="sm" variant="ghost" type="button" onClick={onDone}>
          Huỷ
        </Button>
      </span>
    </form>
  );
}

function Origin({ app }: { app: ApplicationDetailDto }) {
  const parts = [
    `Nguồn: ${APPLICATION_SOURCE_LABEL[app.source]}`,
    app.referrer && `giới thiệu: ${app.referrer}`,
    app.addedBy && `HR thêm: ${app.addedBy}`,
    app.consentBy && `xác nhận đồng ý: ${app.consentBy}`,
  ].filter(Boolean);
  return <span className="text-xs text-slate">{parts.join(' · ')}</span>;
}

function History({ app }: { app: ApplicationDetailDto }) {
  if (app.cvHistory.length === 0) return null;
  return (
    <details className="text-[13px] text-slate">
      <summary className="cursor-pointer text-link">Lịch sử CV ({app.cvHistory.length})</summary>
      <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
        {app.cvHistory.map((h) => (
          <li key={h.at}>
            {shortTime(h.at)} · {h.by} đổi CV{h.previous ? ` (trước đó: ${h.previous})` : ' (trước đó chưa có CV)'}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** "CV": what is on file, where the application came from, add or replace it, its history (spec-cv-intake.md). */
export function CvPanel({ app }: { app: ApplicationDetailDto }) {
  const [editing, setEditing] = useState<'cv' | 'contact' | null>(null);
  const current = app.cvFileName && !app.cvLink ? app.cvFileName : app.cvLink;
  const latest = app.cvHistory[0];
  return (
    <section aria-label="CV" className="flex flex-col gap-2.5 rounded-control bg-mist px-3.5 py-3">
      {latest?.by === 'Ứng viên' && (
        <span className="flex items-center gap-2 rounded-control border border-cat-violet-line bg-cat-violet-soft px-3 py-2 text-[13px] font-medium text-cat-violet">
          <Icon name="upload" size={15} /> Ứng viên cập nhật CV lúc {shortTime(latest.at)}
        </span>
      )}
      <div className="flex flex-wrap items-center gap-2.5">
        <Icon name="file" size={16} className="shrink-0 text-accent" />
        <span className={`min-w-0 flex-1 truncate text-[13px] ${current ? 'font-medium text-navy' : 'text-error'}`}>
          {current ?? 'Chưa có CV'}
        </span>
        {editing !== 'cv' && (
          <Button size="sm" variant="outline" icon={current ? 'pencil' : 'plus'} onClick={() => setEditing('cv')}>
            {current ? 'Đổi CV' : 'Thêm CV'}
          </Button>
        )}
      </div>
      {editing === 'cv' && <ReplaceCv app={app} onDone={() => setEditing(null)} />}
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Origin app={app} />
        {app.addedBy && editing !== 'contact' && (
          <button
            type="button"
            onClick={() => setEditing('contact')}
            className="border-0 bg-transparent p-0 text-xs text-link underline"
          >
            Sửa liên hệ
          </button>
        )}
      </span>
      {editing === 'contact' && <EditContact app={app} onDone={() => setEditing(null)} />}
      <History app={app} />
    </section>
  );
}
