import { APPLICATION_STATUS_LABEL, type ApplicationStatus } from '@careers/shared';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STATUS_STYLE } from './statusStyle';

const STATUSES = Object.keys(APPLICATION_STATUS_LABEL) as ApplicationStatus[];
// Tests run from apps/web.
const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

function token(name: string): string {
  const found = new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`).exec(css)?.[1];
  if (!found) throw new Error(`No colour ${name} in styles.css`);
  return found;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

describe('The status design', () => {
  it.each(STATUSES)('should give "%s" a word, an icon and every style', (status) => {
    // Act
    const style = STATUS_STYLE[status];

    // Assert
    expect(style.label).toBe(APPLICATION_STATUS_LABEL[status]);
    expect(style.icon).toBeTruthy();
    expect(style.filled).toContain('text-white');
    expect(style.soft).toContain('text-');
    expect(style.hover).toContain('hover:');
    expect(style.underline).toContain('border-');
    expect(style.activeText).toContain('text-');
  });

  it('should give each status its own colour and icon', () => {
    // Act
    const styles = STATUSES.map((status) => STATUS_STYLE[status]);

    // Assert
    expect(new Set(styles.map((s) => s.filled)).size).toBe(STATUSES.length);
    expect(new Set(styles.map((s) => s.icon)).size).toBe(STATUSES.length);
  });

  it('should use no violet', () => {
    // Act
    const all = JSON.stringify(STATUS_STYLE);

    // Assert
    expect(all).not.toMatch(/violet|purple/);
  });

  it.each(['new', 'seen', 'interview', 'rejected'])('should keep "%s" readable at 4.5:1 or more', (status) => {
    // Act
    const filled = contrast('#ffffff', token(`status-${status}`));
    const soft = contrast(token(`status-${status}-text`), token(`status-${status}-soft`));
    const onWhite = contrast(token(`status-${status}-text`), '#ffffff');

    // Assert
    expect(filled).toBeGreaterThanOrEqual(4.5);
    expect(soft).toBeGreaterThanOrEqual(4.5);
    expect(onWhite).toBeGreaterThanOrEqual(4.5);
  });
});
