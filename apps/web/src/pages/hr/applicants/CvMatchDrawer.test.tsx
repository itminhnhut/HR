import type { ApplicationDetailDto, CvScoreDto, MatchItem } from '@careers/shared';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => vi.stubEnv('VITE_API_URL', '/api'));
import { application, mocks, useFlowServer, wrap } from './AddApplicationFlow.helpers';
import { ApplicantDetail } from './ApplicantDetail';

useFlowServer();

const line = (requirement: string, verdict: MatchItem['verdict'], over: object = {}): MatchItem => ({
  requirement,
  verdict,
  evidence: null,
  reason: null,
  ...over,
});

const MET = line('Biết Excel', 'met', { evidence: 'Excel nâng cao' });
const UNMET = line('Từ 2 năm kinh nghiệm', 'unmet', { reason: 'CV ghi 1 năm, yêu cầu từ 2 năm' });
const UNKNOWN = line('Chịu được áp lực', 'unknown', { reason: 'CV không thể hiện được, HR tự đánh giá' });

const scoreOf = (items: MatchItem[], over: Partial<CvScoreDto> = {}): CvScoreDto => ({
  percent: 50,
  items,
  scoredAt: '2026-10-20T03:00:00.000Z',
  note: null,
  ...over,
});

const storedPdf = (over: Partial<ApplicationDetailDto> = {}) =>
  application({ cvLink: null, cvFileName: 'CV.pdf', ...over });

async function openDetail(app: ApplicationDetailDto) {
  mocks.shownApplication = app;
  mocks.scoredApplication = app;
  render(wrap(<ApplicantDetail id="a1" onDeleted={() => undefined} />));
  await screen.findByRole('heading', { name: 'Trần Minh Khoa', level: 2 });
  return screen.getByRole('region', { name: 'Chấm CV theo yêu cầu' });
}

async function openDrawer(app: ApplicationDetailDto) {
  const section = await openDetail(app);
  const button = within(section).getByRole('button', { name: 'Xem chấm CV' });
  await userEvent.click(button);
  return { dialog: screen.getByRole('dialog', { name: 'Chấm CV' }), button };
}

const selectedTab = (dialog: HTMLElement) => within(dialog).getByRole('tab', { selected: true });
const scoreCalls = () => mocks.sent.filter((s) => s.url.endsWith('/score'));

