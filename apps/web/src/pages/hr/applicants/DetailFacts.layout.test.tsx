import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../api';
import { application } from './AddApplicationFlow.helpers';
import { DetailFacts } from './DetailFacts';

const app = application({
  message: 'Em có thể đi làm ngay.',
  otherApplications: [{ id: 'a9', jobTitle: 'Kho', status: 'seen', createdAt: '2026-10-01T03:00:00.000Z' }],
});

function open(width: number) {
  vi.spyOn(api, 'hrSources').mockResolvedValue([]);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: width >= Number(/min-width: (\d+)px/.exec(query)?.[1] ?? 0),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <DetailFacts app={app} onError={() => undefined} onDeleted={() => undefined} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The blocks HR looks for, by something each one shows. */
const BLOCKS = {
  facts: () => screen.getByText('Điện thoại'),
  notes: () => screen.getByLabelText(/Ghi chú nội bộ/),
  score: () => screen.getByRole('region', { name: 'Chấm CV theo yêu cầu' }),
  cv: () => screen.getByRole('region', { name: 'CV' }),
  message: () => screen.getByText('Lời nhắn của ứng viên'),
  log: () => screen.getByRole('button', { name: /Nhật ký hồ sơ/ }),
  others: () => screen.getByRole('button', { name: /đã nộp thêm 1 vị trí khác/ }),
  privacy: () => screen.getByText('Hồ sơ được lưu đến khi ứng viên yêu cầu xoá.'),
  remove: () => screen.getByRole('button', { name: 'Xoá hồ sơ' }),
};
type Block = keyof typeof BLOCKS;

const isBefore = (a: HTMLElement, b: HTMLElement) =>
  !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
const inOrder = (names: Block[]) =>
  names.every((name, i) => i === 0 || isBefore(BLOCKS[names[i - 1] as Block](), BLOCKS[name]()));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('The detail body', () => {
  it('should put the candidate on the left and HR’s work on the right on a wide screen', () => {
    // Act
    open(1440);

    // Assert
    const left = within(screen.getByRole('group', { name: 'Về ứng viên' }));
    const right = within(screen.getByRole('group', { name: 'Việc của HR' }));
    expect(left.getByText('Điện thoại')).toBeTruthy();
    expect(left.getByText('Lời nhắn của ứng viên')).toBeTruthy();
    expect(left.getByRole('region', { name: 'Chấm CV theo yêu cầu' })).toBeTruthy();
    expect(right.getByLabelText(/Ghi chú nội bộ/)).toBeTruthy();
    expect(right.getByRole('button', { name: /Nhật ký hồ sơ/ })).toBeTruthy();
    expect(inOrder(['facts', 'message', 'score', 'cv', 'notes', 'log', 'others', 'privacy', 'remove'])).toBe(true);
  });

  it('should read top to bottom in one column on a phone', () => {
    // Act
    open(390);

    // Assert
    expect(screen.queryByRole('group', { name: 'Việc của HR' })).toBeNull();
    expect(inOrder(['facts', 'notes', 'score', 'cv', 'message', 'log', 'others', 'privacy', 'remove'])).toBe(true);
  });
});
