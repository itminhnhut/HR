import { normalizeVietnamPhone, REFERRAL_SOURCE, type ApplicationDetailDto, type CvGender } from '@careers/shared';
import { useState } from 'react';
import { ApiError } from '../../../api';
import { useApplicationEdit } from '../../../api/queries';
import { Button } from '../../../ui/Button';
import { TextField } from '../../../ui/Field';
import { PhoneField } from '../../../ui/PhoneField';
import { errorMessage } from '../parts';
import { SourceSelect } from '../sources/SourceSelect';
import { DetailDrawer } from './DetailDrawer';

const GENDERS: { value: CvGender | null; label: string }[] = [
  { value: null, label: 'Theo CV' },
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
];

function GenderPick({ value, onChange }: { value: CvGender | null; onChange: (v: CvGender | null) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span id="gender-label" className="text-sm font-medium text-navy">
        Giới tính
      </span>
      <div role="radiogroup" aria-labelledby="gender-label" className="flex">
        {GENDERS.map((g) => (
          <button
            key={g.label}
            type="button"
            role="radio"
            aria-checked={value === g.value}
            onClick={() => onChange(g.value)}
            className={`-ml-px min-h-11 flex-1 border px-3 text-sm first:ml-0 first:rounded-l-control last:rounded-r-control lg:min-h-10 ${value === g.value ? 'z-[1] border-navy bg-navy font-semibold text-white' : 'border-silver bg-white text-navy hover:bg-mist'}`}
          >
            {g.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * "Sửa thông tin": name, phone, email and gender of any application; source and referrer only on one HR added
 * (a candidate's own one has the website as its source). Every change is logged with what was there before.
 */
export function EditApplicantDrawer({
  app,
  open,
  onClose,
}: {
  app: ApplicationDetailDto;
  open: boolean;
  onClose: () => void;
}) {
  const { updateContact } = useApplicationEdit(app.id);
  const isAddedByHr = !!app.addedBy;
  const [fullName, setFullName] = useState(app.fullName);
  const [phone, setPhone] = useState(app.phone);
  const [email, setEmail] = useState(app.email ?? '');
  const [gender, setGender] = useState<CvGender | null>(app.hrGender);
  const [source, setSource] = useState(app.source);
  const [referrer, setReferrer] = useState(app.referrer ?? '');
  const [isAsking, setIsAsking] = useState(false);
  const errors = updateContact.error instanceof ApiError ? updateContact.error.fieldErrors : {};
  const isDirty =
    fullName !== app.fullName ||
    phone !== app.phone ||
    email !== (app.email ?? '') ||
    gender !== app.hrGender ||
    source !== app.source ||
    referrer !== (app.referrer ?? '');
  const phoneMoved = !isAddedByHr && (normalizeVietnamPhone(phone) ?? phone) !== app.phone;
  const close = () => {
    updateContact.reset();
    setIsAsking(false);
    onClose();
  };
  const askToClose = () => (isDirty ? setIsAsking(true) : close());
  return (
    <DetailDrawer open={open} onClose={askToClose} title="Sửa thông tin" subtitle={`${app.fullName} · ${app.jobTitle}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const input = { fullName, phone, email, gender, ...(isAddedByHr ? { source, referrer } : {}) };
          updateContact.mutate(input, { onSuccess: close });
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 max-sm:px-4">
          <TextField
            label="Họ tên"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={errors.fullName}
          />
          <PhoneField label="Số điện thoại" value={phone} onChange={setPhone} error={errors.phone} />
          {phoneMoved && (
            <p role="status" className="m-0 rounded-control bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
              Ứng viên tự nộp hồ sơ này: đổi số thì ứng viên tra cứu bằng số cũ sẽ không thấy hồ sơ nữa.
            </p>
          )}
          <TextField
            label="Email"
            optional
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
          <GenderPick value={gender} onChange={setGender} />
          {isAddedByHr && (
            <>
              <SourceSelect
                label="Nguồn"
                value={source}
                onChange={setSource}
                current={app.source}
                error={errors.source}
              />
              {source === REFERRAL_SOURCE && (
                <TextField
                  label="Ai giới thiệu"
                  value={referrer}
                  onChange={(e) => setReferrer(e.target.value)}
                  error={errors.referrer}
                />
              )}
            </>
          )}
          <p className="m-0 text-xs text-muted">Mỗi ô đổi được ghi vào Nhật ký hồ sơ, kèm giá trị cũ.</p>
          {updateContact.error && Object.keys(errors).length === 0 && (
            <span role="alert" className="text-[13px] text-error">
              {errorMessage(updateContact.error)}
            </span>
          )}
        </div>
        <footer className="flex flex-none flex-wrap items-center gap-2 border-t border-line px-5 py-3 max-sm:px-4">
          {isAsking ? (
            <>
              <span className="mr-auto text-sm text-navy">Chưa lưu thay đổi.</span>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() => setIsAsking(false)}
                className="max-lg:min-h-11"
              >
                Tiếp tục sửa
              </Button>
              <Button size="sm" variant="outline" type="button" onClick={close} className="max-lg:min-h-11">
                Bỏ thay đổi
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                type="submit"
                disabled={updateContact.isPending || !isDirty}
                className="max-lg:min-h-11"
              >
                Lưu
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={askToClose} className="max-lg:min-h-11">
                Huỷ
              </Button>
            </>
          )}
        </footer>
      </form>
    </DetailDrawer>
  );
}
