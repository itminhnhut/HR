import { ApiError } from '../../../api';

/**
 * What the save line says when a save is refused, and what still blocks publishing in the article itself.
 * Pure functions: the autosave hook, the action bar and the publish checks use them.
 */

const TOO_LONG = /^Too big: expected string to have <=(\d+) characters$/;

/** The schema's own messages are Vietnamese; a few default ones (from zod) are English. */
export function vietnameseContentError(message: string): string {
  const tooLong = TOO_LONG.exec(message);
  if (tooLong) {
    const max = Number(tooLong[1]).toLocaleString('vi-VN');
    return `Một đoạn chữ dài quá ${max} ký tự, hãy tách thành nhiều đoạn.`;
  }
  // Plain ASCII: an English message nobody wrote for HR.
  if (/^[\x20-\x7e]*$/.test(message)) {
    return 'Có một phần nội dung trình soạn chưa xử lý được. Hoàn tác (Ctrl+Z) thao tác vừa rồi rồi thử lại.';
  }
  return message;
}

/** "Nội dung bài: Ảnh cần mô tả (alt)." — the reason itself, never only "kiểm tra các ô được đánh dấu". */
export function saveErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Kiểm tra mạng rồi thử lại.';
  const { content, ...others } = error.fieldErrors;
  if (content) return `Nội dung bài: ${vietnameseContentError(content)}`;
  const first = Object.values(others)[0];
  return first ?? (error.message || 'Kiểm tra mạng rồi thử lại.');
}

interface JsonNode {
  type?: unknown;
  altPending?: unknown;
  children?: unknown;
}

function countPending(node: JsonNode | null | undefined): number {
  if (!node || typeof node !== 'object') return 0;
  const self = node.type === 'article-image' && node.altPending === true ? 1 : 0;
  const children = Array.isArray(node.children) ? (node.children as JsonNode[]) : [];
  return children.reduce((sum, child) => sum + countPending(child), self);
}

/** Pictures saved with the placeholder description (ImageNode PENDING_ALT_TEXT): publishing waits for them. */
export function imagesWaitingForAlt(content: unknown): number {
  if (!content || typeof content !== 'object' || !('root' in content)) return 0;
  return countPending(content.root as JsonNode);
}
