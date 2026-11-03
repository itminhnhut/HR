import type { ApplicationDetailDto, ApplicationRowDto, ApplicationStatus, TemplateKey } from '@careers/shared';
import { DEFAULT_MESSAGE_TEMPLATES, WEBSITE_SOURCE } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => vi.stubEnv('VITE_API_URL', '/api'));
import { application, reply } from './applicants/AddApplicationFlow.helpers';
import { HrApplicantsPage } from './HrApplicantsPage';

interface Patch {
  id: string;
  body: Record<string, unknown>;
}

const row = (id: string, fullName: string, status: ApplicationStatus, over: Partial<ApplicationRowDto> = {}) => ({
  id,
  jobId: 'j1',
  jobTitle: 'Kế toán',
  fullName,
  phone: '0912345678',
  status,
  createdAt: '2026-10-20T03:00:00.000Z',
  hasCv: true,
  matchPercent: 80,
  matchBonus: 0,
  noteLine: null,
  interviewAt: null,
  review: null,
  source: WEBSITE_SOURCE,
  cvUpdatedByCandidate: false,
  ...over,
});

let rows: ApplicationRowDto[];
let details: Record<string, Partial<ApplicationDetailDto>>;
let patches: Patch[];
let screenWidth: number;

const detailOf = (id: string): ApplicationDetailDto => {
  const found = rows.find((r) => r.id === id);
  return application({ ...found, cvLink: null, addedBy: null, consentBy: null, cvFileName: 'CV.pdf', ...details[id] });
};

function listReply() {
  const count = (s: ApplicationStatus) => rows.filter((r) => r.status === s).length;
  return {
    applications: rows,
    counts: {
      all: rows.length,
      new: count('new'),
      seen: count('seen'),
      interview: count('interview'),
      rejected: count('rejected'),
    },
    jobs: [
      { id: 'j1', title: 'Kế toán' },
      { id: 'j2', title: 'Kinh doanh' },
    ],
  };
}

/** Like the server: opening marks "Mới" as "Đã xem"; a PATCH changes the application. */
function openOrPatch(id: string, method: string, init: RequestInit | undefined) {
  if (method === 'GET') rows = rows.map((r) => (r.id === id && r.status === 'new' ? { ...r, status: 'seen' } : r));
  if (method === 'PATCH') {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    patches = [...patches, { id, body }];
    if (typeof body.status === 'string') {
      const status = body.status as ApplicationStatus;
      rows = rows.map((r) => (r.id === id ? { ...r, status } : r));
    }
  }
  return reply(200, detailOf(id));
}

function route(input: RequestInfo | URL, init?: RequestInit): Response {
  const path =
    String(input)
      .replace(/^\/api/, '')
      .split('?')[0] ?? '';
  const method = init?.method ?? 'GET';
  if (path === '/hr/sources') return reply(200, []);
  if (path === '/hr/me') return reply(200, { id: 'u1', email: 'lan@example.com', name: 'Lan', phone: '0909000111' });
  if (path === '/hr/message-templates') {
    return reply(200, { templates: Object.values(DEFAULT_MESSAGE_TEMPLATES), customized: [] as TemplateKey[] });
  }
  if (path === '/hr/applications/score-pending') return reply(200, { scored: 0, remaining: 0 });
  if (path === '/hr/applications') return reply(200, listReply());
  const match = /^\/hr\/applications\/([\w-]+)(\/score)?$/.exec(path);
  if (match?.[2]) return reply(200, detailOf(match[1] ?? ''));
  if (match) return openOrPatch(match[1] ?? '', method, init);
  return reply(404, { error: 'not found' });
}

