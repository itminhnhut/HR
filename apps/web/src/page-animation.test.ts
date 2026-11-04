import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('the animation pages open with', () => {
  it('should leave no transform behind, as one would move every fixed menu on the page away from its button', () => {
    // Arrange
    const styles = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');

    // Act
    const animation = /--animate-page:\s*([^;]+);/.exec(styles)?.[1] ?? '';

    // Assert
    expect(animation).toContain('page-in');
    expect(animation).not.toMatch(/\b(?:both|forwards)\b/);
  });
});
