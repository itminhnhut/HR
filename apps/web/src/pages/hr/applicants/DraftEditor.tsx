import type { ApplicationDetailDto, MessageTemplate } from '@careers/shared';
import { useState } from 'react';
import { Icon } from '../../../ui/icons';
import { sectionsFor } from '../mail/mailSections';
import type { MailDraft } from './useMailDraft';

export function DraftNotices({ draft }: { draft: MailDraft }) {
  return (
    <>
      {draft.stale && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-tint px-4 py-3 text-sm text-navy">
          <span>Bạn đã sửa tay nội dung thư, nên thông tin mới chưa được điền vào.</span>
          <button
            type="button"
            onClick={draft.rebuild}
            className="min-h-10 rounded-control border border-silver bg-white px-3 font-medium text-navy hover:bg-mist"
          >
            Điền lại thông tin mới vào thư
          </button>
        </div>
      )}
      {draft.missing.length > 0 && (
        <div role="note" className="rounded-control border border-[#e8d27a] bg-[#fff8db] px-4 py-3 text-sm text-navy">
          Còn thiếu: <strong className="font-semibold">{draft.missing.join(', ')}</strong>. Điền vào các ô tô vàng ở
          trên, hoặc sửa thẳng trong thư.
        </div>
      )}
    </>
  );
}

const boxClass = (hasGap: boolean) =>
  `field-focus w-full rounded-control border px-3.5 text-sm text-navy outline-none ${hasGap ? 'border-[#e8d27a] bg-[#fff8db]' : 'border-field bg-white'}`;

/**
 * The filled text of the mail, part by part; only the parts this template uses. It looks at the template, not
 * at the text, so a part does not vanish while HR is clearing it. A part still holding "{…}" is tinted like the
 * empty boxes above it.
 */
export function DraftEditor({
  app,
  template,
  draft,
}: {
  app: ApplicationDetailDto;
  template: MessageTemplate;
  draft: MailDraft;
}) {
  const hasGap = (text: string) => draft.missing.some((token) => text.includes(token));
  const sections = sectionsFor(template.key).filter((s) => template[s.field].trim() !== '');
  const [isOpen, setOpen] = useState(false);
  // The preview beside it already shows the text, so it stays folded unless a token still needs replacing.
  const isShown = isOpen || sections.some(({ field }) => hasGap(draft.content[field]));
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Gửi tới</span>
        <span className="text-sm font-medium text-navy">{app.email ?? 'Ứng viên không để lại email'}</span>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Tiêu đề</span>
        <input
          value={draft.content.subject}
          onChange={(e) => draft.edit({ subject: e.target.value })}
          className={`${boxClass(hasGap(draft.content.subject))} min-h-11`}
        />
      </label>
      <button
        type="button"
        aria-expanded={isShown}
        onClick={() => setOpen(!isOpen)}
        className="flex min-h-11 items-center justify-between gap-2 rounded-control border border-field bg-white px-3.5 text-sm font-medium text-navy hover:bg-mist"
      >
        Sửa nội dung thư
        <Icon name="chevronDown" size={16} className={isShown ? 'rotate-180' : ''} />
      </button>
      <div className={`flex flex-col gap-4 ${isShown ? '' : 'hidden'}`}>
        {sections.map(({ field, label, rows }) => (
          <label key={field} className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">{label}</span>
            {rows === 1 ? (
              <input
                value={draft.content[field]}
                onChange={(e) => draft.edit({ [field]: e.target.value })}
                className={`${boxClass(hasGap(draft.content[field]))} min-h-11`}
              />
            ) : (
              <textarea
                rows={rows}
                value={draft.content[field]}
                onChange={(e) => draft.edit({ [field]: e.target.value })}
                className={`${boxClass(hasGap(draft.content[field]))} py-3 leading-relaxed`}
              />
            )}
          </label>
        ))}
      </div>
    </>
  );
}