const show = (search: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/hr/ho-so${search}`]}>
        <HrApplicantsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const heading = (name: string) => screen.findByRole('heading', { name, level: 2 });
const counter = () => within(screen.getByRole('navigation', { name: 'Chuyển hồ sơ' })).getByRole('status');
const openRow = () => screen.getByRole('button', { current: true });
const statusTab = (name: string) =>
  within(screen.getByRole('group', { name: 'Lọc theo trạng thái' })).getByRole('button', {
    name: new RegExp(`^${name}`),
  });
const rowOf = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });
const statusButton = (name: string) => screen.getByRole('button', { name, pressed: false });

beforeAll(() => {
  // jsdom has no <dialog> methods.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});

beforeEach(() => {
  rows = [
    row('a1', 'An Nguyễn', 'seen'),
    row('a2', 'Bình Trần', 'seen', { hasCv: false, matchPercent: null }),
    row('a3', 'Chi Lê', 'interview', { source: 'zalo' }),
    row('a4', 'Dũng Phạm', 'rejected'),
  ];
  details = {};
  patches = [];
  screenWidth = 1440;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => route(input, init)),
  );
  // jsdom has no layout: this is the one thing a test says about the screen width.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: screenWidth >= Number(/min-width: (\d+)px/.exec(query)?.[1] ?? 0),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('The "Thêm" menu', () => {
  const openMenu = async () => {
    await screen.findByText('An Nguyễn');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm' }));
    return screen.findByRole('menu');
  };

  it('should keep "Gửi sếp duyệt" and "Quản lý nguồn" in the menu, and "Thêm hồ sơ" outside it', async () => {
    // Arrange
    show('?trang-thai=all');
    await screen.findByText('An Nguyễn');

    // Assert
    expect(screen.getByRole('button', { name: 'Thêm hồ sơ' })).toBeTruthy();
    expect(screen.queryByText('Gửi sếp duyệt')).toBeNull();
    expect(screen.queryByText('Quản lý nguồn')).toBeNull();

    // Act
    const menu = await openMenu();

    // Assert
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Gửi sếp duyệt', 'Quản lý nguồn']);
  });

  it('should say on the button whether the menu is open', async () => {
    // Arrange
    show('?trang-thai=all');
    await screen.findByText('An Nguyễn');
    const button = screen.getByRole('button', { name: 'Thêm' });
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-expanded')).toBe('false');

    // Act
    await openMenu();

    // Assert
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('should move the focus into the menu and through it with the arrow keys', async () => {
    // Arrange
    show('?trang-thai=all');
    const menu = await openMenu();
    const [first, second] = within(menu).getAllByRole('menuitem');

    // Assert
    expect(document.activeElement).toBe(first);

    // Act + Assert
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(second);
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(first);
    await userEvent.keyboard('{End}');
    expect(document.activeElement).toBe(second);
    await userEvent.keyboard('{Home}');
    expect(document.activeElement).toBe(first);
  });

  it('should close on Esc and give the focus back to the button', async () => {
    // Arrange
    show('?trang-thai=all');
    await openMenu();

    // Act
    await userEvent.keyboard('{Escape}');

    // Assert
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Thêm' }));
  });

  it('should close when HR clicks elsewhere', async () => {
    // Arrange
    show('?trang-thai=all');
    await openMenu();

    // Act
    await userEvent.click(rowOf('An Nguyễn'));

    // Assert
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('should open the sources dialog from "Quản lý nguồn"', async () => {
    // Arrange
    show('?trang-thai=all');
    await openMenu();

    // Act
    await userEvent.click(screen.getByRole('menuitem', { name: 'Quản lý nguồn' }));

    // Assert
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.querySelector('dialog[open]')).not.toBeNull();
  });

  it('should start picking for the reviewer from "Gửi sếp duyệt", and leave it out of the menu while picking', async () => {
    // Arrange
    show('?trang-thai=all');
    await openMenu();

    // Act
    await userEvent.click(screen.getByRole('menuitem', { name: 'Gửi sếp duyệt' }));

    // Assert
    expect(screen.getAllByRole('checkbox', { name: /An Nguyễn/ })).toHaveLength(1);
    expect(screen.getByText('Bấm vào ứng viên để chọn gửi sếp duyệt.', { exact: false })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Thêm' }));
    expect(screen.queryByRole('menuitem', { name: 'Gửi sếp duyệt' })).toBeNull();
  });

  it('should leave out "Gửi sếp duyệt" when there is nobody to send', async () => {
    // Arrange
    rows = [];
    show('?trang-thai=all');
    await screen.findByText('Chưa có hồ sơ ở trạng thái này.');

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Thêm' }));

    // Assert
    expect(screen.queryByRole('menuitem', { name: 'Gửi sếp duyệt' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Quản lý nguồn' })).toBeTruthy();
  });
});

describe('Going through candidates one after another', () => {
  it('should show the position of the open profile', async () => {
    // Act
    show('?trang-thai=all&id=a2');
    await heading('Bình Trần');

    // Assert
    expect(counter().textContent).toBe('2/4');
  });

  it('should go to the next and the previous profile and update the position', async () => {
    // Arrange
    show('?trang-thai=all&id=a2');
    await heading('Bình Trần');

    // Act + Assert
    await userEvent.click(screen.getByRole('button', { name: 'Hồ sơ tiếp' }));
    await heading('Chi Lê');
    expect(counter().textContent).toBe('3/4');

    await userEvent.click(screen.getByRole('button', { name: 'Hồ sơ trước' }));
    await heading('Bình Trần');
    expect(counter().textContent).toBe('2/4');
  });

  it('should keep the focus on the button HR pressed, so it can be pressed again', async () => {
    // Arrange
    show('?trang-thai=all&id=a1');
    await heading('An Nguyễn');
    const next = screen.getByRole('button', { name: 'Hồ sơ tiếp' });

    // Act
    await userEvent.click(next);
    await heading('Bình Trần');

    // Assert
    expect(document.activeElement).toBe(next);
  });

  it('should do nothing on "Hồ sơ trước" at the first profile and "Hồ sơ tiếp" at the last', async () => {
    // Arrange
    show('?trang-thai=all&id=a1');
    await heading('An Nguyễn');
    const prev = screen.getByRole('button', { name: 'Hồ sơ trước' });

    // Act
    await userEvent.click(prev);

    // Assert
    expect(prev.getAttribute('aria-disabled')).toBe('true');
    expect(counter().textContent).toBe('1/4');

    // Arrange
    cleanup();
    show('?trang-thai=all&id=a4');
    await heading('Dũng Phạm');

    // Assert
    expect(screen.getByRole('button', { name: 'Hồ sơ tiếp' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('should keep profiles HR opened in the "Mới" tab, so the position holds and "Hồ sơ trước" goes back', async () => {
    // Arrange
    rows = [row('a1', 'An Nguyễn', 'new'), row('a2', 'Bình Trần', 'new'), row('a3', 'Chi Lê', 'new')];
    show('?trang-thai=new&id=a1');
    await heading('An Nguyễn');

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Hồ sơ tiếp' }));
    await heading('Bình Trần');
    await waitFor(() => expect(within(rowOf('An Nguyễn')).getByText('Đã xem')).toBeTruthy());

    // Assert
    expect(counter().textContent).toBe('2/3');
    await userEvent.click(screen.getByRole('button', { name: 'Hồ sơ trước' }));
    await heading('An Nguyễn');
    expect(counter().textContent).toBe('1/3');
  });

  it('should close the open profile and list only that status when another status tab is pressed', async () => {
    // Arrange
    rows = [row('a1', 'An Nguyễn', 'new'), row('a2', 'Bình Trần', 'seen'), row('a3', 'Chi Lê', 'seen')];
    show('?trang-thai=seen&id=a2');
    await heading('Bình Trần');

    // Act
    await userEvent.click(statusTab('Mới'));

    // Assert
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Bình Trần', level: 2 })).toBeNull());
    expect(rowOf('An Nguyễn')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Bình Trần/ })).toBeNull();
    expect(screen.queryByRole('button', { current: true })).toBeNull();
    expect(screen.queryByText('Hồ sơ đang mở không có trong danh sách đang lọc.')).toBeNull();
  });

  it.each([
    ['the job filter', async () => userEvent.selectOptions(screen.getByLabelText('Lọc theo vị trí'), 'j2')],
    ['the search box', async () => userEvent.type(screen.getByRole('searchbox'), 'B')],
  ])('should close the open profile when %s changes the list', async (_what, act) => {
    // Arrange
    show('?trang-thai=all&id=a1');
    await heading('An Nguyễn');

    // Act
    await act();

    // Assert
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'An Nguyễn', level: 2 })).toBeNull());
  });

  it('should keep the profile open when the list is only sorted differently', async () => {
    // Arrange
    show('?trang-thai=all&id=a1');
    await heading('An Nguyễn');

    // Act
    await userEvent.click(screen.getByRole('checkbox', { name: /Xếp theo %/ }));

    // Assert
    expect(await heading('An Nguyễn')).toBeTruthy();
  });

  it('should say on the row how many bonuses the CV shows', async () => {
    // Arrange
    rows = [row('a1', 'An Nguyễn', 'seen', { matchBonus: 2 }), row('a2', 'Bình Trần', 'seen', { matchBonus: 0 })];

    // Act
    show('?trang-thai=all');
    await screen.findByText('An Nguyễn');

    // Assert
    expect(within(rowOf('An Nguyễn')).getByText('+2 điểm cộng')).toBeTruthy();
    expect(within(rowOf('Bình Trần')).queryByText(/điểm cộng/)).toBeNull();
  });

  it('should keep a profile open and say so when the filters leave it out of the list', async () => {
    // Arrange
    details = { a9: { fullName: 'Người Ngoài Danh Sách' } };

    // Act
    show('?trang-thai=all&id=a9');
    await heading('Người Ngoài Danh Sách');

    // Assert
    expect(counter().textContent).toBe('–/4');
    expect(screen.getByText('Hồ sơ đang mở không có trong danh sách đang lọc.')).toBeTruthy();
    expect(screen.queryByRole('button', { current: true })).toBeNull();

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Hồ sơ tiếp' }));

    // Assert
    await heading('An Nguyễn');
    expect(screen.queryByText('Hồ sơ đang mở không có trong danh sách đang lọc.')).toBeNull();
  });

  it('should save a note being typed when HR moves on', async () => {
    // Arrange
    show('?trang-thai=all&id=a1');
    await heading('An Nguyễn');
    await userEvent.click(screen.getByLabelText(/Ghi chú nội bộ/));
    await userEvent.paste('Đã gọi');

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Hồ sơ tiếp' }));
    await heading('Bình Trần');

    // Assert
    await waitFor(() => expect(patches).toContainEqual({ id: 'a1', body: { note: 'Đã gọi' } }));
  });
});

describe('Keyboard shortcuts', () => {
  const start = async () => {
    show('?trang-thai=all&id=a2');
    await heading('Bình Trần');
  };

  it('should go to the next profile on J and the previous on K', async () => {
    // Arrange
    await start();

    // Act + Assert
    await userEvent.keyboard('j');
    await heading('Chi Lê');
    await userEvent.keyboard('k');
    await heading('Bình Trần');
    await userEvent.keyboard('K');
    await heading('An Nguyễn');
  });

  it.each([
    ['the note', () => screen.getByLabelText(/Ghi chú nội bộ/)],
    ['a select', () => screen.getByLabelText('Lọc theo vị trí')],
  ])('should do nothing while typing in %s', async (_name, field) => {
    // Arrange
    await start();
    field().focus();

    // Act
    await userEvent.keyboard('j');
    await userEvent.keyboard('k');

    // Assert
    expect(counter().textContent).toBe('2/4');
  });

  it('should not open another profile while typing in the search box', async () => {
    // Arrange
    await start();
    screen.getByRole('searchbox').focus();

    // Act
    await userEvent.keyboard('j');
    await userEvent.keyboard('k');

    // Assert
    await waitFor(() => expect(screen.queryByRole('heading', { level: 2 })).toBeNull());
  });

  it('should do nothing while the mail dialog is open', async () => {
    // Arrange
    await start();
    await userEvent.click(screen.getByRole('button', { name: 'Soạn thư' }));
    await screen.findByLabelText('Mẫu thư');
    (document.activeElement as HTMLElement | null)?.blur();

    // Act
    await userEvent.keyboard('j');

    // Assert
    expect(counter().textContent).toBe('2/4');
  });

  it('should do nothing while the "Thêm" menu is open', async () => {
    // Arrange
    await start();
    await userEvent.click(screen.getByRole('button', { name: 'Thêm' }));

    // Act
    await userEvent.keyboard('j');

    // Assert
    expect(counter().textContent).toBe('2/4');
  });

  it('should leave browser shortcuts such as Ctrl+K alone', async () => {
    // Arrange
    await start();

    // Act
    await userEvent.keyboard('{Control>}j{/Control}');
    await userEvent.keyboard('{Meta>}k{/Meta}');

    // Assert
    expect(counter().textContent).toBe('2/4');
  });

  it('should not move while picking for the reviewer', async () => {
    // Arrange
    await start();
    await userEvent.click(screen.getByRole('button', { name: 'Thêm' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Gửi sếp duyệt' }));

    // Act
    await userEvent.keyboard('j');

    // Assert
    expect(screen.getByRole('heading', { name: 'Bình Trần', level: 2 })).toBeTruthy();
  });
});

describe('The list', () => {
  it('should mark only the open row as current, and move the mark with the profile', async () => {
    // Arrange
    show('?trang-thai=all&id=a1');
    await heading('An Nguyễn');

    // Assert
    expect(screen.getAllByRole('button', { current: true })).toHaveLength(1);
    expect(openRow().textContent).toContain('An Nguyễn');

    // Act
    await userEvent.click(rowOf('Chi Lê'));
    await heading('Chi Lê');

    // Assert
    expect(screen.getAllByRole('button', { current: true })).toHaveLength(1);
    expect(openRow().textContent).toContain('Chi Lê');
  });

  it('should show the status on rows in the "Tất cả" tab', async () => {
    // Act
    show('?trang-thai=all');
    await screen.findByText('An Nguyễn');

    // Assert
    expect(within(rowOf('An Nguyễn')).getByText('Đã xem')).toBeTruthy();
    expect(within(rowOf('Chi Lê')).getByText('Hẹn phỏng vấn')).toBeTruthy();
    expect(within(rowOf('Dũng Phạm')).getByText('Chưa phù hợp')).toBeTruthy();
  });

  it('should not repeat the status on rows in a status tab', async () => {
    // Act
    show('?trang-thai=seen');
    await screen.findByText('An Nguyễn');

    // Assert
    expect(within(rowOf('An Nguyễn')).queryByText('Đã xem')).toBeNull();
    expect(within(rowOf('Bình Trần')).queryByText('Đã xem')).toBeNull();
  });

  it('should show right away, on the open row, a status change made in the detail', async () => {
    // Arrange
    show('?trang-thai=seen&id=a1');
    await heading('An Nguyễn');

    // Act
    await userEvent.click(statusButton('Chưa phù hợp'));

    // Assert
    await waitFor(() => expect(within(openRow()).getByText('Chưa phù hợp')).toBeTruthy());
  });

  it('should tag a profile with no CV and one added by HR, and leave ordinary rows untagged', async () => {
    // Act
    show('?trang-thai=seen');
    await screen.findByText('An Nguyễn');
    const ordinary = rowOf('An Nguyễn');
    const noCv = rowOf('Bình Trần');
    cleanup();
    show('?trang-thai=interview');
    await screen.findByText('Chi Lê');

    // Assert
    expect(ordinary.textContent).not.toMatch(/Không CV|HR thêm/);
    expect(noCv.textContent).toContain('Không CV');
    expect(rowOf('Chi Lê').textContent).toContain('HR thêm');
  });

  it('should show name, percent, position and date on a row', async () => {
    // Act
    show('?trang-thai=seen');
    await screen.findByText('An Nguyễn');
    const text = rowOf('An Nguyễn').textContent;

    // Assert
    expect(text).toContain('80%');
    expect(text).toContain('Kế toán');
    expect(text).toContain('20/10/2026');
  });

  it('should keep the reviewer state and the note on a row', async () => {
    // Arrange
    rows = [row('a1', 'An Nguyễn', 'seen', { review: 'waiting', noteLine: 'Hẹn gọi lại' })];

    // Act
    show('?trang-thai=seen');
    await screen.findByText('An Nguyễn');

    // Assert
    expect(rowOf('An Nguyễn').textContent).toContain('Chờ sếp duyệt');
    expect(rowOf('An Nguyễn').textContent).toContain('Hẹn gọi lại');
  });
});

describe('The interview time in the mail drawer', () => {
  const pickTomorrow = async () => {
    show('?trang-thai=all&id=a1');
    await heading('An Nguyễn');
    await userEvent.click(screen.getByRole('button', { name: 'Soạn thư' }));
    const mail = screen.getByRole('dialog', { name: 'Soạn thư' });
    await userEvent.selectOptions(await within(mail).findByLabelText('Mẫu thư'), 'interview_onsite');
    await userEvent.click(within(mail).getByRole('button', { name: /^Giờ phỏng vấn/ }));
    const picker = screen.getByRole('dialog', { name: 'Chọn ngày giờ phỏng vấn' });
    await userEvent.click(within(picker).getByRole('button', { name: 'Ngày mai' }));
    await userEvent.click(within(picker).getByRole('button', { name: 'Áp dụng' }));
  };

  it('should move to "Hẹn phỏng vấn" with the time once HR confirms', async () => {
    // Arrange
    vi.stubGlobal('confirm', () => true);

    // Act
    await pickTomorrow();

    // Assert
    await waitFor(() => expect(patches.at(-1)?.body.status).toBe('interview'));
    expect(String(patches.at(-1)?.body.interviewAt)).toMatch(/T09:00:00\+07:00$/);
  });

  it('should change nothing when HR declines the confirmation', async () => {
    // Arrange
    vi.stubGlobal('confirm', () => false);

    // Act
    await pickTomorrow();

    // Assert
    expect(patches).toEqual([]);
  });
});

describe('The status tabs', () => {
  it.each([
    ['all', 'Tất cả 4', 'border-navy'],
    ['seen', 'Đã xem 2', 'border-status-seen'],
    ['interview', 'Hẹn phỏng vấn 1', 'border-status-interview'],
    ['rejected', 'Chưa phù hợp 1', 'border-status-rejected'],
  ])('should show the icon, word and count on "%s", with its colour while active', async (tab, name, border) => {
    // Act
    show(`?trang-thai=${tab}`);
    await screen.findByRole('list', { name: 'Danh sách hồ sơ' });
    const button = await screen.findByRole('button', { name, pressed: true });

    // Assert
    expect(button.querySelector('svg')).not.toBeNull();
    expect(button.className).toContain(border);
  });
});

describe('The note on a row', () => {
  it('should stand on its own line with the whole text as a tooltip', async () => {
    // Arrange
    const noteLine = 'Đã gọi hai lần, ứng viên hẹn gọi lại chiều thứ sáu sau giờ làm việc vì đang bận công tác';
    rows = [row('a1', 'An Nguyễn', 'seen', { noteLine })];

    // Act
    show('?trang-thai=seen');
    await screen.findByText('An Nguyễn');

    // Assert
    const note = within(rowOf('An Nguyễn')).getByTitle(noteLine);
    expect(note.textContent).toBe(`“${noteLine}”`);
  });

  it('should add no note line to a row without a note', async () => {
    // Act
    show('?trang-thai=seen');
    await screen.findByText('An Nguyễn');

    // Assert
    expect(rowOf('An Nguyễn').textContent).not.toContain('“');
  });
});

describe('The status control in the header', () => {
  it('should offer to undo a change, and undo it', async () => {
    // Arrange
    show('?trang-thai=all&id=a1');
    await heading('An Nguyễn');

    // Act
    await userEvent.click(statusButton('Chưa phù hợp'));
    await userEvent.click(await screen.findByRole('button', { name: 'Hoàn tác' }));

    // Assert
    await waitFor(() => expect(patches.at(-1)?.body.status).toBe('seen'));
  });

  it('should offer the thank-you mail right after "Chưa phù hợp"', async () => {
    // Arrange
    show('?trang-thai=all&id=a1');
    await heading('An Nguyễn');

    // Act
    await userEvent.click(statusButton('Chưa phù hợp'));
    await userEvent.click(await screen.findByRole('button', { name: 'Soạn thư cảm ơn' }));

    // Assert
    expect(await screen.findByLabelText('Mẫu thư')).toBeTruthy();
  });

  const block = () => within(screen.getByRole('group', { name: 'Cập nhật trạng thái' }));
  const segment = (name: string) => block().getByRole('button', { name });
  const pressedOnes = () =>
    block()
      .getAllByRole('button', { pressed: true })
      .map((button) => button.textContent);

  it('should show every status the code has, in one block', async () => {
    // Act
    show('?trang-thai=all&id=a1');
    await heading('An Nguyễn');

    // Assert
    expect(
      block()
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Mới', 'Đã xem', 'Hẹn phỏng vấn', 'Chưa phù hợp']);
  });

  it.each([
    ['a1', 'An Nguyễn', 'Đã xem'],
    ['a3', 'Chi Lê', 'Hẹn phỏng vấn'],
    ['a4', 'Dũng Phạm', 'Chưa phù hợp'],
  ])('should mark only the current status of %s as active, with a tick as well as colour', async (id, name, label) => {
    // Act
    show(`?trang-thai=all&id=${id}`);
    await heading(name);

    // Assert
    expect(pressedOnes()).toEqual([label]);
    expect(segment(label).querySelector('svg')).not.toBeNull();
  });

  it('should move the active mark as soon as the status changes', async () => {
    // Arrange
    show('?trang-thai=all&id=a1');
    await heading('An Nguyễn');

    // Act
    await userEvent.click(segment('Chưa phù hợp'));

    // Assert
    await waitFor(() => expect(pressedOnes()).toEqual(['Chưa phù hợp']));
  });

  it('should send nothing when HR presses the status it already has', async () => {
    // Arrange
    show('?trang-thai=all&id=a3');
    await heading('Chi Lê');

    // Act
    await userEvent.click(segment('Hẹn phỏng vấn'));

    // Assert
    expect(patches).toEqual([]);
  });

  it('should not let HR choose "Đã xem", and say why when pressed', async () => {
    // Arrange
    show('?trang-thai=all&id=a3');
    await heading('Chi Lê');
    const seen = segment('Đã xem');
    expect(seen.getAttribute('aria-disabled')).toBe('true');
    expect(seen.getAttribute('title')).toBe('Hồ sơ tự chuyển sang "Đã xem" khi được mở.');

    // Act
    await userEvent.click(seen);

    // Assert
    expect(patches).toEqual([]);
    expect(block().getByRole('status').textContent).toBe('Hồ sơ tự chuyển sang "Đã xem" khi được mở.');
  });

  it('should mark a profile as not seen again from "Mới"', async () => {
    // Arrange
    show('?trang-thai=all&id=a1');
    await heading('An Nguyễn');
    expect(segment('Mới').getAttribute('title')).toBe('Đánh dấu chưa xem');

    // Act
    await userEvent.click(segment('Mới'));

    // Assert
    await waitFor(() => expect(patches.at(-1)?.body.status).toBe('new'));
  });

  it('should undo a change after "Hẹn phỏng vấn" back to the status before it', async () => {
    // Arrange
    show('?trang-thai=all&id=a1');
    await heading('An Nguyễn');

    // Act
    await userEvent.click(segment('Hẹn phỏng vấn'));
    await userEvent.click(await screen.findByRole('button', { name: 'Hoàn tác' }));

    // Assert
    await waitFor(() => expect(patches.at(-1)?.body.status).toBe('seen'));
    await waitFor(() => expect(pressedOnes()).toEqual(['Đã xem']));
  });

  it('should show the interview time only when the status is "Hẹn phỏng vấn"', async () => {
    // Arrange
    show('?trang-thai=all&id=a1');
    await heading('An Nguyễn');
    expect(screen.queryByRole('group', { name: 'Hình thức phỏng vấn' })).toBeNull();

    // Act
    await userEvent.click(segment('Hẹn phỏng vấn'));

    // Assert
    expect(await screen.findByRole('group', { name: 'Hình thức phỏng vấn' })).toBeTruthy();
  });

  describe('with a reviewer who has not approved', () => {
    beforeEach(() => {
      rows = [row('a1', 'An Nguyễn', 'seen', { review: 'waiting' })];
      details = {
        a1: {
          reviewInfo: {
            batchId: 'b1',
            title: 'Đợt 1',
            reviewerName: 'Anh Hùng',
            decision: null,
            reviewerComment: null,
            cvChangedAfterDecision: false,
          },
        },
      };
    });

    it('should ask why before "Hẹn phỏng vấn", and change nothing until HR confirms', async () => {
      // Arrange
      show('?trang-thai=all&id=a1');
      await heading('An Nguyễn');

      // Act
      await userEvent.click(statusButton('Hẹn phỏng vấn'));

      // Assert
      expect(screen.getByLabelText('Lý do vẫn hẹn phỏng vấn')).toBeTruthy();
      expect(patches).toEqual([]);
    });

    it('should send the reason with the change once HR confirms', async () => {
      // Arrange
      show('?trang-thai=all&id=a1');
      await heading('An Nguyễn');
      await userEvent.click(statusButton('Hẹn phỏng vấn'));
      await userEvent.type(screen.getByLabelText('Lý do vẫn hẹn phỏng vấn'), 'Ứng viên chỉ rảnh chiều nay');

      // Act
      await userEvent.click(screen.getByRole('button', { name: 'Vẫn hẹn phỏng vấn' }));

      // Assert
      await waitFor(() =>
        expect(patches).toContainEqual({
          id: 'a1',
          body: { status: 'interview', reviewBypassReason: 'Ứng viên chỉ rảnh chiều nay' },
        }),
      );
    });
  });
});

describe('"Xem CV" in the detail header', () => {
  const FILE_URL = '/api/hr/applications/a1/cv';
  const open = async (over: Partial<ApplicationDetailDto> = {}) => {
    details = { a1: over };
    show('?trang-thai=all&id=a1');
    await heading('An Nguyễn');
    const header = document.querySelector('section[aria-label="Chi tiết ứng viên"] header');
    if (!(header instanceof HTMLElement)) throw new Error('The detail has no header');
    return within(header);
  };

  it('should sit beside Gọi, Zalo and Soạn thư, and open a stored file in a new tab from the HR address', async () => {
    // Act
    const header = await open({ cvFileName: 'CV.pdf', cvLink: null });

    // Assert
    expect(header.getByRole('link', { name: 'Gọi' })).toBeTruthy();
    expect(header.getByRole('link', { name: 'Zalo' })).toBeTruthy();
    expect(header.getByRole('button', { name: 'Soạn thư' })).toBeTruthy();
    const link = header.getByRole('link', { name: 'Xem CV' });
    expect(link.getAttribute('href')).toBe(FILE_URL);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('should open a pasted link', async () => {
    // Arrange
    const cvLink = 'https://drive.google.com/file/d/1AbCdEf/view';

    // Act
    const header = await open({ cvFileName: null, cvLink });

    // Assert
    expect(header.getByRole('link', { name: 'Mở link CV' }).getAttribute('href')).toBe(cvLink);
  });

  it('should be disabled with no CV, with "Thêm CV" in the detail', async () => {
    // Act
    const header = await open({ cvFileName: null, cvLink: null, hasCv: false });

    // Assert
    expect(header.getByText('Chưa có CV').getAttribute('aria-disabled')).toBe('true');
    expect(header.queryByRole('link', { name: /CV/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Thêm CV' })).toBeTruthy();
  });

  it('should keep "Đổi CV" in the detail for a stored file', async () => {
    // Act
    await open({ cvFileName: 'CV.pdf', cvLink: null });

    // Assert
    expect(screen.getByRole('button', { name: 'Đổi CV' })).toBeTruthy();
  });

  it('should never put the CV inside the page', async () => {
    // Act
    await open({ cvFileName: 'CV.pdf', cvLink: null });

    // Assert
    expect(document.querySelector('iframe')).toBeNull();
  });
});

describe('On a phone', () => {
  beforeEach(() => {
    screenWidth = 390;
  });

  it('should open the profile in the sheet with Gọi, Zalo and Soạn thư at the bottom', async () => {
    // Act
    show('?trang-thai=all&id=a1');
    await heading('An Nguyễn');

    // Assert
    const dialog = screen.getByRole('dialog', { name: 'Chi tiết ứng viên' });
    const bar = dialog.querySelector('footer');
    if (!bar) throw new Error('The sheet has no action bar');
    expect(within(bar).getByRole('link', { name: 'Gọi' })).toBeTruthy();
    expect(within(bar).getByRole('link', { name: 'Zalo' })).toBeTruthy();
    expect(within(bar).getByRole('button', { name: 'Soạn thư' })).toBeTruthy();
  });

  it('should keep "Xem CV" in the bar at the bottom, as a link to the HR address', async () => {
    // Act
    show('?trang-thai=all&id=a1');
    await heading('An Nguyễn');

    // Assert
    const bar = screen.getByRole('dialog', { name: 'Chi tiết ứng viên' }).querySelector('footer');
    if (!bar) throw new Error('The sheet has no action bar');
    expect(within(bar).getByRole('link', { name: 'Xem CV' }).getAttribute('href')).toBe('/api/hr/applications/a1/cv');
  });

  it('should offer the whole name with its copy button in the sheet', async () => {
    // Act
    show('?trang-thai=all&id=a1');
    await heading('An Nguyễn');

    // Assert
    expect(screen.getByRole('button', { name: 'Sao chép họ tên' })).toBeTruthy();
  });

  it('should close only the drawer on Esc, and leave the sheet open under it', async () => {
    // Arrange
    show('?trang-thai=all&id=a1');
    await heading('An Nguyễn');
    await userEvent.click(screen.getByRole('button', { name: 'Xem chấm CV' }));
    const drawer = screen.getByRole('dialog', { name: 'Chấm CV' });

    // Act: the browser turns Esc on a modal dialog into a "cancel" event on the top one.
    fireEvent(drawer, new Event('cancel', { cancelable: true }));

    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Chấm CV' })).toBeNull());
    expect(screen.getByRole('dialog', { name: 'Chi tiết ứng viên' })).toBeTruthy();
  });

  it('should go to the next profile inside the sheet', async () => {
    // Arrange
    show('?trang-thai=all&id=a1');
    await heading('An Nguyễn');

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Hồ sơ tiếp' }));

    // Assert
    await heading('Bình Trần');
    expect(counter().textContent).toBe('2/4');
  });
});
