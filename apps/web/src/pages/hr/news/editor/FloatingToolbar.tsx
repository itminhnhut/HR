import { $isCodeNode } from '@lexical/code-core';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $findMatchingParent,
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  type LexicalEditor,
  type TextFormatType,
} from 'lexical';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { OPEN_LINK_DIALOG_COMMAND } from './commands';
import { IconGlyph, mod, ToolButton } from './toolbar/primitives';
import { useToolbarState } from './toolbar/state';
import { TextColorMenu } from './toolbar/StyleMenus';

/**
 * A small bar above selected words (the playground's FloatingTextFormatToolbarPlugin): bold, italic,
 * underline, strikethrough, inline code, link, text colour. It sits above the selection, or below it when
 * that would cover the sticky main toolbar, so it never hides the words or the toolbar's buttons. Desktop
 * only: phones use the main toolbar.
 */

const GAP = 10;
/** No main toolbar on screen (phones scroll it away): stay clear of the very top of the window. */
const MIN_TOP = 8;

/** The bottom of the sticky main toolbar (data-editor-toolbar) on screen, so the bar never covers it. */
function toolbarBottom(editor: LexicalEditor): number {
  const box = editor.getRootElement()?.closest('.field-focus')?.querySelector('[data-editor-toolbar]');
  const bottom = box?.getBoundingClientRect().bottom ?? 0;
  return Math.max(MIN_TOP, bottom + GAP);
}

/**
 * Above the selection when there is room below the main toolbar, else below the selection (flipped). Pure,
 * so it can be checked without a browser.
 */
export function floatingTop(selection: { top: number; bottom: number }, barHeight: number, limit: number): number {
  const above = selection.top - barHeight - GAP;
  return above >= limit ? above : Math.max(limit, selection.bottom + GAP);
}

/** Words selected in the editor, outside code: the bar shows. */
function $hasWordSelection(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || selection.isCollapsed()) return false;
  if ($findMatchingParent(selection.anchor.getNode(), $isCodeNode)) return false;
  return selection.getTextContent().trim() !== '';
}

function selectionRect(editor: LexicalEditor): DOMRect | null {
  const root = editor.getRootElement();
  const dom = window.getSelection();
  if (!root || !dom || dom.rangeCount === 0 || !root.contains(dom.anchorNode)) return null;
  const rect = dom.getRangeAt(0).getBoundingClientRect();
  return rect.width || rect.height ? rect : null;
}

/** Focus is in the text, or in one of the bar's menus (the colour menu takes focus while open). */
function isEditing(editor: LexicalEditor): boolean {
  const active = document.activeElement;
  return !!active && (!!editor.getRootElement()?.contains(active) || !!active.closest('[role="menu"]'));
}

function useSelectionRect(editor: LexicalEditor) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const update = useCallback(() => {
    const show = isEditing(editor) && editor.getEditorState().read($hasWordSelection);
    setRect(show ? selectionRect(editor) : null);
  }, [editor]);
  useEffect(() => {
    const stop = editor.registerUpdateListener(() => update());
    // A frame later, so a click on a menu has moved focus before the check.
    const later = () => window.requestAnimationFrame(update);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    document.addEventListener('focusin', later);
    document.addEventListener('focusout', later);
    return () => {
      stop();
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', later);
      document.removeEventListener('focusout', later);
    };
  }, [editor, update]);
  return rect;
}

function usePlacement(editor: LexicalEditor, bar: React.RefObject<HTMLDivElement | null>, rect: DOMRect | null) {
  useLayoutEffect(() => {
    const box = bar.current;
    if (!box || !rect) return;
    const top = floatingTop(rect, box.offsetHeight, toolbarBottom(editor));
    const left = Math.max(
      8,
      Math.min(rect.left + rect.width / 2 - box.offsetWidth / 2, window.innerWidth - box.offsetWidth - 8),
    );
    box.style.top = `${top}px`;
    box.style.left = `${left}px`;
  }, [editor, bar, rect]);
}

export function FloatingToolbar() {
  const [editor] = useLexicalComposerContext();
  const state = useToolbarState();
  const rect = useSelectionRect(editor);
  const bar = useRef<HTMLDivElement>(null);
  usePlacement(editor, bar, rect);
  if (!rect) return null;
  // z-30: above the sticky toolbar (z-[15]), under every open dropdown (z-40), its own colour menu included.
  const format = (f: TextFormatType) => editor.dispatchCommand(FORMAT_TEXT_COMMAND, f);
  return createPortal(
    <div
      ref={bar}
      role="toolbar"
      aria-label="Định dạng chữ đã chọn"
      className="fixed z-30 flex animate-fade items-center gap-0.5 rounded-card border border-line bg-white p-1 shadow-[0_10px_30px_rgba(11,31,58,0.16)]"
    >
      <ToolButton label="Đậm" shortcut={`${mod}+B`} pressed={state.bold} onClick={() => format('bold')}>
        <span className="font-bold">B</span>
      </ToolButton>
      <ToolButton label="Nghiêng" shortcut={`${mod}+I`} pressed={state.italic} onClick={() => format('italic')}>
        <span className="font-serif italic">I</span>
      </ToolButton>
      <ToolButton label="Gạch chân" shortcut={`${mod}+U`} pressed={state.underline} onClick={() => format('underline')}>
        <span className="underline">U</span>
      </ToolButton>
      <ToolButton label="Gạch ngang" pressed={state.strikethrough} onClick={() => format('strikethrough')}>
        <IconGlyph name="strike" />
      </ToolButton>
      <ToolButton label="Mã (code) trong dòng" pressed={state.code} onClick={() => format('code')}>
        <IconGlyph name="code" />
      </ToolButton>
      <ToolButton
        label={state.link ? 'Sửa link' : 'Chèn link'}
        pressed={!!state.link}
        onClick={() => editor.dispatchCommand(OPEN_LINK_DIALOG_COMMAND, undefined)}
      >
        <IconGlyph name="link" />
      </ToolButton>
      <TextColorMenu state={state} />
    </div>,
    document.body,
  );
}