describe('Lines split by the part of the job', () => {
  const DUTY_MET = line('Lập báo cáo tuyển dụng', 'met', {
    section: 'duties',
    counted: false,
    evidence: 'Lập báo cáo tuyển dụng hàng tháng',
  });
  const DUTY_OPEN = line('Thương lượng hợp đồng', 'unknown', { section: 'duties', counted: false });

  it('should show "Yêu cầu" before "Mô tả công việc" within a tab, each with what the CV shows', async () => {
    // Act
    const { dialog } = await openDrawer(storedPdf({ cvScore: scoreOf([DUTY_MET, MET]) }));

    // Assert
    const titles = within(dialog)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(titles).toEqual(['Yêu cầu (1)', 'Mô tả công việc (1)']);
    const duties = within(dialog).getByRole('region', { name: 'Mô tả công việc' });
    expect(within(duties).getByText('Trong CV: “Lập báo cáo tuyển dụng hàng tháng”')).toBeTruthy();
  });

  it('should count a met job description line as met although it stays out of the percent', async () => {
    // Act
    const { dialog } = await openDrawer(storedPdf({ cvScore: scoreOf([DUTY_MET, DUTY_OPEN]) }));

    // Assert
    expect(within(dialog).getByRole('tab', { name: 'Đạt: 1' })).toBeTruthy();
    expect(within(dialog).getByRole('tab', { name: 'Không chấm: 1' })).toBeTruthy();
  });

  it('should say only "Hỏi khi phỏng vấn" on a job description line the CV is silent about', async () => {
    // Arrange
    const reason = 'Không thấy việc tương tự trong phần kinh nghiệm của CV, HR hỏi thêm khi phỏng vấn';
    const silent = { ...DUTY_OPEN, reason };
    const { dialog } = await openDrawer(storedPdf({ cvScore: scoreOf([MET, silent]) }));

    // Act
    await userEvent.click(within(dialog).getByRole('tab', { name: /Không chấm/ }));

    // Assert
    const panel = within(dialog).getByRole('tabpanel');
    expect(within(panel).getByText('Hỏi khi phỏng vấn')).toBeTruthy();
    expect(within(panel).queryByText(reason)).toBeNull();
  });

  it('should say only "HR xem trực tiếp" on a requirement the scorer cannot read', async () => {
    // Arrange
    const reason = 'Không tự chấm được yêu cầu này từ CV, HR xem trực tiếp';
    const unread = line('Sẵn sàng đi công tác', 'unknown', { counted: false, reason });
    const { dialog } = await openDrawer(storedPdf({ cvScore: scoreOf([MET, unread]) }));

    // Act
    await userEvent.click(within(dialog).getByRole('tab', { name: /Không chấm/ }));

    // Assert
    const panel = within(dialog).getByRole('tabpanel');
    expect(within(panel).getByText('HR xem trực tiếp')).toBeTruthy();
    expect(within(panel).queryByText(reason)).toBeNull();
  });

  it('should not suggest asking in the interview when the CV itself could not be read', async () => {
    // Arrange: a CV kept as a link, so every line, duties too, carries the same reason.
    const reason = 'Không đọc được chữ trong CV (ảnh scan hoặc link), HR xem trực tiếp';
    const unread = line('Theo dõi tiến độ đơn hàng', 'unknown', { section: 'duties', counted: false, reason });
    const { dialog } = await openDrawer(storedPdf({ cvScore: scoreOf([unread]) }));

    // Act
    await userEvent.click(within(dialog).getByRole('tab', { name: /Không chấm/ }));

    // Assert
    const panel = within(dialog).getByRole('tabpanel');
    expect(within(panel).getByText('HR xem trực tiếp')).toBeTruthy();
    expect(within(panel).queryByText('Hỏi khi phỏng vấn')).toBeNull();
    expect(within(panel).queryByText(reason)).toBeNull();
  });

  it('should show a line with only a possibly related quote under "Không chấm", asking HR to check', async () => {
    // Arrange
    const reason = 'CV có câu có thể liên quan, HR kiểm tra lại';
    const hint = line('Quản lý nhập xuất tồn', 'unknown', {
      counted: false,
      reason,
      evidence: 'Quản lý xuất nhập tồn kho',
    });

    // Act
    const section = await openDetail(storedPdf({ cvScore: scoreOf([hint]) }));
    await userEvent.click(within(section).getByRole('button', { name: 'Không chấm: 1' }));

    // Assert
    const dialog = screen.getByRole('dialog', { name: 'Chấm CV' });
    expect(within(dialog).getByText(reason)).toBeTruthy();
    expect(within(dialog).getByText('Trong CV: “Quản lý xuất nhập tồn kho”')).toBeTruthy();
  });

  it('should show the bonuses in their own group and their count beside the percent', async () => {
    // Arrange
    const shown = line('Biết MISA', 'met', { section: 'preferred', counted: false, evidence: 'Hạch toán trên MISA' });
    const open = line('Biết SAP', 'unknown', { section: 'preferred', counted: false, reason: 'CV không thể hiện' });

    // Act
    const section = await openDetail(storedPdf({ cvScore: scoreOf([MET, shown, open], { percent: 100 }) }));
    await userEvent.click(within(section).getByRole('button', { name: 'Xem chấm CV' }));

    // Assert
    expect(within(section).getByText('+1 điểm cộng')).toBeTruthy();
    const dialog = screen.getByRole('dialog', { name: 'Chấm CV' });
    expect(within(dialog).getByRole('tab', { name: 'Đạt: 2' })).toBeTruthy();
    expect(within(dialog).getByRole('heading', { name: 'Điểm cộng (1)' })).toBeTruthy();
  });

  it('should not show a bonus badge when the CV shows no bonus', async () => {
    // Arrange
    const open = line('Biết SAP', 'unknown', { section: 'preferred', counted: false });

    // Act
    const section = await openDetail(storedPdf({ cvScore: scoreOf([MET, open], { percent: 100 }) }));

    // Assert
    expect(within(section).queryByText(/điểm cộng/)).toBeNull();
  });

  it('should say how many measurable requirements could be judged', async () => {
    // Arrange
    const items = [line('Biết Word', 'met', { counted: true }), line('Từ 2 năm', 'unknown', { counted: true })];

    // Act
    const { dialog } = await openDrawer(storedPdf({ cvScore: scoreOf(items) }));

    // Assert
    expect(within(dialog).getByText(/Chấm được 1\/2 yêu cầu đo được/)).toBeTruthy();
  });

  it('should keep a soft requirement left out of the percent under "Không chấm"', async () => {
    // Act
    const { dialog } = await openDrawer(
      storedPdf({ cvScore: scoreOf([line('Biết Word', 'met', { counted: false })]) }),
    );

    // Assert
    expect(within(dialog).getByRole('tab', { name: 'Không chấm: 1' })).toBeTruthy();
  });
});

