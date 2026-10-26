import { DEFAULT_FONT_SIZE, FONT_FAMILIES, FONT_SIZES } from '@careers/shared';
import { $patchStyleText } from '@lexical/selection';
import { $getSelection } from 'lexical';
import { useEffect, useRef, useState } from 'react';
import { nearestFontSize } from '../rules';
import { IconGlyph, MenuItem, ToolButton, ToolMenu, useKeepSelection } from './primitives';
import type { ToolbarState } from './state';

/**
 * Font and size, as the playground's toolbar, limited to the site's presets (shared FONT_FAMILIES and
 * FONT_SIZES): the normal font and size are stored as nothing.
 */

const SIZES = FONT_SIZES.map((s) => s.px);

function $patchStyle(patch: Record<string, string | null>) {
  const selection = $getSelection();
  if (selection) $patchStyleText(selection, patch);
}

const $setSize = (px: number) =>
  $patchStyle({ 'font-size': px === DEFAULT_FONT_SIZE ? null : `${nearestFontSize(px)}px` });

export function FontFamilyMenu({ state }: { state: ToolbarState }) {
  const current = FONT_FAMILIES.find((f) => f.key === state.fontFamily) ?? FONT_FAMILIES[0];
  return (
    <ToolMenu
      label={`Phông chữ: ${current?.label ?? 'Mặc định'}`}
      trigger={
        <span className="w-[72px] truncate text-left text-sm">{current?.key === 'serif' ? 'Có chân' : 'Mặc định'}</span>
      }
    >
      {(run) =>
        FONT_FAMILIES.map((family) => (
          <MenuItem
            key={family.key}
            checked={family.key === state.fontFamily}
            onClick={() => run(() => $patchStyle({ 'font-family': family.key === 'default' ? null : family.css }))}
          >
            <span style={{ fontFamily: family.css }}>{family.label}</span>
          </MenuItem>
        ))
      }
    </ToolMenu>
  );
}

/** "− 16 +": steps through the presets; a typed number snaps to the nearest one. */
export function FontSizeStepper({ state }: { state: ToolbarState }) {
  const keep = useKeepSelection();
  const size = state.fontSize;
  const [draft, setDraft] = useState(size ? String(size) : '');
  useEffect(() => setDraft(size ? String(size) : ''), [size]);
  // What Enter just applied: the blur that follows (focus back to the text) must not apply it again.
  const committed = useRef<string | null>(null);
  const at = SIZES.indexOf(size ?? DEFAULT_FONT_SIZE);
  const step = (by: number) => {
    const next = SIZES[Math.min(SIZES.length - 1, Math.max(0, (at < 0 ? SIZES.indexOf(DEFAULT_FONT_SIZE) : at) + by))];
    if (next) keep.run(() => $setSize(next));
  };
  const commit = () => {
    const typed = Number(draft);
    if (!Number.isFinite(typed) || typed <= 0) return setDraft(size ? String(size) : '');
    const next = nearestFontSize(typed);
    committed.current = draft;
    setDraft(String(next));
    keep.run(() => $setSize(next));
  };
  return (
    <span role="group" aria-label="Cỡ chữ" className="inline-flex shrink-0 items-center">
      <ToolButton label="Giảm cỡ chữ" disabled={at === 0} onClick={() => step(-1)}>
        <IconGlyph name="minus" />
      </ToolButton>
      <input
        aria-label="Cỡ chữ (14–24)"
        title="Cỡ chữ: 14, 16, 18, 20 hoặc 24"
        inputMode="numeric"
        value={draft}
        placeholder="–"
        onMouseDown={(e) => {
          // Remember the text selection before the box takes focus.
          keep.save();
          e.stopPropagation();
        }}
        onFocus={keep.save}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          commit();
        }}
        onBlur={(e) => {
          const justCommitted = committed.current === e.target.value;
          committed.current = null;
          if (!justCommitted && Number(e.target.value) !== size) commit();
        }}
        className="h-8 w-10 rounded-control border border-field bg-white text-center text-sm text-navy outline-none focus-visible:border-accent"
      />
      <ToolButton label="Tăng cỡ chữ" disabled={at === SIZES.length - 1} onClick={() => step(1)}>
        <IconGlyph name="plus" />
      </ToolButton>
    </span>
  );
}
