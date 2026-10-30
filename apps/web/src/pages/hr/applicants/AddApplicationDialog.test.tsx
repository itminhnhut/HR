import type { SourceDto } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => vi.stubEnv('VITE_API_URL', '/api'));
import { AddApplicationDialog } from './AddApplicationDialog';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
let posts: number;
/** The reply to "Đọc CV" (POST /hr/applications/parse-cv). */
let parseReply: () => Response;
/** The reply to "Lưu hồ sơ" (POST /hr/applications). */
let addReply: () => Response;

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const duplicate = () =>
  reply(409, {
    error: 'Đã có hồ sơ của Trần Khoa cho vị trí này.',
    fieldErrors: {},
    code: 'duplicate',
    existing: { id: 'old-id', fullName: 'Trần Khoa', status: 'seen', createdAt: '2026-10-20T03:00:00.000Z' },
  });
const parsedCv =
  (over: Record<string, unknown> = {}) =>
  () =>
    reply(200, {
      fullName: 'Nguyễn Thị Mai Anh',
      phone: '0903456789',
      email: 'maianh.nguyen@example.com',
      readable: true,
      ...over,
    });

beforeAll(() => {
  // jsdom has no <dialog> methods.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
let sourceList: SourceDto[];
beforeEach(() => {
  posts = 0;
  sourceList = [
    { key: 'website', name: 'Website', kind: 'system', hidden: false, applications: 3 },
    { key: 'email', name: 'Email', kind: 'builtin', hidden: false, applications: 0 },
    { key: 'zalo', name: 'Zalo', kind: 'builtin', hidden: false, applications: 1 },
    { key: 'topcv', name: 'TopCV', kind: 'builtin', hidden: true, applications: 0 },
    { key: 'other', name: 'Khác', kind: 'builtin', hidden: false, applications: 0 },
  ];
  parseReply = parsedCv();
  addReply = duplicate;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/hr/jobs')) {
        return reply(200, {
          jobs: [{ id: JOB_ID, title: 'Kế toán', status: 'open' }],
          newApplications: 0,
          dueForDeletion: 0,
        });
      }
      if (url.endsWith('/hr/applications/parse-cv')) return parseReply();
      if (url.endsWith('/hr/sources') && init?.method === 'POST') {
        const { name } = JSON.parse(String(init.body)) as { name: string };
        sourceList = [...sourceList, { key: 'linkedin', name, kind: 'custom', hidden: false, applications: 0 }];
        return reply(201, sourceList[sourceList.length - 1]);
      }
      if (url.endsWith('/hr/sources')) return reply(200, sourceList);
      if (init?.method === 'POST') {
        posts += 1;
        return addReply();
      }
      return reply(404, { error: 'not found' });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function show(onAdded = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AddApplicationDialog open onClose={() => {}} onAdded={onAdded} />
    </QueryClientProvider>,
  );
  return onAdded;
}

const cvPdf = () => new File(['%PDF-1.7\n%%EOF\n'], 'CV Mai Anh.pdf', { type: 'application/pdf' });
const pickCv = async () => userEvent.upload(screen.getByLabelText(/Chọn file CV/), cvPdf());

async function fillBasics() {
  await userEvent.selectOptions(
    await screen.findByLabelText('Vị trí ứng tuyển'),
    await screen.findByRole('option', { name: 'Kế toán' }),
  );
  await userEvent.type(screen.getByLabelText('Họ và tên'), 'Trần Khoa');
  await userEvent.type(screen.getByLabelText('Số điện thoại'), '0912345678');
}

describe('HR adds an application', () => {
  it('should ask for the source and the consent before sending anything', async () => {
    // Arrange
    show();
    await fillBasics();

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));

    // Assert
    expect(screen.getByText('Chọn nguồn hồ sơ.')).toBeTruthy();
    expect(screen.getByText(/Xác nhận ứng viên đã đồng ý/)).toBeTruthy();
    expect(posts).toBe(0);
  });

  it('should point to the existing application when this phone already applied for the job', async () => {
    // Arrange
    const onAdded = show();
    await fillBasics();
    await userEvent.selectOptions(screen.getByLabelText('Nguồn hồ sơ'), 'zalo');
    await userEvent.click(screen.getByRole('checkbox'));

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Mở hồ sơ đó' }));

    // Assert
    expect(screen.getByText(/Đã có hồ sơ của/)).toBeTruthy();
    expect(onAdded).toHaveBeenCalledWith('old-id');
  });
});

