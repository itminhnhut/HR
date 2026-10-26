import { foldVietnamese, matchesQuery } from '@careers/shared';
import type { IconName } from '../../../../../ui/icons';
import { LAYOUT_CHOICES } from '../rules';

/**
 * The "/" menu's blocks (Notion-like, after the Lexical playground's ComponentPickerPlugin), as plain data:
 * Vietnamese titles and hints, Vietnamese and English keywords, and where each block may go.
 */

/** Where the caret is: straight in the article, in a column or FAQ answer, or in a table cell. */
export type SlashContext = 'root' | 'box' | 'cell';

export type SlashAction =
  | 'paragraph'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'quote'
  | 'bullet'
  | 'number'
  | 'check'
  | 'code'
  | 'toc'
  | 'faq'
  | 'table'
  | 'image'
  | 'youtube'
  | 'cta'
  | 'hr'
  | { layout: string };

export interface SlashItem {
  id: string;
  title: string;
  hint: string;
  /** An icon of the set, or the H2/H3/H4 letters. */
  icon: IconName | 'h2' | 'h3' | 'h4';
  keywords: string[];
  action: SlashAction;
  contexts: SlashContext[];
}

const ALL: SlashContext[] = ['root', 'box', 'cell'];
const BLOCKS: SlashContext[] = ['root', 'box'];
const ROOT: SlashContext[] = ['root'];

const LAYOUT_ITEMS: SlashItem[] = LAYOUT_CHOICES.map(({ template, label }) => {
  const columns = template.split(' ').length;
  return {
    id: `layout-${template}`,
    title: `Bố cục ${label}`,
    hint: 'Chia nội dung thành cột; trên điện thoại xếp dọc',
    icon: 'columns',
    keywords: ['columns', 'cot', 'layout', 'bo cuc', `${columns} cot`, `${columns} cột`, `${columns} columns`],
    action: { layout: template },
    contexts: ROOT,
  };
});

