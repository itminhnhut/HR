import { cleanTags, NEWS_TAG_MAX, NEWS_TAGS_MAX, toSlug } from '@careers/shared';
import { useDeferredValue, useId, useState, type KeyboardEvent } from 'react';
import { useNewsTagSuggestions } from '../../../api/queries';
import { FieldError } from '../../../ui/Field';
import { Icon } from '../../../ui/icons';

/** Suggestions not already on the post. */
function useSuggestions(text: string, chosen: string[], open: boolean) {
  const query = useDeferredValue(text.replace(/^#/, ''));
  const taken = new Set(chosen.map((t) => toSlug(t, '')));
  const { data } = useNewsTagSuggestions(query, open);
  return (data?.tags ?? []).filter((t) => !taken.has(t.slug)).slice(0, 8);
}

function Chips({ tags, onRemove }: { tags: string[]; onRemove: (tag: string) => void }) {
  return (
    <>
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-tint py-0.5 pl-2.5 pr-1 text-sm text-navy"
        >
          #{tag}
          <button
            type="button"
            onClick={() => onRemove(tag)}
            aria-label={`Bỏ hashtag ${tag}`}
            className="inline-flex size-7 items-center justify-center rounded-full border-0 bg-transparent text-slate hover:bg-white"
          >
            <Icon name="x" size={14} />
          </button>
        </span>
      ))}
    </>
  );
}

interface Suggestion {
  name: string;
  slug: string;
  postCount: number;
}

function SuggestionList({
  id,
  items,
  active,
  onPick,
}: {
  id: string;
  items: Suggestion[];
  active: number;
  onPick: (name: string) => void;
}) {
  return (
    <ul
      id={id}
      role="listbox"
      aria-label="Hashtag gợi ý"
      className="absolute top-full z-20 m-0 mt-1 w-full list-none rounded-card border border-line bg-white p-1 shadow-[0_10px_30px_rgba(11,31,58,0.12)]"
    >
      {items.map((t, i) => (
        <li
          key={t.slug}
          id={`${id}-${i}`}
          role="option"
          aria-selected={i === active}
          // mousedown: pick before the input loses focus and closes the list.
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(t.name);
          }}
          className={`flex min-h-10 cursor-pointer items-center justify-between rounded-control px-3 text-sm ${i === active ? 'bg-tint' : 'hover:bg-mist'}`}
        >
          <span>#{t.name}</span>
          <span className="text-xs text-muted">{t.postCount} bài</span>
        </li>
      ))}
    </ul>
  );
}

/** Typing, Enter/comma to add, arrows through suggestions, Backspace on empty removes the last tag. */
function useTagInput(value: string[], onChange: (tags: string[]) => void) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const suggestions = useSuggestions(text, value, open);

  const add = (raw: string[]) => {
    onChange(cleanTags([...value, ...raw]).slice(0, NEWS_TAGS_MAX));
    setText('');
    setActive(-1);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // A Vietnamese input method (Telex/VNI, phone keyboards) uses Enter, Backspace and ","-like keys while it is
    // still composing a word: leave those to it, or "sống" turns into an extra "sôngs" tag.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => Math.max(-1, Math.min(suggestions.length - 1, i + step)));
    } else if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const picked = suggestions[active]?.name ?? text;
      if (picked.trim()) add([picked]);
    } else if (e.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1));
    } else if (e.key === 'Escape') setOpen(false);
  };
  const onText = (raw: string) => {
    const parts = raw.split(',');
    if (parts.length > 1) add(parts.slice(0, -1));
    setText(parts[parts.length - 1] ?? '');
    setActive(-1);
  };
  return { text, open, setOpen, active, suggestions, add, onKeyDown, onText };
}

function TagInput({
  id,
  listId,
  input,
  full,
  expanded,
  count,
}: {
  id: string;
  listId: string;
  input: ReturnType<typeof useTagInput>;
  full: boolean;
  expanded: boolean;
  count: number;
}) {
  return (
    <input
      id={id}
      role="combobox"
      aria-expanded={expanded}
      aria-controls={listId}
      aria-autocomplete="list"
      aria-activedescendant={input.active >= 0 ? `${listId}-${input.active}` : undefined}
      aria-describedby={`${id}-hint`}
      value={input.text}
      disabled={full}
      maxLength={NEWS_TAG_MAX + 1}
      placeholder={full ? `Đã đủ ${NEWS_TAGS_MAX} hashtag` : count ? 'Thêm…' : 'Ví dụ: #đờisống, phỏng vấn'}
      onChange={(e) => input.onText(e.target.value)}
      onKeyDown={input.onKeyDown}
      onFocus={() => input.setOpen(true)}
      onBlur={() => input.setOpen(false)}
      className="min-w-[120px] flex-1 border-0 bg-transparent px-1 text-[15px] text-navy outline-none placeholder:text-placeholder"
    />
  );
}

/**
 * Hashtags as chips: type "#tag" or "tag", then Enter or a comma. Suggestions come from tags already used
 * (most used first). At most 10.
 */
export function TagsField({
  value,
  onChange,
  error,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  error?: string;
}) {
  const id = useId();
  const input = useTagInput(value, onChange);
  const full = value.length >= NEWS_TAGS_MAX;
  const listId = `${id}-list`;
  const showList = input.open && !full && input.suggestions.length > 0;
  const box = error ? 'border-error' : 'border-field';

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-navy">
        Hashtag <span className="font-normal text-muted">(không bắt buộc)</span>
      </label>
      <div
        className={`field-focus flex min-h-11 flex-wrap items-center gap-1.5 rounded-control border bg-white px-2 py-1.5 ${box}`}
      >
        <Chips tags={value} onRemove={(tag) => onChange(value.filter((t) => t !== tag))} />
        <TagInput id={id} listId={listId} input={input} full={full} expanded={showList} count={value.length} />
      </div>
      {showList && (
        <SuggestionList id={listId} items={input.suggestions} active={input.active} onPick={(n) => input.add([n])} />
      )}
      <span id={`${id}-hint`} className="text-xs text-muted">
        Gõ rồi nhấn Enter hoặc dấu phẩy. Tối đa {NEWS_TAGS_MAX} hashtag.
      </span>
      <FieldError>{error}</FieldError>
    </div>
  );
}
