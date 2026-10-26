import type { HrNewsPostDto } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { descriptionFor, draftFrom, hasTitleOrBody, renderDraft, shownSlug, slugFollowsTitle, toInput } from './model';

const post = (patch: Partial<HrNewsPostDto>): HrNewsPostDto => ({
  id: 'p1',
  title: 'Đời sống TOP FLOW',
  slug: 'doi-song-top-flow',
  slugLocked: false,
  status: 'draft',
  categoryId: null,
  summary: '',
  cover: null,
  tags: [],
  content: null,
  publishedAt: null,
  updatedAt: '2026-10-26T03:00:00.000Z',
  updatedBy: null,
  ...patch,
});

describe('news editor model', () => {
  it('should treat the server-numbered address as following the title', () => {
    expect(slugFollowsTitle('Đời sống TOP FLOW', 'doi-song-top-flow-2')).toBe(true);
    expect(slugFollowsTitle('Đời sống TOP FLOW', 'bai-rieng')).toBe(false);
  });

  it('should send an empty slug (follow the title) until HR types one', () => {
    const draft = draftFrom(post({}));

    expect(toInput(draft).slug).toBe('');
    expect(toInput({ ...draft, slug: 'dia-chi-rieng', slugTouched: true }).slug).toBe('dia-chi-rieng');
  });

  it('should keep a custom saved address when the post is reopened', () => {
    const draft = draftFrom(post({ slug: 'dia-chi-rieng' }));

    expect(draft.slugTouched).toBe(true);
    expect(toInput(draft).slug).toBe('dia-chi-rieng');
  });

  it('should show the locked address of a published post whatever the title says', () => {
    const saved = post({ slug: 'cu', slugLocked: true });

    expect(shownSlug({ ...draftFrom(saved), title: 'Tiêu đề mới' }, saved)).toBe('cu');
  });

  it('should describe the post with the start of the article when the summary is empty', () => {
    const article = renderDraft({
      root: {
        type: 'root',
        children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Đoạn đầu.', format: 0 }] }],
      },
    });

    expect(descriptionFor('', article)).toBe('Đoạn đầu.');
    expect(descriptionFor('Tóm tắt riêng', article)).toBe('Tóm tắt riêng');
  });
});

describe('worth saving as a draft', () => {
  const paragraph = (text: string) => ({
    root: {
      type: 'root',
      children: [{ type: 'paragraph', children: text ? [{ type: 'text', text, format: 0, style: '' }] : [] }],
    },
  });
  const input = (title: string, content: unknown) => ({
    title,
    slug: '',
    categoryId: 'c1',
    summary: '',
    cover: null,
    tags: ['Kỹ sư'],
    content,
  });

  it('should not keep a new post that has neither a title nor any text', () => {
    expect(hasTitleOrBody(input('  ', null))).toBe(false);
    expect(hasTitleOrBody(input('', paragraph('')))).toBe(false);
  });

  it('should keep a new post once it has a title or some text', () => {
    expect(hasTitleOrBody(input('Bài mới', null))).toBe(true);
    expect(hasTitleOrBody(input('', paragraph('Đoạn đầu')))).toBe(true);
  });
});
