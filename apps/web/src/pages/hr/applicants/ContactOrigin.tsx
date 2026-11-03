import { REFERRAL_SOURCE, sourceName, type ApplicationDetailDto } from '@careers/shared';
import { useState } from 'react';
import { ApiError } from '../../../api';
import { useApplicationEdit, useSources } from '../../../api/queries';
import { Button } from '../../../ui/Button';
import { TextField } from '../../../ui/Field';
import { PhoneField } from '../../../ui/PhoneField';
import { errorMessage } from '../parts';
import { SourceSelect } from '../sources/SourceSelect';

/** Phone, email and source of an application HR added (a candidate's own one keeps what they sent). */
function EditContact({ app, onDone }: { app: ApplicationDetailDto; onDone: () => void }) {
  const { updateContact } = useApplicationEdit(app.id);
  const [phone, setPhone] = useState(app.phone);
  const [email, setEmail] = useState(app.email ?? '');
  const [source, setSource] = useState(app.source);
  const [referrer, setReferrer] = useState(app.referrer ?? '');
  const errors = updateContact.error instanceof ApiError ? updateContact.error.fieldErrors : {};
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        updateContact.mutate({ phone, email, source, referrer }, { onSuccess: onDone });
      }}
      className="flex flex-col gap-3 rounded-control border border-line bg-white p-3.5"
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
      <SourceSelect label="Nguồn" value={source} onChange={setSource} current={app.source} error={errors.source} />
      {source === REFERRAL_SOURCE && (
        <TextField
          label="Ai giới thiệu"
          value={referrer}
          onChange={(e) => setReferrer(e.target.value)}
          error={errors.referrer}
        />
      )}
      {updateContact.error && Object.keys(errors).length === 0 && (
        <span role="alert" className="text-[13px] text-error">
          {errorMessage(updateContact.error)}
        </span>
      )}
      <span className="flex gap-2">
        <Button size="sm" type="submit" disabled={updateContact.isPending} className="max-lg:min-h-11">
          Lưu
        </Button>
        <Button size="sm" variant="ghost" type="button" onClick={onDone} className="max-lg:min-h-11">
          Huỷ
        </Button>
      </span>
    </form>
  );
}

/** Where the application came from, who added it, and "Sửa liên hệ" for one HR added. */
export function ContactOrigin({ app }: { app: ApplicationDetailDto }) {
  const sources = useSources().data ?? [];
  const [isEditing, setIsEditing] = useState(false);
  const parts = [
    `Nguồn: ${sourceName(sources, app.source)}`,
    app.referrer && `giới thiệu: ${app.referrer}`,
    app.addedBy && `HR thêm: ${app.addedBy}`,
    app.consentBy && `xác nhận đồng ý: ${app.consentBy}`,
  ].filter(Boolean);
  return (
    <div className="flex flex-col gap-2">
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-xs text-slate">{parts.join(' · ')}</span>
        {app.addedBy && !isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="border-0 bg-transparent p-0 text-xs text-link underline max-lg:min-h-11"
          >
            Sửa liên hệ
          </button>
        )}
      </span>
      {isEditing && <EditContact app={app} onDone={() => setIsEditing(false)} />}
    </div>
  );
}