describe('The summary row in the detail', () => {
  it('should show the percent and the counts, and none of the lines', async () => {
    // Act
    const section = await openDetail(storedPdf({ cvScore: scoreOf([MET, MET, UNMET, UNKNOWN], { percent: 67 }) }));

    // Assert
    expect(within(section).getByText('67%')).toBeTruthy();
    expect(within(section).getByRole('button', { name: 'Đạt: 2' })).toBeTruthy();
    expect(within(section).getByRole('button', { name: 'Không đạt: 1' })).toBeTruthy();
    expect(within(section).getByRole('button', { name: 'Không chấm: 1' })).toBeTruthy();
    expect(screen.queryByText(UNMET.requirement)).toBeNull();
  });

  it('should still show a count of zero, without the filled colour', async () => {
    // Act
    const section = await openDetail(storedPdf({ cvScore: scoreOf([MET], { percent: 100 }) }));

    // Assert
    const zero = within(within(section).getByRole('button', { name: 'Không đạt: 0' })).getByText('0');
    const one = within(within(section).getByRole('button', { name: 'Đạt: 1' })).getByText('1');
    expect(zero.className).toContain('bg-tint');
    expect(one.className).toContain('bg-ok');
  });

  it.each([
    ['Đạt: 2', 'Đạt: 2'],
    ['Không đạt: 1', 'Không đạt: 1'],
    ['Không chấm: 1', 'Không chấm: 1'],
  ])('should open the drawer on the right tab when "%s" is pressed', async (stat, tabName) => {
    // Arrange
    const section = await openDetail(storedPdf({ cvScore: scoreOf([MET, MET, UNMET, UNKNOWN]) }));

    // Act
    await userEvent.click(within(section).getByRole('button', { name: stat }));

    // Assert
    const dialog = screen.getByRole('dialog', { name: 'Chấm CV' });
    expect(within(dialog).getByRole('tab', { name: tabName, selected: true })).toBeTruthy();
    expect(scoreCalls()).toHaveLength(0);
  });

  it('should say "Chưa đủ dữ liệu" when lines were judged but too few for a percent', async () => {
    // Arrange
    const items = [line('A', 'unknown', { counted: true }), line('B', 'unknown', { counted: true })];

    // Act
    const section = await openDetail(storedPdf({ cvScore: scoreOf(items, { percent: null }) }));

    // Assert
    expect(within(section).getByText('Chưa đủ dữ liệu')).toBeTruthy();
    expect(within(section).queryByText(/\d+\s*%/)).toBeNull();
  });

  it('should say "Chưa chấm" before a link has been scored, with the note', async () => {
    // Act
    const section = await openDetail(application());

    // Assert
    expect(within(section).getByText('Chưa chấm')).toBeTruthy();
    expect(within(section).getByText(/CV là link/)).toBeTruthy();
  });

  it('should start scoring and open the drawer when pressed before there is a result', async () => {
    // Act
    const { dialog } = await openDrawer(application());

    // Assert
    expect(dialog).toBeTruthy();
    await waitFor(() => expect(scoreCalls()).toHaveLength(1));
  });

  it('should not score again when pressed with a result', async () => {
    // Act
    await openDrawer(storedPdf({ cvScore: scoreOf([MET]) }));

    // Assert
    expect(scoreCalls()).toHaveLength(0);
  });
});