describe('HR adds an application from a CV file', () => {
  it('should fill the empty name, phone and email boxes from the picked PDF', async () => {
    // Arrange
    show();

    // Act
    await pickCv();

    // Assert
    expect(await screen.findByText(/Đã điền sẵn họ tên, SĐT, email từ CV/)).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Họ và tên').value).toBe('Nguyễn Thị Mai Anh');
    expect(screen.getByLabelText<HTMLInputElement>('Số điện thoại').value).toBe('0903 456 789');
    expect(screen.getByLabelText<HTMLInputElement>(/^Email/).value).toBe('maianh.nguyen@example.com');
    expect(screen.getAllByText('Lấy từ CV')).toHaveLength(3);
  });

  it('should keep what HR already typed and say which details the CV lacks', async () => {
    // Arrange
    parseReply = parsedCv({ email: null });
    show();
    await userEvent.type(screen.getByLabelText('Họ và tên'), 'Mai Anh');

    // Act
    await pickCv();

    // Assert
    expect(await screen.findByText(/Đã điền sẵn SĐT từ CV.*Không tìm thấy email trong CV\./)).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Họ và tên').value).toBe('Mai Anh');
    expect(screen.getByLabelText<HTMLInputElement>('Số điện thoại').value).toBe('0903 456 789');
    expect(screen.getByLabelText<HTMLInputElement>(/^Email/).value).toBe('');
    expect(screen.getAllByText('Lấy từ CV')).toHaveLength(1);
  });

  it('should stop marking a box as taken from the CV once HR edits it', async () => {
    // Arrange
    show();
    await pickCv();
    await screen.findByText(/Đã điền sẵn/);

    // Act
    await userEvent.type(screen.getByLabelText('Họ và tên'), ' B');

    // Assert
    expect(screen.getByLabelText<HTMLInputElement>('Họ và tên').value).toBe('Nguyễn Thị Mai Anh B');
    expect(screen.getAllByText('Lấy từ CV')).toHaveLength(2);
  });

  it('should ask HR to type the details when the CV is a scan without text', async () => {
    // Arrange
    parseReply = parsedCv({ fullName: null, phone: null, email: null, readable: false });
    show();

    // Act
    await pickCv();

    // Assert
    expect(await screen.findByText('Không đọc được chữ trong CV (ảnh scan), nhập tay giúp.')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Họ và tên').value).toBe('');
    expect(screen.getByLabelText<HTMLInputElement>('Số điện thoại').value).toBe('');
    expect(screen.queryByText('Lấy từ CV')).toBeNull();
  });

  it('should still save the application with its CV when reading the CV fails', async () => {
    // Arrange
    parseReply = () => reply(500, { error: 'Có lỗi xảy ra, thử lại sau.' });
    addReply = () => reply(201, { id: 'new-id' });
    const onAdded = show();
    await pickCv();
    await screen.findByText(/Không đọc được CV lúc này/);
    await fillBasics();
    await userEvent.selectOptions(screen.getByLabelText('Nguồn hồ sơ'), 'email');
    await userEvent.click(screen.getByRole('checkbox'));

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));

    // Assert
    await vi.waitFor(() => expect(onAdded).toHaveBeenCalledWith('new-id'));
    expect(posts).toBe(1);
  });

  it('should not read anything when HR pastes a link instead of a file', async () => {
    // Arrange
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Dán link' }));

    // Act
    await userEvent.type(screen.getByLabelText('Link CV'), 'https://drive.google.com/cv');

    // Assert
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>('Họ và tên').value).toBe('');
  });
});

describe('HR picks the source', () => {
  it('should offer visible sources only, never "Website" nor a hidden one', async () => {
    show();
    const select = await screen.findByLabelText('Nguồn hồ sơ');
    await screen.findByRole('option', { name: 'Zalo' });
    const names = [...select.querySelectorAll('option')].map((o) => o.textContent);
    expect(names).toEqual(['Chọn nguồn…', 'Email', 'Zalo', 'Khác', '+ Thêm nguồn mới…']);
  });

  it('should add a new source and pick it at once', async () => {
    // Arrange
    show();
    const select = await screen.findByLabelText('Nguồn hồ sơ');
    await screen.findByRole('option', { name: 'Zalo' });

    // Act
    await userEvent.selectOptions(select, '+ Thêm nguồn mới…');
    await userEvent.type(screen.getByLabelText('Tên nguồn mới'), 'LinkedIn');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm nguồn' }));

    // Assert
    await screen.findByRole('option', { name: 'LinkedIn' });
    expect((screen.getByLabelText('Nguồn hồ sơ') as HTMLSelectElement).value).toBe('linkedin');
  });
});
