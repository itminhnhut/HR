import { createCommand, type LexicalCommand, type NodeKey } from 'lexical';
import type { ImageDetails } from './ImageNode';

/** Sets an image's alt text, caption and layout (from its popover); clears its "ask for alt" flag. */
export const SET_IMAGE_DETAILS_COMMAND: LexicalCommand<{ key: NodeKey } & ImageDetails> =
  createCommand('SET_IMAGE_DETAILS_COMMAND');

/** Opens one of the insert dialogs (outside the editable area); `key` edits an existing CTA button. */
export type EditorDialog =
  { kind: 'youtube' } | { kind: 'table' } | { kind: 'layout' } | { kind: 'cta'; key?: NodeKey };
export const OPEN_DIALOG_COMMAND: LexicalCommand<EditorDialog> = createCommand('OPEN_DIALOG_COMMAND');

/** Uploads and inserts image files (toolbar button; drops and pastes go through DRAG_DROP_PASTE). */
export const UPLOAD_IMAGES_COMMAND: LexicalCommand<File[]> = createCommand('UPLOAD_IMAGES_COMMAND');

/** A message under the toolbar: uploads in progress, what went wrong, or what the editor just did. */
export interface EditorStatus {
  tone: 'busy' | 'error' | 'info';
  text: string;
}

/** Shows (or clears, with null) the message under the toolbar. */
export const SHOW_STATUS_COMMAND: LexicalCommand<EditorStatus | null> = createCommand('SHOW_STATUS_COMMAND');

/** "Chèn": FAQ, columns (one of LAYOUT_COLUMNS), the contents block, a code block. */
export const INSERT_FAQ_COMMAND: LexicalCommand<void> = createCommand('INSERT_FAQ_COMMAND');
export const INSERT_LAYOUT_COMMAND: LexicalCommand<string> = createCommand('INSERT_LAYOUT_COMMAND');
export const INSERT_TOC_COMMAND: LexicalCommand<void> = createCommand('INSERT_TOC_COMMAND');
export const INSERT_CODE_COMMAND: LexicalCommand<void> = createCommand('INSERT_CODE_COMMAND');

/** Moves the "Mục lục" block one block up or down (its ↑ / ↓ buttons, Alt+↑ / Alt+↓). */
export const MOVE_TOC_COMMAND: LexicalCommand<{ key: NodeKey; direction: 'up' | 'down' }> =
  createCommand('MOVE_TOC_COMMAND');

/** Opens the picture file picker (the "/" menu's "Ảnh"; the toolbar's "Chèn → Ảnh" clicks it directly). */
export const OPEN_IMAGE_PICKER_COMMAND: LexicalCommand<void> = createCommand('OPEN_IMAGE_PICKER_COMMAND');

/** Opens the link dialog (the floating toolbar's link button). */
export const OPEN_LINK_DIALOG_COMMAND: LexicalCommand<void> = createCommand('OPEN_LINK_DIALOG_COMMAND');
