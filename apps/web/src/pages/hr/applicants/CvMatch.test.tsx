import type { ApplicationDetailDto, CvScoreDto, MatchItem } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => vi.stubEnv('VITE_API_URL', '/api'));
import { CvMatch } from './CvMatch';
import { coverageOf } from './cvMatchLines';

const line = (verdict: MatchItem['verdict'], counted: boolean, requirement: string): MatchItem => ({
  requirement,
  verdict,
  evidence: null,
  reason: 'Lý do',
  counted,
});

const score = (over: Partial<CvScoreDto>): CvScoreDto => ({
  percent: null,
  items: [],
  scoredAt: '2026-11-03T03:00:00.000Z',
  note: null,
  ...over,
});

function renderMatch(cvScore: CvScoreDto) {
  const app = { id: 'a1', cvFileName: 'cv.pdf', cvLink: null, cvScore } as unknown as ApplicationDetailDto;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CvMatch app={app} />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe('CvMatch', () => {
  it('should say there is not enough data when too few lines could be judged', () => {
    // Arrange
    const items = [line('met', true, 'Biết Word'), line('unknown', true, 'Từ 2 năm'), line('unknown', true, 'Đại học')];

    // Act
    renderMatch(score({ items }));

    // Assert
    expect(screen.getByText('Chưa đủ dữ liệu')).toBeTruthy();
    expect(screen.queryByText(/^\d+%$/)).toBeNull();
  });

  it('should show the percent', () => {
    // Arrange
    const items = [
      line('met', true, 'Biết Word'),
      line('unmet', true, 'Biết Excel'),
      line('unknown', false, 'Cẩn thận'),
    ];

    // Act
    renderMatch(score({ percent: 50, items }));

    // Assert
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.queryByText('Chưa đủ dữ liệu')).toBeNull();
  });

  it('should not claim a lack of data when the CV could not be read at all', () => {
    // Act
    renderMatch(score({ note: 'CV là link, không đọc được tự động: HR mở link để xem.' }));

    // Assert
    expect(screen.queryByText('Chưa đủ dữ liệu')).toBeNull();
  });

  it('should show no coverage for a result stored before lines were marked', () => {
    // Arrange
    const items: MatchItem[] = [{ requirement: 'Biết Word', verdict: 'met', evidence: null, reason: null }];

    // Act
    const got = coverageOf(items);

    // Assert
    expect(got).toBeNull();
  });
});
