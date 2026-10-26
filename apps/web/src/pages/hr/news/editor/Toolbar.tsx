import type { EditorStatus } from './commands';
import { ClearFormatButton, HistoryButtons, TextFormatButtons } from './toolbar/BlockControls';
import { BlockMenu } from './toolbar/BlockMenu';
import { FontFamilyMenu, FontSizeStepper } from './toolbar/FontControls';
import { FormatMenu } from './toolbar/FormatMenu';
import { InsertControls } from './toolbar/InsertMenu';
import { LinkControl } from './toolbar/LinkControl';
import { Divider } from './toolbar/primitives';
import { useToolbarState } from './toolbar/state';
import { AlignMenu, HighlightMenu, TextColorMenu } from './toolbar/StyleMenus';
import { TableBar } from './toolbar/TableBar';

/**
 * The Lexical playground's toolbar, in its order: undo/redo · block type · font · size · B I U, inline code,
 * link, clear formatting · text colour, highlight, "Aa" · "+ Chèn" · alignment and indentation. Wide editors
 * wrap it onto a second row; phones keep one row that scrolls sideways (with a fade at the right edge). A
 * table bar appears while the caret is in a table.
 */
export function Toolbar({ status }: { status: EditorStatus | null }) {
  const state = useToolbarState();
  return (
    <div
      data-editor-toolbar
      className="@container sticky top-[68px] z-[15] rounded-t-control border-b border-line bg-white lg:top-0"
    >
      <div
        role="toolbar"
        aria-label="Định dạng"
        className="scroll-fade-x flex flex-nowrap items-center gap-0.5 overflow-x-auto px-2 py-1.5 [scrollbar-width:none] @[640px]:flex-wrap @[640px]:overflow-visible @[640px]:[mask-image:none] [&::-webkit-scrollbar]:hidden"
      >
        <HistoryButtons />
        <Divider />
        <BlockMenu state={state} />
        <Divider />
        <FontFamilyMenu state={state} />
        <FontSizeStepper state={state} />
        <Divider />
        <TextFormatButtons state={state} />
        <LinkControl link={state.link} />
        <ClearFormatButton />
        <Divider />
        <TextColorMenu state={state} />
        <HighlightMenu state={state} />
        <FormatMenu state={state} />
        <Divider />
        <InsertControls />
        <Divider />
        <AlignMenu state={state} />
      </div>
      {state.inTable && <TableBar />}
      <p
        aria-live="polite"
        className={`m-0 px-3 text-[13px] ${status ? 'pb-2' : 'sr-only'} ${status?.tone === 'error' ? 'text-error' : 'text-slate'}`}
      >
        {status?.text ?? ''}
      </p>
    </div>
  );
}
