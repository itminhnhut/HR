import { describe, expect, it } from 'vitest';
import { slashItemsFor } from './slashItems';

const ids = (query: string, context: 'root' | 'box' | 'cell' = 'root') =>
  slashItemsFor(query, context).map((i) => i.id);

describe('slash menu items', () => {
  it('should put the table of contents first for "tab", "tabcontent", "toc" and "muc luc"', () => {
    expect(ids('tab')[0]).toBe('toc');
    expect(ids('tabcontent')).toEqual(['toc']);
    expect(ids('toc')[0]).toBe('toc');
    expect(ids('mục lục')[0]).toBe('toc');
    expect(ids('MUC LUC')[0]).toBe('toc');
  });

  it('should find blocks by Vietnamese words without accents and by English keywords', () => {
    expect(ids('tieu de')).toEqual(['h2', 'h3', 'h4']);
    expect(ids('h3')[0]).toBe('h3');
    expect(ids('hinh')).toEqual(['image']);
    expect(ids('accordion')).toEqual(['faq']);
    expect(ids('hỏi đáp')).toEqual(['faq']);
    expect(ids('todo')).toEqual(['check']);
    expect(ids('ke ngang')).toEqual(['hr']);
    expect(ids('quote')).toEqual(['quote']);
  });

  it('should offer each column layout, "3 cột" giving the three-column ones', () => {
    expect(ids('3 cột')).toEqual(['layout-1fr 1fr 1fr', 'layout-1fr 2fr 1fr']);
    expect(ids('columns')).toHaveLength(6);
  });

  it('should hide blocks that cannot go where the caret is', () => {
    const inBox = ids('', 'box');
    expect(inBox).not.toContain('toc');
    expect(inBox).not.toContain('faq');
    expect(inBox).not.toContain('table');
    expect(inBox.some((id) => id.startsWith('layout-'))).toBe(false);
    expect(inBox).toContain('image');
    expect(ids('', 'cell')).toEqual(['paragraph', 'bullet', 'number', 'check']);
  });

  it('should find nothing for words that match no block', () => {
    expect(ids('xyzzy')).toEqual([]);
  });
});