export const SLASH_ITEMS: SlashItem[] = [
  {
    id: 'toc',
    title: 'Mục lục',
    hint: 'Danh sách tiêu đề H2–H4, đặt trước tiêu đề đầu tiên',
    icon: 'toc',
    keywords: ['tabcontent', 'toc', 'table of contents', 'muc luc', 'mục lục', 'contents'],
    action: 'toc',
    contexts: ROOT,
  },
  {
    id: 'paragraph',
    title: 'Đoạn văn',
    hint: 'Chữ thường',
    icon: 'paragraph',
    keywords: ['p', 'text', 'paragraph', 'doan van'],
    action: 'paragraph',
    contexts: ALL,
  },
  {
    id: 'h2',
    title: 'Tiêu đề lớn (H2)',
    hint: 'Mở một phần mới của bài',
    icon: 'h2',
    keywords: ['h2', 'heading', 'heading 2', 'tieu de', 'tieu de lon'],
    action: 'h2',
    contexts: BLOCKS,
  },
  {
    id: 'h3',
    title: 'Tiêu đề vừa (H3)',
    hint: 'Ý nhỏ trong một phần',
    icon: 'h3',
    keywords: ['h3', 'heading', 'heading 3', 'tieu de', 'tieu de vua'],
    action: 'h3',
    contexts: BLOCKS,
  },
  {
    id: 'h4',
    title: 'Tiêu đề nhỏ (H4)',
    hint: 'Mức tiêu đề sâu nhất',
    icon: 'h4',
    keywords: ['h4', 'heading', 'heading 4', 'tieu de', 'tieu de nho'],
    action: 'h4',
    contexts: BLOCKS,
  },
  {
    id: 'quote',
    title: 'Trích dẫn',
    hint: 'Lời nói của ai đó, in nghiêng',
    icon: 'quote',
    keywords: ['quote', 'blockquote', 'trich dan'],
    action: 'quote',
    contexts: BLOCKS,
  },
  {
    id: 'bullet',
    title: 'Danh sách chấm',
    hint: 'Các ý không theo thứ tự',
    icon: 'listBullet',
    keywords: ['ul', 'list', 'bullet', 'danh sach', 'cham'],
    action: 'bullet',
    contexts: ALL,
  },
  {
    id: 'number',
    title: 'Danh sách số',
    hint: 'Các bước 1, 2, 3',
    icon: 'listNumber',
    keywords: ['ol', 'list', 'numbered', 'danh sach so'],
    action: 'number',
    contexts: ALL,
  },
  {
    id: 'check',
    title: 'Checklist',
    hint: 'Danh sách có ô tích',
    icon: 'listCheck',
    keywords: ['todo', 'check', 'checklist', 'list', 'o tich', 'viec can lam'],
    action: 'check',
    contexts: ALL,
  },
  {
    id: 'table',
    title: 'Bảng',
    hint: 'Hàng và cột, có hàng tiêu đề',
    icon: 'table',
    keywords: ['table', 'bang', 'grid'],
    action: 'table',
    contexts: ROOT,
  },
  {
    id: 'image',
    title: 'Ảnh',
    hint: 'Tải ảnh JPEG, PNG hoặc WebP',
    icon: 'image',
    keywords: ['image', 'anh', 'hinh', 'hinh anh', 'photo', 'picture'],
    action: 'image',
    contexts: BLOCKS,
  },
  {
    id: 'youtube',
    title: 'Video YouTube',
    hint: 'Dán link video',
    icon: 'play',
    keywords: ['video', 'youtube', 'embed'],
    action: 'youtube',
    contexts: BLOCKS,
  },
  {
    id: 'cta',
    title: 'Nút kêu gọi',
    hint: 'Nút dẫn tới việc làm hoặc trang khác',
    icon: 'cta',
    keywords: ['cta', 'button', 'nut', 'ung tuyen', 'call to action'],
    action: 'cta',
    contexts: BLOCKS,
  },
  {
    id: 'faq',
    title: 'Hỏi đáp (FAQ)',
    hint: 'Câu hỏi bấm vào để xem trả lời',
    icon: 'faq',
    keywords: ['faq', 'hoi dap', 'accordion', 'collapsible', 'cau hoi'],
    action: 'faq',
    contexts: ROOT,
  },
  ...LAYOUT_ITEMS,
  {
    id: 'code',
    title: 'Khối code',
    hint: 'Mã hoặc lệnh, giữ nguyên khoảng trắng',
    icon: 'code',
    keywords: ['code', 'codeblock', 'ma', 'lenh'],
    action: 'code',
    contexts: BLOCKS,
  },
  {
    id: 'hr',
    title: 'Đường kẻ ngang',
    hint: 'Ngăn cách hai phần',
    icon: 'divider',
    keywords: ['hr', 'divider', 'ke ngang', 'duong ke', 'line', 'separator'],
    action: 'hr',
    contexts: BLOCKS,
  },
];

/** 0 best: a keyword is the query, then starts with it, then the title starts with it, then anything else. */
function rank(item: SlashItem, query: string): number {
  const q = foldVietnamese(query).trim();
  const keywords = item.keywords.map(foldVietnamese);
  if (keywords.includes(q)) return 0;
  if (keywords.some((k) => k.startsWith(q))) return 1;
  return foldVietnamese(item.title).startsWith(q) ? 2 : 3;
}

/** The blocks for the caret's place that match the typed words (accents and case ignored), best first. */
export function slashItemsFor(query: string, context: SlashContext): SlashItem[] {
  const allowed = SLASH_ITEMS.filter((item) => item.contexts.includes(context));
  if (!query.trim()) return allowed.filter((item) => !item.id.startsWith('layout-') || item.id === 'layout-1fr 1fr');
  return allowed
    .filter((item) => matchesQuery(`${item.title} ${item.keywords.join(' ')}`, query))
    .map((item, index) => ({ item, index, score: rank(item, query) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map(({ item }) => item);
}
