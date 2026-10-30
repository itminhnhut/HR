import { describe, expect, it } from 'vitest';
import { sameSourceName, sourceCreateSchema, sourceKeyFor, sourceName, sourceUpdateSchema } from './sources.js';

describe('source names', () => {
  it('should treat case, tones and spaces as the same name', () => {
    expect(sameSourceName('LinkedIn', ' linkedin ')).toBe(true);
    expect(sameSourceName('Hội chợ  việc làm', 'HOI CHO VIEC LAM')).toBe(true);
    expect(sameSourceName('Zalo', 'Zalo OA')).toBe(false);
  });

  it('should tidy spaces and need 2 to 60 characters', () => {
    expect(sourceCreateSchema.parse({ name: '  Hội   chợ việc làm ' }).name).toBe('Hội chợ việc làm');
    expect(sourceCreateSchema.safeParse({ name: 'A' }).success).toBe(false);
    expect(sourceCreateSchema.safeParse({ name: 'x'.repeat(61) }).success).toBe(false);
  });

  it('should need something to change', () => {
    expect(sourceUpdateSchema.safeParse({}).success).toBe(false);
    expect(sourceUpdateSchema.safeParse({ hidden: true }).success).toBe(true);
  });
});

describe('source keys', () => {
  it('should make a key from the name without tones, numbering a taken one', () => {
    // Arrange
    const taken = new Set(['linkedin', 'hoi-cho-viec-lam']);

    // Act / Assert
    expect(sourceKeyFor('Trường ĐH Bách Khoa', taken)).toBe('truong-dh-bach-khoa');
    expect(sourceKeyFor('LinkedIn', taken)).toBe('linkedin-2');
    expect(sourceKeyFor('Hội chợ việc làm', new Set([...taken, 'hoi-cho-viec-lam-2']))).toBe('hoi-cho-viec-lam-3');
  });

  it('should show the key when the list does not know it', () => {
    expect(sourceName([{ key: 'zalo', name: 'Zalo' }], 'zalo')).toBe('Zalo');
    expect(sourceName([], 'linkedin')).toBe('linkedin');
  });
});
