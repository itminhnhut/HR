import { useState } from 'react';
import { DialogButtons, DialogHead } from './EmbedDialogs';
import { LAYOUT_CHOICES } from './rules';

/** A small drawing of the columns at their widths ("1fr 3fr" → a narrow box then a wide one). */
function LayoutSketch({ template }: { template: string }) {
  return (
    <span aria-hidden="true" className="grid h-9 w-full gap-1" style={{ gridTemplateColumns: template }}>
      {template.split(' ').map((_, i) => (
        <span key={i} className="rounded-[3px] border border-silver bg-tint" />
      ))}
    </span>
  );
}

/**
 * "Bố cục cột": the six layouts the site renders, as radio cards with a sketch. On phones every layout
 * shows as one column, one under the other.
 */
export function LayoutForm({ onSubmit, onClose }: { onSubmit: (template: string) => void; onClose: () => void }) {
  const [template, setTemplate] = useState(LAYOUT_CHOICES[0]?.template ?? '1fr 1fr');
  return (
    <form
      className="flex flex-col gap-4 p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(template);
      }}
    >
      <DialogHead title="Chèn bố cục cột" onClose={onClose} />
      <fieldset className="m-0 grid grid-cols-2 gap-2.5 border-0 p-0 sm:grid-cols-3">
        <legend className="mb-2 text-sm text-slate">Chọn số cột và độ rộng. Trên điện thoại các cột xếp dọc.</legend>
        {LAYOUT_CHOICES.map((choice, i) => (
          <label
            key={choice.template}
            className="flex min-h-11 cursor-pointer flex-col gap-2 rounded-control border border-line p-2.5 text-[13px] leading-snug text-navy has-[:checked]:border-accent has-[:checked]:bg-mist has-[:checked]:ring-2 has-[:checked]:ring-accent/20 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus"
          >
            <input
              type="radio"
              name="layout"
              value={choice.template}
              checked={template === choice.template}
              onChange={() => setTemplate(choice.template)}
              autoFocus={i === 0}
              className="sr-only"
            />
            <LayoutSketch template={choice.template} />
            {choice.label}
          </label>
        ))}
      </fieldset>
      <DialogButtons submit="Chèn bố cục" onClose={onClose} />
    </form>
  );
}
