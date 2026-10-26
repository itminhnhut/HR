import { ARTICLE_ALT_MAX, NEWS_COVER_MIN_WIDTH, type NewsCategoryDto, type NewsImage } from '@careers/shared';
import { useRef, useState, type RefObject } from 'react';
import { useUploadNewsImage } from '../../../api/queries';
import { SITE } from '../../../lib/site';
import { Button } from '../../../ui/Button';
import { FieldError, SelectField, TextField } from '../../../ui/Field';
import { Icon } from '../../../ui/icons';
import { errorMessage } from '../parts';
import { imageFileProblem } from './editor/rules';
import { shrinkImage } from './shrinkImage';
import { uploadPicture } from './uploadPicture';

/** A card in the right column of the editor page. */
export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-card border border-line bg-white p-4 sm:p-5">
      <h2 className="m-0 font-serif text-xl font-medium">{title}</h2>
      {children}
    </section>
  );
}

export function CategoryField({
  value,
  categories,
  error,
  onChange,
  onManage,
}: {
  value: string | null;
  categories: NewsCategoryDto[];
  error?: string;
  onChange: (id: string | null) => void;
  onManage: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <SelectField label="Chuyên mục" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Chọn chuyên mục</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <FieldError>{error}</FieldError>
      <button
        type="button"
        onClick={onManage}
        className="w-fit border-0 bg-transparent p-0 text-[13px] text-link underline"
      >
        {categories.length === 0 ? 'Chưa có chuyên mục, thêm chuyên mục' : 'Thêm hoặc đổi tên chuyên mục'}
      </button>
    </div>
  );
}

function HiddenImageInput({
  inputRef,
  onPicked,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  onPicked: (file: File) => void;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      hidden
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) onPicked(file);
      }}
    />
  );
}

function CoverPicker({ onPicked, busy }: { onPicked: (file: File) => void; busy: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files[0];
        if (file) onPicked(file);
      }}
      className={`flex flex-col items-center gap-2 rounded-control border border-dashed px-4 py-6 text-center ${over ? 'border-accent bg-tint' : 'border-silver bg-mist'}`}
    >
      <Icon name="image" size={26} stroke={1.3} className="text-accent" />
      <Button variant="outline" size="sm" icon="upload" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'Đang tải ảnh…' : 'Chọn ảnh bìa'}
      </Button>
      <span className="text-xs text-muted">
        hoặc kéo ảnh vào đây · JPEG, PNG, WebP · ảnh lớn tự thu nhỏ · nên ảnh ngang
      </span>
      <HiddenImageInput inputRef={input} onPicked={onPicked} />
    </div>
  );
}

/** Shrinks, checks and uploads a picked cover with its smaller copies; HR writes the alt text. */
function useCoverUpload(value: NewsImage | null, onChange: (cover: NewsImage | null) => void) {
  const upload = useUploadNewsImage();
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (file: File) => {
    setProblem(null);
    setBusy(true);
    try {
      const ready = await shrinkImage(file);
      const wrong = imageFileProblem(ready, file.name);
      if (wrong) return setProblem(wrong);
      const img = await uploadPicture(ready, upload.mutateAsync);
      // Alt is never guessed from the file name: HR describes the picture (it is checked before publishing).
      onChange({ ...img, alt: value?.alt ?? '' });
    } catch (e) {
      setProblem(errorMessage(e, 'Chưa tải được ảnh, thử lại.'));
    } finally {
      setBusy(false);
    }
  };
  return { pick: (file: File) => void pick(file), problem, busy };
}

/** Cover picture: required to publish, with alt text (Google Images, screen readers, share previews). */
export function CoverField({
  value,
  error,
  onChange,
}: {
  value: NewsImage | null;
  error?: string;
  onChange: (cover: NewsImage | null) => void;
}) {
  const { pick, problem, busy } = useCoverUpload(value, onChange);
  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium text-navy">Ảnh bìa</span>
      {value ? (
        <>
          <img
            src={value.url}
            alt=""
            width={value.width}
            height={value.height}
            style={{ maxWidth: value.width }}
            className="h-auto w-full rounded-control border border-line bg-line"
          />
          {value.width < NEWS_COVER_MIN_WIDTH && (
            <p role="status" className="m-0 flex items-start gap-1.5 text-[13px] text-body">
              <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-brand" />
              <span>
                Ảnh nhỏ hơn {NEWS_COVER_MIN_WIDTH}px sẽ mờ khi chia sẻ (ảnh này rộng {value.width}px). Nên chọn ảnh
                ngang từ {NEWS_COVER_MIN_WIDTH}px.
              </span>
            </p>
          )}
          <TextField
            label="Mô tả ảnh bìa (alt)"
            value={value.alt}
            maxLength={ARTICLE_ALT_MAX}
            onChange={(e) => onChange({ ...value, alt: e.target.value })}
            placeholder="Ví dụ: Đội ngũ TOP FLOW tại triển lãm ngành nước"
            error={!value.alt.trim() ? 'Nhập mô tả cho ảnh bìa.' : undefined}
            hint="Viết ngắn điều ảnh thể hiện."
          />
          <div className="flex flex-wrap gap-2">
            <CoverPickerButton onPicked={pick} busy={busy} />
            <Button variant="ghost" size="sm" icon="trash" onClick={() => onChange(null)}>
              Bỏ ảnh
            </Button>
          </div>
        </>
      ) : (
        <CoverPicker onPicked={pick} busy={busy} />
      )}
      <FieldError>{problem ?? error}</FieldError>
    </div>
  );
}

function CoverPickerButton({ onPicked, busy }: { onPicked: (file: File) => void; busy: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button variant="outline" size="sm" icon="upload" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'Đang tải ảnh…' : 'Đổi ảnh'}
      </Button>
      <HiddenImageInput inputRef={input} onPicked={onPicked} />
    </>
  );
}

export const siteHost = () => SITE.url.replace(/^https?:\/\//, '');

/** Roughly how Google shows the page in results. */
export function GooglePreview({ title, slug, description }: { title: string; slug: string; description: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-navy">Xem trước trên Google</span>
      <div
        aria-label="Kết quả trên Google"
        className="flex flex-col gap-1 rounded-control border border-line bg-white p-3.5 font-[arial,sans-serif]"
      >
        <span className="truncate text-[12px] text-[#4d5156]">
          {siteHost()} › tin-tuc › {slug || '…'}
        </span>
        <span className="line-clamp-2 text-[18px] leading-snug text-[#1a0dab]">
          {title ? `${title} · ${SITE.company}` : 'Tiêu đề bài viết'}
        </span>
        <span className="line-clamp-2 text-[13px] leading-normal text-[#4d5156]">
          {description || 'Mô tả lấy từ tóm tắt, hoặc đoạn đầu của bài nếu để trống.'}
        </span>
      </div>
    </div>
  );
}
