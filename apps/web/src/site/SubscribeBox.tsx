import { DEPARTMENTS } from '@careers/shared';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../api';
import { useSubscribe } from '../api/queries';
import { Checkbox, FieldError } from '../ui/Field';
import { Icon } from '../ui/icons';

/** BR-10: phone + department, with its own consent tick. */
export function SubscribeBox({
  department,
  fromJobId,
  compact,
}: {
  department: string;
  fromJobId?: string;
  compact?: boolean;
}) {
  const subscribe = useSubscribe();
  const [phone, setPhone] = useState('');
  const [dep, setDep] = useState(department || DEPARTMENTS[0]);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (phone.replace(/\D/g, '').length < 9) return setError('Nhập số Zalo hợp lệ.');
    if (!agree) return setError('Cần tích ô đồng ý để nhận tin.');
    setError(null);
    subscribe.mutate(
      { phone, department: dep, fromJobId, consent: true },
      {
        onError: (err) =>
          setError(
            err instanceof ApiError ? (Object.values(err.fieldErrors)[0] ?? err.message) : 'Chưa gửi được, thử lại.',
          ),
      },
    );
  };

  if (subscribe.isSuccess) {
    return (
      <p role="status" className="m-0 flex items-center gap-2.5 text-[15px] font-medium text-ok">
        <Icon name="check" size={20} stroke={1.8} />
        Đã đăng ký. Bạn sẽ nhận tin qua Zalo khi có vị trí {dep} mới.
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={`flex w-full flex-col gap-2.5 text-left ${compact ? 'mx-auto max-w-[480px]' : ''}`}
    >
      <div className="flex flex-col gap-2.5 sm:flex-row">
        {!department && (
          <label className="relative flex min-h-[52px] items-center rounded-control border border-field bg-white px-3.5">
            <span className="sr-only">Phòng ban</span>
            <select
              value={dep}
              onChange={(e) => setDep(e.target.value as typeof dep)}
              className="appearance-none border-0 bg-transparent pr-6 text-[15px] text-navy outline-none"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <Icon name="chevronDown" size={16} className="pointer-events-none absolute right-3 text-slate" />
          </label>
        )}
        <label className="field-focus flex min-h-[52px] flex-1 items-center gap-2.5 rounded-control border border-field bg-white px-4">
          <Icon name="chat" size={18} stroke={1.5} className="text-muted" />
          <span className="sr-only">Số Zalo</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Số Zalo của bạn"
            className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-navy outline-none placeholder:text-muted"
          />
        </label>
        <button
          type="submit"
          disabled={subscribe.isPending}
          className="btn-glow min-h-[52px] shrink-0 whitespace-nowrap rounded-control border-0 bg-navy px-6 text-[15px] font-medium text-white disabled:opacity-60"
        >
          {subscribe.isPending ? 'Đang gửi…' : 'Nhận thông báo'}
        </button>
      </div>
      <Checkbox checked={agree} onChange={(e) => setAgree(e.target.checked)}>
        Đồng ý để HR lưu số này và nhắn khi có việc mới. Hủy bất cứ lúc nào.{' '}
        <Link to="/chinh-sach-du-lieu">Chính sách</Link>
      </Checkbox>
      <FieldError>{error}</FieldError>
    </form>
  );
}
