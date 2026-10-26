import { formatTimestamp, type HrUserDto, type TempPasswordResponse } from '@careers/shared';
import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api';
import { useChangePassword, useHrMe, useHrUserAction, useHrUsers, useUpdateProfile } from '../../api/queries';
import { usePageMeta } from '../../lib/hooks';
import { Button } from '../../ui/Button';
import { CopyButton } from '../../ui/CopyButton';
import { FieldError, TextField } from '../../ui/Field';
import { ErrorState, LoadingStatus, Notice, Sk, useDelayedFlag } from '../../ui/feedback';
import { Icon } from '../../ui/icons';
import { apiMessage, Avatar, errorMessage, PageHeading } from './parts';

/** Shown once after creating or resetting: HR copies it and sends it privately. */
function TempPassword({ result, onDone }: { result: TempPasswordResponse; onDone: () => void }) {
  return (
    <div role="status" className="flex flex-col gap-3 rounded-card border border-ok-line bg-ok-soft px-5 py-4 text-sm">
      <span className="text-navy">
        Mật khẩu tạm của <strong className="font-semibold">{result.user.email}</strong>. Chỉ hiện một lần: sao chép rồi
        gửi riêng cho người đó (Zalo, gặp trực tiếp). Họ nên đổi mật khẩu sau khi đăng nhập.
      </span>
      <span className="flex items-center gap-2">
        <code className="rounded-control bg-white px-3 py-2 font-mono text-[15px] tracking-wide text-navy">
          {result.password}
        </code>
        <CopyButton text={result.password} label="mật khẩu" />
      </span>
      <Button variant="outline" size="sm" onClick={onDone} className="self-start">
        Đã gửi, ẩn mật khẩu
      </Button>
    </div>
  );
}

function UserRow({
  user,
  onTempPassword,
  onError,
}: {
  user: HrUserDto;
  onTempPassword: (r: TempPasswordResponse) => void;
  onError: (msg: string) => void;
}) {
  const { reset, remove } = useHrUserAction();
  const [confirm, setConfirm] = useState<'reset' | 'remove' | null>(null);
  const ask = (kind: 'reset' | 'remove', run: () => void) =>
    confirm === kind ? (setConfirm(null), run()) : setConfirm(kind);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line-soft px-5 py-4 last:border-b-0">
      <Avatar name={user.name || user.email} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold text-navy">
          {user.name || user.email}
          {user.isMe && (
            <span className="ml-2 rounded-full bg-tint px-2 py-0.5 text-xs font-medium text-accent">Bạn</span>
          )}
        </span>
        <span className="text-[13px] text-slate">{user.email}</span>
        <span className="text-xs text-muted">
          {user.lastLoginAt ? `Đăng nhập gần nhất ${formatTimestamp(user.lastLoginAt)}` : 'Chưa đăng nhập lần nào'}
        </span>
      </span>
      {!user.isMe && (
        <span className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            icon="lock"
            disabled={reset.isPending}
            onClick={() =>
              ask('reset', () =>
                reset.mutate(user.id, { onSuccess: onTempPassword, onError: (e) => onError(errorMessage(e)) }),
              )
            }
          >
            {confirm === 'reset' ? 'Bấm lần nữa để đặt lại' : 'Đặt lại mật khẩu'}
          </Button>
          <Button
            variant={confirm === 'remove' ? 'danger' : 'ghost'}
            size="sm"
            icon="trash"
            disabled={remove.isPending}
            onClick={() => ask('remove', () => remove.mutate(user.id, { onError: (e) => onError(errorMessage(e)) }))}
          >
            {confirm === 'remove' ? 'Bấm lần nữa để xoá' : 'Xoá'}
          </Button>
        </span>
      )}
    </li>
  );
}

