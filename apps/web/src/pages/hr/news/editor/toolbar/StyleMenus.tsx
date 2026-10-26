import type { PaletteColor } from '@careers/shared';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $patchStyleText } from '@lexical/selection';
import {
  $getSelection,
  FORMAT_ELEMENT_COMMAND,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  type ElementFormatType,
} from 'lexical';
import type { IconName } from '../../../../../ui/icons';
import { OFFERED_HIGHLIGHTS, OFFERED_TEXT_COLORS, type Align } from '../rules';
import { IconGlyph, keepFocus, MenuHeading, MenuItem, ToolMenu, type MenuRun } from './primitives';
import type { ToolbarState } from './state';

const ALIGNS: [Exclude<Align, ''>, string, IconName][] = [
  ['left', 'Căn trái', 'alignLeft'],
  ['center', 'Căn giữa', 'alignCenter'],
  ['right', 'Căn phải', 'alignRight'],
  ['justify', 'Căn đều hai bên', 'alignJustify'],
];

const sameHex = (a: string, b: string) => a.trim().toLowerCase() === b.toLowerCase();

/** Writes a palette colour as Lexical does: `color: <hex>` / `background-color: <hex>`, nothing else. */
function patchStyle(patch: Record<string, string | null>) {
  const selection = $getSelection();
  if (selection) $patchStyleText(selection, patch);
}

type ColorKind = 'color' | 'background-color';

function Swatches({
  title,
  colors,
  current,
  kind,
  run,
}: {
  title: string;
  colors: readonly PaletteColor[];
  current: string;
  kind: ColorKind;
  run: MenuRun;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 px-2 pb-1 pt-1">
      {colors.map((c) => (
        <button
          key={c.key}
          type="button"
          role="menuitemradio"
          aria-checked={sameHex(current, c.hex)}
          aria-label={`${title}: ${c.label}`}
          title={c.label}
          onMouseDown={keepFocus}
          onClick={() => run(() => patchStyle({ [kind]: c.hex }))}
          className={`inline-flex size-10 items-center justify-center rounded-control border text-[15px] font-semibold ${sameHex(current, c.hex) ? 'border-navy ring-2 ring-focus/40' : 'border-line'}`}
          style={kind === 'color' ? { color: c.hex } : { background: c.hex }}
        >
          {kind === 'color' ? 'A' : ''}
        </button>
      ))}
    </div>
  );
}

/** Text colour: the six palette colours (shared TEXT_COLORS), rendered as tc-<key> classes on the page. */
export function TextColorMenu({ state }: { state: ToolbarState }) {
  const bar = state.color || '#0b1f3a';
  return (
    <ToolMenu
      label="Màu chữ"
      trigger={
        <span className="inline-flex flex-col items-center leading-none">
          <span className="text-[15px] font-semibold">A</span>
          <span aria-hidden="true" className="mt-0.5 h-[3px] w-4 rounded-full" style={{ background: bar }} />
        </span>
      }
    >
      {(run) => (
        <>
          <MenuHeading>Màu chữ</MenuHeading>
          <Swatches title="Màu chữ" colors={OFFERED_TEXT_COLORS} current={state.color} kind="color" run={run} />
          <MenuItem icon="x" onClick={() => run(() => patchStyle({ color: null }))}>
            Bỏ màu chữ
          </MenuItem>
        </>
      )}
    </ToolMenu>
  );
}

/** Highlight: the four soft palette colours (shared HIGHLIGHT_COLORS), to mark a key phrase. */
export function HighlightMenu({ state }: { state: ToolbarState }) {
  return (
    <ToolMenu label="Màu nền chữ (tô sáng)" trigger={<IconGlyph name="highlighter" />}>
      {(run) => (
        <>
          <MenuHeading>Tô sáng</MenuHeading>
          <Swatches
            title="Màu nền"
            colors={OFFERED_HIGHLIGHTS}
            current={state.highlight}
            kind="background-color"
            run={run}
          />
          <MenuItem icon="x" onClick={() => run(() => patchStyle({ 'background-color': null }))}>
            Bỏ tô sáng
          </MenuItem>
        </>
      )}
    </ToolMenu>
  );
}

const alignIcon = (align: Align): IconName => ALIGNS.find(([a]) => a === align)?.[2] ?? 'alignLeft';

/** Alignment and indentation (up to 4 steps), as the playground's align menu. */
export function AlignMenu({ state }: { state: ToolbarState }) {
  const [editor] = useLexicalComposerContext();
  return (
    <ToolMenu label="Căn lề và thụt lề" trigger={<IconGlyph name={alignIcon(state.align)} />}>
      {(run: MenuRun) => (
        <>
          {ALIGNS.map(([align, label, icon]) => (
            <MenuItem
              key={align}
              icon={icon}
              checked={(state.align || 'left') === align}
              onClick={() => run(() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, align as ElementFormatType))}
            >
              {label}
            </MenuItem>
          ))}
          <MenuHeading>Thụt lề</MenuHeading>
          <MenuItem
            icon="indent"
            disabled={!state.canIndent}
            onClick={() => run(() => editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined))}
          >
            Thụt lề vào
          </MenuItem>
          <MenuItem
            icon="outdent"
            disabled={state.indent === 0}
            onClick={() => run(() => editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined))}
          >
            Bỏ thụt lề
          </MenuItem>
        </>
      )}
    </ToolMenu>
  );
}