describe('The tabs of the drawer', () => {
  it('should have exactly Đạt, Không đạt and Không chấm, with their counts', async () => {
    // Act
    const { dialog } = await openDrawer(storedPdf({ cvScore: scoreOf([MET, MET, UNMET, UNKNOWN]) }));

    // Assert
    expect(
      within(dialog)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Đạt2', 'Không đạt1', 'Không chấm1']);
  });

  it('should give each tab a name with its count', async () => {
    // Act
    const { dialog } = await openDrawer(storedPdf({ cvScore: scoreOf([MET, MET, UNMET]) }));

    // Assert
    expect(within(dialog).getByRole('tab', { name: 'Đạt: 2' })).toBeTruthy();
    expect(within(dialog).getByRole('tab', { name: 'Không đạt: 1' })).toBeTruthy();
    expect(within(dialog).getByRole('tab', { name: 'Không chấm: 0' })).toBeTruthy();
  });

  it('should start every line with the icon of its verdict', async () => {
    // Act
    const { dialog } = await openDrawer(storedPdf({ cvScore: scoreOf([UNMET]) }));

    // Assert
    const item = within(within(dialog).getByRole('tabpanel')).getByRole('listitem');
    expect(item.firstElementChild?.tagName.toLowerCase()).toBe('svg');
    expect(item.firstElementChild?.getAttribute('class')).toContain('text-error');
  });

  it('should open on "Không đạt" when it has lines', async () => {
    // Act
    const { dialog } = await openDrawer(storedPdf({ cvScore: scoreOf([MET, UNMET]) }));

    // Assert
    expect(selectedTab(dialog).textContent).toContain('Không đạt');
    expect(within(dialog).getByRole('tabpanel').textContent).toContain(UNMET.requirement);
  });

  it('should open on "Đạt" when nothing failed', async () => {
    // Act
    const { dialog } = await openDrawer(storedPdf({ cvScore: scoreOf([MET, UNKNOWN]) }));

    // Assert
    expect(selectedTab(dialog).textContent).toContain('Đạt');
  });

  it('should open on "Không đạt" when the result arrives after the drawer opened', async () => {
    // Arrange
    mocks.shownApplication = application();
    mocks.scoredApplication = application({ cvScore: scoreOf([MET, UNMET]) });
    render(wrap(<ApplicantDetail id="a1" onDeleted={() => undefined} />));
    await userEvent.click(await screen.findByRole('button', { name: 'Xem chấm CV' }));
    const dialog = screen.getByRole('dialog', { name: 'Chấm CV' });

    // Assert
    await waitFor(() => expect(selectedTab(dialog).textContent).toContain('Không đạt'));
  });

  it('should show the requirement and the quote from the CV on a met line', async () => {
    // Act
    const { dialog } = await openDrawer(storedPdf({ cvScore: scoreOf([MET]) }));

    // Assert
    const panel = within(dialog).getByRole('tabpanel');
    expect(within(panel).getByText(MET.requirement)).toBeTruthy();
    expect(within(panel).getByText(/Excel nâng cao/)).toBeTruthy();
  });

  it('should show the reason on a line that was not met', async () => {
    // Act
    const { dialog } = await openDrawer(storedPdf({ cvScore: scoreOf([UNMET]) }));

    // Assert
    expect(within(within(dialog).getByRole('tabpanel')).getByText('CV ghi 1 năm, yêu cầu từ 2 năm')).toBeTruthy();
  });

  it('should put unknown lines and lines that do not count under "Không chấm", each with a reason', async () => {
    // Arrange
    const bonus = line('Có bằng lái là điểm cộng', 'met', { counted: false, evidence: 'Bằng B2' });
    const soft = line('Hoà đồng', 'unmet', { counted: false });
    const silent = line('Trung thực', 'unknown');
    const { dialog } = await openDrawer(storedPdf({ cvScore: scoreOf([MET, UNKNOWN, bonus, soft, silent]) }));

    // Act
    await userEvent.click(within(dialog).getByRole('tab', { name: /Không chấm/ }));

    // Assert
    const panel = within(dialog).getByRole('tabpanel');
    expect(within(dialog).getByRole('tab', { name: /Không chấm/ }).textContent).toContain('4');
    expect(within(dialog).getByRole('tab', { name: /^Đạt/ }).textContent).toContain('1');
    expect(within(panel).getByText(UNKNOWN.reason ?? '')).toBeTruthy();
    expect(within(panel).getAllByText(/Không tính vào %/)).toHaveLength(2);
    expect(within(panel).getByText('Không chấm được từ CV, HR tự đánh giá.')).toBeTruthy();
  });

  it.each([
    ['Đạt', [UNKNOWN], /^Đạt/, 'Chưa có yêu cầu nào đạt.'],
    ['Không đạt', [MET], /Không đạt/, 'Không có yêu cầu nào không đạt.'],
    ['Không chấm', [MET], /Không chấm/, 'Hệ thống đã chấm hết các yêu cầu.'],
  ])('should say so when "%s" has no lines', async (_name, items, tabName, message) => {
    // Arrange
    const { dialog } = await openDrawer(storedPdf({ cvScore: scoreOf(items) }));

    // Act
    await userEvent.click(within(dialog).getByRole('tab', { name: tabName }));

    // Assert
    expect(within(within(dialog).getByRole('tabpanel')).getByText(message)).toBeTruthy();
  });

  it('should move between the tabs with the arrow keys, and only the selected tab can take focus', async () => {
    // Arrange
    const { dialog } = await openDrawer(storedPdf({ cvScore: scoreOf([MET, UNMET, UNKNOWN]) }));
    selectedTab(dialog).focus();

    // Act + Assert
    await userEvent.keyboard('{ArrowRight}');
    expect(selectedTab(dialog).textContent).toContain('Không chấm');
    expect(document.activeElement).toBe(selectedTab(dialog));
    await userEvent.keyboard('{ArrowRight}');
    expect(selectedTab(dialog).textContent).toContain('Đạt');
    await userEvent.keyboard('{ArrowLeft}');
    expect(selectedTab(dialog).textContent).toContain('Không chấm');
    await userEvent.keyboard('{Home}');
    expect(selectedTab(dialog).textContent).toContain('Đạt');
    await userEvent.keyboard('{End}');
    expect(selectedTab(dialog).textContent).toContain('Không chấm');
    expect(
      within(dialog)
        .getAllByRole('tab')
        .filter((tab) => tab.getAttribute('tabindex') === '0'),
    ).toEqual([selectedTab(dialog)]);
  });

  it('should tie the panel to its tab', async () => {
    // Act
    const { dialog } = await openDrawer(storedPdf({ cvScore: scoreOf([UNMET]) }));

    // Assert
    const panel = within(dialog).getByRole('tabpanel');
    expect(selectedTab(dialog).getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(selectedTab(dialog).id);
  });
});

describe('The header and notes of the drawer', () => {
  it('should show who it is about, the percent and "Chấm lại"', async () => {
    // Act
    const { dialog } = await openDrawer(storedPdf({ cvScore: scoreOf([MET], { percent: 91 }) }));

    // Assert
    expect(within(dialog).getByText('Trần Minh Khoa · Kế toán')).toBeTruthy();
    expect(within(dialog).getByText('91%')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Chấm lại' })).toBeTruthy();
  });

  it('should offer "Xem CV", to compare the lines with the CV', async () => {
    // Act
    const { dialog } = await openDrawer(storedPdf({ cvScore: scoreOf([MET]) }));

    // Assert
    const link = within(dialog).getByRole('link', { name: 'Xem CV' });
    expect(link.getAttribute('href')).toBe('/api/hr/applications/a1/cv');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('should offer a pasted link the same way', async () => {
    // Act
    const { dialog } = await openDrawer(application());

    // Assert
    expect(within(dialog).getByRole('link', { name: 'Mở link CV' })).toBeTruthy();
  });

  it('should score again from "Chấm lại"', async () => {
    // Arrange
    const { dialog } = await openDrawer(storedPdf({ cvScore: scoreOf([MET]) }));

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'Chấm lại' }));

    // Assert
    await waitFor(() => expect(scoreCalls()).toHaveLength(1));
  });

  it('should show the note and the way to add a PDF for a link', async () => {
    // Arrange
    const { dialog } = await openDrawer(application());

    // Assert
    expect(within(dialog).getByText(/CV là link/)).toBeTruthy();

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tải file PDF' }));

    // Assert
    expect(within(dialog).getByRole('button', { name: 'Lưu CV' })).toBeTruthy();
  });

  it('should show the way to add a PDF when there is no CV', async () => {
    // Act
    const { dialog } = await openDrawer(application({ cvLink: null, hasCv: false }));

    // Assert
    expect(within(dialog).getByText(/Hồ sơ này chưa có CV/)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Tải file PDF' })).toBeTruthy();
  });

  it('should not offer to add a PDF when the CV already is one', async () => {
    // Act
    const { dialog } = await openDrawer(storedPdf({ cvScore: scoreOf([MET]) }));

    // Assert
    expect(within(dialog).queryByRole('button', { name: 'Tải file PDF' })).toBeNull();
  });

  it('should say a file could not be read, from the result', async () => {
    // Arrange
    const note = 'Không đọc được chữ trong CV (ảnh scan), HR xem trực tiếp';

    // Act
    const { dialog } = await openDrawer(storedPdf({ cvScore: scoreOf([UNKNOWN], { percent: null, note }) }));

    // Assert
    expect(within(dialog).getByText(note)).toBeTruthy();
    expect(selectedTab(dialog).textContent).toContain('Đạt');
  });
});

describe('Opening and closing the drawer', () => {
  it('should close from the close button and give the focus back', async () => {
    // Arrange
    const { dialog, button } = await openDrawer(storedPdf({ cvScore: scoreOf([MET]) }));
    button.focus();

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'Đóng' }));

    // Assert
    expect(screen.queryByRole('dialog', { name: 'Chấm CV' })).toBeNull();
  });

  it('should close on Esc', async () => {
    // Arrange
    const { dialog } = await openDrawer(storedPdf({ cvScore: scoreOf([MET]) }));

    // Act: the browser turns Esc on a modal dialog into a "cancel" event.
    fireEvent(dialog, new Event('cancel', { cancelable: true }));

    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Chấm CV' })).toBeNull());
  });

  it('should close on a click outside it', async () => {
    // Arrange
    const { dialog } = await openDrawer(storedPdf({ cvScore: scoreOf([MET]) }));

    // Act: a click on the backdrop reaches the dialog element itself.
    fireEvent.click(dialog);

    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Chấm CV' })).toBeNull());
  });

  it('should stay open on a click inside it', async () => {
    // Arrange
    const { dialog } = await openDrawer(storedPdf({ cvScore: scoreOf([MET]) }));

    // Act
    await userEvent.click(within(dialog).getByRole('tab', { name: /Không chấm/ }));

    // Assert
    expect(screen.getByRole('dialog', { name: 'Chấm CV' })).toBeTruthy();
  });
});