function AddUser({ onCreated }: { onCreated: (r: TempPasswordResponse) => void }) {
  const { create } = useHrUserAction();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    create.mutate(
      { email, name },
      {
        onSuccess: (r) => {
          setEmail('');
          setName('');
          onCreated(r);
        },
        onError: (err) => setErrors(err instanceof ApiError ? err.fieldErrors : { form: errorMessage(err) }),
      },
    );
  };
  return (
    <form
      noValidate
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-card border border-line bg-white px-5 py-5 sm:px-6"
    >
      <h2 className="m-0 font-serif text-xl font-medium">Thêm tài khoản HR</h2>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <TextField
          label="Email đăng nhập"
          type="email"
          autoComplete="off"
          value={email}
          error={errors.email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Tên hiển thị"
          optional
          value={name}
          error={errors.name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <FieldError>{errors.form}</FieldError>
      <Button type="submit" icon="plus" disabled={create.isPending || !email.trim()} className="self-start">
        {create.isPending ? 'Đang tạo…' : 'Tạo tài khoản'}
      </Button>
      <span className="text-xs text-muted">
        Mọi tài khoản HR đều có toàn quyền. Mật khẩu tạm hiện một lần sau khi tạo.
      </span>
    </form>
  );
}

/** What goes into {Tên HR} / {SĐT HR}, and the mailbox Gmail should send from. */
function SenderProfile() {
  const me = useHrMe();
  const update = useUpdateProfile();
  const [name, setName] = useState(me.data?.name ?? '');
  const [phone, setPhone] = useState(me.data?.phone ?? '');
  const [contactEmail, setContactEmail] = useState(me.data?.contactEmail ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setDone(false);
    update.mutate(
      { name, phone, contactEmail },
      {
        onSuccess: () => setDone(true),
        onError: (err) => setErrors(err instanceof ApiError ? err.fieldErrors : { form: errorMessage(err) }),
      },
    );
  };
  return (
    <form
      noValidate
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-card border border-line bg-white px-5 py-5 sm:px-6"
    >
      <div className="flex flex-col gap-1">
        <h2 className="m-0 font-serif text-xl font-medium">Thông tin người gửi của bạn</h2>
        <p className="m-0 text-[13px] text-slate">
          Điền vào chữ ký mẫu thư: {'{Tên HR}'}, {'{SĐT HR}'}.
        </p>
      </div>
      <div className="grid gap-3.5 sm:grid-cols-3">
        <TextField label="Tên hiển thị" value={name} error={errors.name} onChange={(e) => setName(e.target.value)} />
        <TextField
          label="Số điện thoại / Zalo"
          type="tel"
          inputMode="tel"
          value={phone}
          error={errors.phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <TextField
          label="Email gửi thư"
          type="email"
          hint="Gmail thật của bạn, để ứng viên trả lời."
          value={contactEmail}
          error={errors.contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
        />
      </div>
      <FieldError>{errors.form}</FieldError>
      {done && (
        <span role="status" className="inline-flex items-center gap-1.5 text-sm text-ok">
          <Icon name="check" size={16} />
          Đã lưu.
        </span>
      )}
      <Button type="submit" icon="check" disabled={update.isPending} className="self-start">
        {update.isPending ? 'Đang lưu…' : 'Lưu thông tin'}
      </Button>
    </form>
  );
}

function ChangeOwnPassword() {
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setDone(false);
    change.mutate(
      { current, next },
      {
        onSuccess: () => {
          setCurrent('');
          setNext('');
          setDone(true);
        },
        onError: (err) =>
          setErrors(err instanceof ApiError ? { form: err.message, ...err.fieldErrors } : { form: errorMessage(err) }),
      },
    );
  };
  const type = show ? 'text' : 'password';
  return (
    <form
      noValidate
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-card border border-line bg-white px-5 py-5 sm:px-6"
    >
      <h2 className="m-0 font-serif text-xl font-medium">Đổi mật khẩu của bạn</h2>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <TextField
          label="Mật khẩu hiện tại"
          type={type}
          autoComplete="current-password"
          value={current}
          error={errors.current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <TextField
          label="Mật khẩu mới"
          type={type}
          autoComplete="new-password"
          hint="Ít nhất 12 ký tự, không chứa email."
          value={next}
          error={errors.next}
          onChange={(e) => setNext(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-body">
        <input
          type="checkbox"
          checked={show}
          onChange={(e) => setShow(e.target.checked)}
          className="size-[18px] accent-accent"
        />
        Hiện mật khẩu
      </label>
      {!errors.current && !errors.next && <FieldError>{errors.form}</FieldError>}
      {done && (
        <span role="status" className="inline-flex items-center gap-1.5 text-sm text-ok">
          <Icon name="check" size={16} />
          Đã đổi mật khẩu.
        </span>
      )}
      <Button type="submit" icon="lock" disabled={change.isPending || !current || !next} className="self-start">
        {change.isPending ? 'Đang lưu…' : 'Đổi mật khẩu'}
      </Button>
    </form>
  );
}

export function HrAccountsPage() {
  usePageMeta('Tài khoản HR');
  const users = useHrUsers();
  const me = useHrMe();
  const showSkeleton = useDelayedFlag(users.isPending);
  const [temp, setTemp] = useState<TempPasswordResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <PageHeading
        title="Tài khoản HR"
        titleHiddenOnPhone
        subtitle="Thêm người, đặt lại mật khẩu khi ai đó quên, hoặc xoá tài khoản người đã nghỉ."
      />
      <div className="flex max-w-[860px] flex-col gap-5">
        {temp && <TempPassword result={temp} onDone={() => setTemp(null)} />}
        {error && (
          <Notice tone="error" icon="alert">
            <span role="alert">{error}</span>
          </Notice>
        )}
        {users.isPending && (
          <>
            <LoadingStatus />
            {showSkeleton && <Sk w="100%" h={180} />}
          </>
        )}
        {users.isError && <ErrorState onRetry={() => users.refetch()} message={apiMessage(users.error)} />}
        {users.data && (
          <ul className="m-0 list-none rounded-card border border-line bg-white p-0">
            {users.data.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                onTempPassword={(r) => {
                  setError(null);
                  setTemp(r);
                }}
                onError={setError}
              />
            ))}
          </ul>
        )}
        <AddUser
          onCreated={(r) => {
            setError(null);
            setTemp(r);
          }}
        />
        {me.data && <SenderProfile key={me.data.id} />}
        <ChangeOwnPassword />
      </div>
    </>
  );
}

export default HrAccountsPage;
