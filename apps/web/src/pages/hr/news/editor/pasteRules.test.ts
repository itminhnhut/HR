import { describe, expect, it } from 'vitest';
import { mergeTextStyles, nestListsByAriaLevel, pastedTextStyle, splitPointFor, TEXT_MAX } from './pasteRules';

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

describe('pasted text style', () => {
  it('should keep a palette colour and a preset size, and drop the rest', () => {
    expect(pastedTextStyle('font-size:20px')).toBe('font-size: 20px;');
    expect(pastedTextStyle('color:#B91C1C')).toBe('color: #b91c1c;');
    expect(pastedTextStyle('color:#ff0000;font-family:Comic Sans MS;font-size:30px')).toBe('');
    expect(pastedTextStyle('background-color:#fef08a')).toBe('background-color: #fef08a;');
  });

  it('should drop sizes that are not exactly a preset, so Word and Docs body text stays normal', () => {
    expect(pastedTextStyle('font-size:13px')).toBe('');
    expect(pastedTextStyle('font-size:11pt')).toBe('');
    expect(pastedTextStyle('font-size:14.0pt')).toBe('');
    expect(pastedTextStyle('font-size:15pt')).toBe('font-size: 20px;');
    expect(pastedTextStyle('font-size:16px')).toBe('');
  });

  it('should read colours the browser rewrote as rgb()', () => {
    expect(pastedTextStyle('color: rgb(185, 28, 28)')).toBe('color: #b91c1c;');
    expect(pastedTextStyle('color: rgb(0, 0, 0)')).toBe('');
  });

  it('should keep the serif font and drop other fonts', () => {
    expect(pastedTextStyle('font-family: "Playfair Display", serif')).toBe('font-family: Playfair Display, serif;');
    expect(pastedTextStyle('font-family: Arial')).toBe('');
  });

  it('should let the inner span win when styles are nested', () => {
    expect(mergeTextStyles('color: #1d4ed8;', 'color: #b91c1c;font-size: 20px;')).toBe(
      'color: #1d4ed8;font-size: 20px;',
    );
    expect(mergeTextStyles('', 'font-size: 20px;')).toBe('font-size: 20px;');
    expect(mergeTextStyles('color: #1d4ed8;', '')).toBe('color: #1d4ed8;');
  });
});

describe('long text', () => {
  it('should cut a text that is too long after a sentence, inside the limit', () => {
    const text = 'Nội dung dài. '.repeat(860);
    const at = splitPointFor(text);

    expect(at).toBeLessThanOrEqual(TEXT_MAX);
    expect(at).toBeGreaterThan(TEXT_MAX - 20);
    expect(text.slice(0, at).endsWith('. ')).toBe(true);
  });

  it('should cut at a space when there is no sentence end, and anywhere as a last resort', () => {
    const words = 'chữ '.repeat(3000);
    const noSpaces = 'a'.repeat(12_000);

    expect(words.slice(0, splitPointFor(words)).endsWith(' ')).toBe(true);
    expect(splitPointFor(noSpaces)).toBe(TEXT_MAX);
  });

  it('should not cut a text within the limit', () => {
    expect(splitPointFor('ngắn')).toBe(4);
  });
});

describe('Google Docs lists', () => {
  it('should nest list items by their aria-level, as Docs pastes them flat', () => {
    const doc = parse(
      '<ul><li aria-level="1"><p>Một</p></li><li aria-level="2"><p>Hai</p></li>' +
        '<li aria-level="3"><p>Ba</p></li><li aria-level="1"><p>Bốn</p></li></ul>',
    );

    nestListsByAriaLevel(doc);

    const top = doc.querySelector('body > ul');
    expect(top?.children).toHaveLength(3);
    expect(top?.children[0]?.textContent).toBe('Một');
    expect(top?.children[1]?.querySelector(':scope > ul > li')?.textContent).toBe('Hai');
    expect(top?.children[1]?.querySelector(':scope > ul > li + li > ul > li')?.textContent).toBe('Ba');
    expect(top?.children[2]?.textContent).toBe('Bốn');
  });

  it('should leave lists without aria-level alone', () => {
    const html = '<ul><li>Một</li><li>Hai<ul><li>Con</li></ul></li></ul>';
    const doc = parse(html);

    nestListsByAriaLevel(doc);

    expect(doc.body.innerHTML).toBe(html);
  });
});