describe('The other long blocks of the detail', () => {
  const contact = (createdAt: string) => ({
    createdAt,
    templateKey: 'interview_onsite' as const,
    channel: 'gmail' as const,
    hrName: 'Lan',
  });

  it('should keep phone, email and the note directly in the detail', async () => {
    // Act
    await openDetail(storedPdf({ cvScore: scoreOf([MET]), email: 'khoa@example.com' }));

    // Assert
    expect(screen.getByText('khoa@example.com')).toBeTruthy();
    expect(screen.getByText('0912 345 678')).toBeTruthy();
    expect(screen.getByLabelText(/Ghi chú nội bộ/)).toBeTruthy();
  });

  it('should sum up the contact history in a row and list every line in a drawer', async () => {
    // Arrange
    const contacts = Array.from({ length: 7 }, (_, i) => contact(`2026-10-${10 + i}T03:00:00.000Z`));
    await openDetail(storedPdf({ cvScore: scoreOf([MET]), contacts }));
    expect(screen.queryByText(/Đã soạn thư Hẹn/)).toBeNull();

    // Act
    await userEvent.click(screen.getByRole('button', { name: /Đã soạn thư 7 lần/ }));

    // Assert
    const dialog = screen.getByRole('dialog', { name: 'Lịch sử liên hệ' });
    expect(within(dialog).getAllByText(/Lan/).length).toBe(7);
  });

  it('should show no contact row when nothing was prepared', async () => {
    // Act
    await openDetail(storedPdf({ cvScore: scoreOf([MET]) }));

    // Assert
    expect(screen.queryByRole('button', { name: /Đã soạn thư/ })).toBeNull();
  });

  it('should open the other applications from a row, with links to them', async () => {
    // Arrange
    const otherApplications = [
      { id: 'a2', jobTitle: 'Trợ lý Giám đốc', status: 'seen' as const, createdAt: '2026-10-20T03:00:00.000Z' },
    ];
    await openDetail(storedPdf({ cvScore: scoreOf([MET]), otherApplications }));

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Người này đã nộp thêm 1 vị trí khác' }));

    // Assert
    const dialog = screen.getByRole('dialog', { name: 'Vị trí khác đã nộp' });
    expect(within(dialog).getByRole('link', { name: 'Trợ lý Giám đốc' }).getAttribute('href')).toBe('/hr/ho-so?trang-thai=seen&id=a2');
  });

  it('should keep "Xoá hồ sơ" as the last action of the detail', async () => {
    // Act
    await openDetail(storedPdf({ cvScore: scoreOf([MET]) }));

    // Assert
    const buttons = screen.getAllByRole('button').filter((b) => !b.closest('footer'));
    expect(buttons.at(-1)?.textContent).toContain('Xoá hồ sơ');
  });
});
