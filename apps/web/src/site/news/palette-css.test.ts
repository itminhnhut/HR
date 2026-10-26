/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { HIGHLIGHT_COLORS, TEXT_COLORS } from '@careers/shared';
import { describe, expect, it } from 'vitest';

// Read as text (vitest does not process stylesheets); tests run from apps/web.
const css = readFileSync(`${process.cwd()}/src/styles.css`, 'utf8');

/** The article HTML only carries class names (tc-red, hl-yellow): each needs its rule in styles.css. */
describe('article palette styles', () => {
  it('should define a rule for every text colour and highlight the editor offers', () => {
    const rule = (cls: string, prop: string, hex: string) =>
      new RegExp(`\\.article-prose \\.${cls} \\{\\s*${prop}: ${hex};`, 'i');

    for (const c of TEXT_COLORS) expect(css).toMatch(rule(`tc-${c.key}`, 'color', c.hex));
    for (const c of HIGHLIGHT_COLORS) expect(css).toMatch(rule(`hl-${c.key}`, 'background-color', c.hex));
  });

  it('should style the blocks the article renderer writes', () => {
    const selectors = ['figure.img-wide', 'figcaption', 'figure.embed', '.cta-button', '.table-wrap', 'hr', 'table'];
    for (const selector of [...selectors, '.text-center', '.text-right', '.text-justify']) {
      expect(css).toContain(`.article-prose ${selector}`);
    }
  });
});
