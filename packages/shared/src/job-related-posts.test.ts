import { describe, expect, it } from 'vitest';
import { pickRelatedPosts, type RelatedPostCandidate } from './job-related-posts.js';

const LIFE = { name: 'Đời sống TOP FLOW', slug: 'doi-song-top-flow' };
const HIRING = { name: 'Tuyển dụng', slug: 'tuyen-dung' };
const CAREER = { name: 'Hướng nghiệp', slug: 'huong-nghiep' };

let day = 0;
function post(title: string, overrides: Partial<RelatedPostCandidate> = {}): RelatedPostCandidate {
  day += 1;
  return {
    slug: title.toLowerCase().replace(/\s+/g, '-'),
    title,
    tags: [],
    category: LIFE,
    publishedAt: `2026-10-${String(day).padStart(2, '0')}T02:00:00.000Z`,
    ...overrides,
  };
}

const sales = { title: 'Nhân viên Kinh doanh B2B', department: 'Kinh doanh' };
const slugs = (posts: RelatedPostCandidate[]) => posts.map((p) => p.slug);

describe('pickRelatedPosts', () => {
  it('should pick posts whose title or hashtags share words with the job, best match first', () => {
    // Arrange
    const trip = post('Chuyến đi thiện nguyện Vĩnh Hy');
    const tagged = post('Một ngày ở văn phòng', { tags: ['Kinh doanh'] });
    const best = post('Bí quyết kinh doanh B2B cho người mới');

    // Act
    const picked = pickRelatedPosts(sales, [trip, tagged, best]);

    // Assert
    expect(slugs(picked)).toEqual([best.slug, tagged.slug]);
  });

  it('should match words without accents or case', () => {
    const accountant = { title: 'Kế toán tổng hợp', department: 'Tài chính' };
    const tagged = post('Chuyện nghề', { tags: ['KE TOAN'] });

    expect(slugs(pickRelatedPosts(accountant, [tagged]))).toEqual([tagged.slug]);
  });

  it('should not count words like "tuyển", "nhân", "viên" or a single shared syllable as a match', () => {
    // Arrange
    const accountant = { title: 'Nhân viên kế toán', department: 'Tài chính' };
    const designer = post('Tuyển nhân viên thiết kế tại văn phòng');

    // Act / Assert
    expect(pickRelatedPosts(accountant, [designer])).toEqual([]);
  });

  it('should fill up with the newest "Tuyển dụng" and "Hướng nghiệp" posts when too few match', () => {
    // Arrange
    const oldTip = post('5 điều nên chuẩn bị trước buổi phỏng vấn', { category: CAREER });
    const life = post('Tiệc cuối năm');
    const newHiring = post('Ngày hội việc làm tháng 11', { category: HIRING });
    const match = post('Kỹ năng kinh doanh B2B');

    // Act
    const picked = pickRelatedPosts(sales, [oldTip, life, newHiring, match]);

    // Assert
    expect(slugs(picked)).toEqual([match.slug, newHiring.slug, oldTip.slug]);
  });

  it('should give at most three posts, the newest first among equal matches', () => {
    // Arrange
    const posts = [1, 2, 3, 4].map((n) => post(`Kinh doanh B2B phần ${n}`));

    // Act
    const picked = pickRelatedPosts(sales, posts);

    // Assert
    expect(slugs(picked)).toEqual(slugs([...posts].reverse().slice(0, 3)));
  });

  it('should give nothing when no post matches and none is about hiring or careers', () => {
    expect(pickRelatedPosts(sales, [post('Tiệc cuối năm')])).toEqual([]);
  });
});
