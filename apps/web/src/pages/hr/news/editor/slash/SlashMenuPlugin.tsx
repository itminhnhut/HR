import { $isCodeNode } from '@lexical/code-core';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/extension';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
  type MenuRenderFn,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import { $isTableCellNode } from '@lexical/table';
import { $findMatchingParent, $getSelection, $isRangeSelection, type LexicalEditor, type TextNode } from 'lexical';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../../../../ui/icons';
import { $isCollapsibleContentNode, $isCollapsibleTitleNode } from '../CollapsibleNodes';
import {
  INSERT_FAQ_COMMAND,
  INSERT_LAYOUT_COMMAND,
  INSERT_TOC_COMMAND,
  OPEN_DIALOG_COMMAND,
  OPEN_IMAGE_PICKER_COMMAND,
} from '../commands';
import { $isLayoutItemNode } from '../LayoutNodes';
import { applyChoice, HeadingGlyph } from '../toolbar/BlockMenu';
import { slashItemsFor, type SlashContext, type SlashItem } from './slashItems';

/**
 * "/" opens a menu of blocks at the caret (Notion-like; the Lexical playground's ComponentPickerPlugin).
 * Choosing one removes "/query" and runs the same command as the toolbar, so every rule of the article
 * still applies. No menu in a code block or an FAQ question; inside a table cell, a column or an answer
 * only the blocks allowed there are listed.
 */

class SlashOption extends MenuOption {
  item: SlashItem;
  constructor(item: SlashItem) {
    super(item.id);
    this.item = item;
  }
}

/** Where the caret is, for the menu (null: no menu here). */
function $slashContext(): SlashContext | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  const node = selection.anchor.getNode();
  if ($findMatchingParent(node, (n) => $isCodeNode(n) || $isCollapsibleTitleNode(n))) return null;
  if ($findMatchingParent(node, $isTableCellNode)) return 'cell';
  if ($findMatchingParent(node, (n) => $isLayoutItemNode(n) || $isCollapsibleContentNode(n))) return 'box';
  return 'root';
}

/** Runs inside the menu's update, after the "/query" text is gone. */
function runAction(editor: LexicalEditor, item: SlashItem) {
  const { action } = item;
  if (typeof action === 'object') return editor.dispatchCommand(INSERT_LAYOUT_COMMAND, action.layout);
  switch (action) {
    case 'toc':
      return editor.dispatchCommand(INSERT_TOC_COMMAND, undefined);
    case 'faq':
      return editor.dispatchCommand(INSERT_FAQ_COMMAND, undefined);
    case 'table':
    case 'youtube':
    case 'cta':
      return editor.dispatchCommand(OPEN_DIALOG_COMMAND, { kind: action });
    case 'image':
      return editor.dispatchCommand(OPEN_IMAGE_PICKER_COMMAND, undefined);
    case 'hr':
      return editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined);
    default:
      return applyChoice(editor, action, 'paragraph');
  }
}

function ItemIcon({ icon }: { icon: SlashItem['icon'] }) {
  if (icon === 'h2' || icon === 'h3' || icon === 'h4') return <HeadingGlyph level={Number(icon[1]) as 2 | 3 | 4} />;
  return <Icon name={icon} size={18} stroke={1.7} />;
}

const renderMenu: MenuRenderFn<SlashOption> = (
  anchor,
  { options, selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
) => {
  if (!anchor.current) return null;
  return createPortal(
    <div className="slash-menu" role="listbox" aria-label="Chèn khối">
      {options.length === 0 ? (
        <p className="m-0 px-3 py-2.5 text-sm text-muted">Không tìm thấy khối</p>
      ) : (
        options.map((option, i) => (
          <div
            key={option.key}
            ref={option.setRefElement}
            id={`slash-item-${i}`}
            role="option"
            tabIndex={-1}
            aria-selected={selectedIndex === i}
            onMouseEnter={() => setHighlightedIndex(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => selectOptionAndCleanUp(option)}
            className={`flex cursor-pointer items-center gap-3 rounded-control px-2.5 py-2 ${selectedIndex === i ? 'bg-tint' : ''}`}
          >
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-control border border-line bg-white text-slate">
              <ItemIcon icon={option.item.icon} />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-navy">{option.item.title}</span>
              <span className="truncate text-xs text-muted">{option.item.hint}</span>
            </span>
          </div>
        ))
      )}
    </div>,
    anchor.current,
  );
};

/** Follows the caret's place, so the menu lists only the blocks allowed there. */
function useSlashContext(editor: LexicalEditor) {
  const [context, setContext] = useState<SlashContext | null>('root');
  const latest = useRef(context);
  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) => {
        latest.current = editorState.read($slashContext);
        setContext(latest.current);
      }),
    [editor],
  );
  return { context, latest };
}

export function SlashMenuPlugin() {
  const [editor] = useLexicalComposerContext();
  const { context, latest } = useSlashContext(editor);
  const [query, setQuery] = useState<string | null>(null);
  const basicMatch = useBasicTypeaheadTriggerMatch('/', { minLength: 0, allowWhitespace: true, maxLength: 30 });
  const options = useMemo(
    () => (context ? slashItemsFor(query ?? '', context).map((item) => new SlashOption(item)) : []),
    [query, context],
  );
  const triggerFn = useCallback(
    (text: string, ed: LexicalEditor) => {
      const where = latest.current;
      if (!where) return null;
      const match = basicMatch(text, ed);
      // "/ some words" that match nothing is just text: stop showing the menu once a space follows.
      if (match && /\s/.test(match.matchingString) && slashItemsFor(match.matchingString, where).length === 0) {
        return null;
      }
      return match;
    },
    [basicMatch, latest],
  );
  const onSelect = useCallback(
    (option: SlashOption, textNode: TextNode | null, close: () => void) => {
      editor.update(() => {
        textNode?.remove();
        runAction(editor, option.item);
        close();
      });
    },
    [editor],
  );
  return (
    <LexicalTypeaheadMenuPlugin<SlashOption>
      onQueryChange={setQuery}
      onSelectOption={onSelect}
      triggerFn={triggerFn}
      options={options}
      menuRenderFn={renderMenu}
      anchorClassName="slash-menu-anchor"
    />
  );
}
