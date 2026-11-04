import type { ApplicationDetailDto, ReviewItemPublicDto } from '@careers/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => vi.stubEnv('VITE_API_URL', '/api'));
import { ReviewCard } from '../../review/ReviewCard';
import { ApplicantDetail } from './ApplicantDetail';
import {
  addPosts,
  application,
  box,
  clickSave,
  DRIVE_LINK,
  fillForm,
  mocks,
  onlyAdd,
  pasteLink,
  pickJob,
  pickPdf,
  reply,
  show,
  useFlowServer,
  wrap,
} from './AddApplicationFlow.helpers';

useFlowServer();

describe('HR pastes a CV link', () => {
  it('should not read anything: no call leaves for the link, no call to read a CV', async () => {
    // Arrange
    show();
    await pickJob();
    const before = mocks.sent.length;

    // Act
    await pasteLink(DRIVE_LINK);

    // Assert
    expect(mocks.sent.slice(before)).toEqual([]);
    expect(box('Họ và tên').value).toBe('');
    expect(box('Số điện thoại').value).toBe('');
    expect(box(/^Email/).value).toBe('');
  });

  it('should tell HR that a link is not read, so the details must be typed by hand', async () => {
    // Arrange
    show();

    // Act
    await pasteLink(DRIVE_LINK);

    // Assert
    expect(screen.queryByText(/không (tự )?(đọc|quét)|nhập tay/i)).not.toBeNull();
  });

  it('should not show the link line while HR is picking a PDF', async () => {
    // Act
    show();

    // Assert
    expect(screen.queryByText(/chỉ được lưu lại/)).toBeNull();
  });

  it.each([
    ['Google Drive', DRIVE_LINK],
    ['Dropbox', 'https://www.dropbox.com/scl/fi/a1b2c3/CV.pdf?rlkey=abc&dl=0'],
    ['OneDrive', 'https://1drv.ms/b/s!AbCdEf?e=XyZ'],
    ['TopCV', 'https://www.topcv.vn/xem-cv/abcdef0123456789'],
    ['LinkedIn', 'https://www.linkedin.com/in/tran-khoa-fictional/'],
    ['a plain PDF', 'https://example.com/CV.pdf'],
  ])('should save a %s link as text, with no file attached', async (_name, link) => {
    // Arrange
    const onAdded = show();
    await fillForm();
    await pasteLink(link);

    // Act
    await clickSave();

    // Assert
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith('new-id'));
    expect(onlyAdd().get('cvLink')).toBe(link);
    expect(onlyAdd().get('cv')).toBeNull();
    expect(mocks.sent.some((s) => s.url.includes('parse-cv'))).toBe(false);
    expect(mocks.sent.every((s) => s.url.startsWith('/api/'))).toBe(true);
  });

  it('should send the link without the spaces around it', async () => {
    // Arrange
    show();
    await fillForm();
    await pasteLink(`   ${DRIVE_LINK}  `);

    // Act
    await clickSave();

    // Assert
    await waitFor(() => expect(addPosts()).toHaveLength(1));
    expect(onlyAdd().get('cvLink')).toBe(DRIVE_LINK);
  });

  it.each(['javascript:alert(1)', 'data:text/html,<b>x</b>', 'file:///etc/passwd', 'drive.google.com/abc'])(
    'should show why %s is refused and keep what HR typed',
    async (link) => {
      // Arrange
      const onAdded = show();
      await fillForm();
      await pasteLink(link);

      // Act
      await clickSave();

      // Assert
      expect(await screen.findByText('Link CV phải bắt đầu bằng http:// hoặc https://')).toBeTruthy();
      expect(onAdded).not.toHaveBeenCalled();
      expect(box('Họ và tên').value).toBe('Trần Khoa');
      expect(box('Link CV').value).toBe(link);
    },
  );

  it('should save without a CV when the link box holds only spaces', async () => {
    // Arrange
    const onAdded = show();
    await fillForm();
    await pasteLink('    ');
    await userEvent.click(screen.getByRole('button', { name: 'Tải file PDF' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dán link' }));

    // Act
    await clickSave();

    // Assert
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith('new-id'));
  });
});

describe('PDF and link together', () => {
  it('should send only the link after switching from a PDF to a link', async () => {
    // Arrange
    show();
    await fillForm();
    await pickPdf();
    await pasteLink(DRIVE_LINK);

    // Act
    await clickSave();

    // Assert
    await waitFor(() => expect(addPosts()).toHaveLength(1));
    expect(onlyAdd().get('cvLink')).toBe(DRIVE_LINK);
    expect(onlyAdd().get('cv')).toBeNull();
  });

  it('should send only the PDF after switching back to it', async () => {
    // Arrange
    show();
    await fillForm();
    await pickPdf();
    await pasteLink(DRIVE_LINK);
    await userEvent.click(screen.getByRole('button', { name: 'Tải file PDF' }));

    // Act
    await clickSave();

    // Assert
    await waitFor(() => expect(addPosts()).toHaveLength(1));
    expect(onlyAdd().get('cvLink')).toBeNull();
    expect(onlyAdd().get('cv')).toBeInstanceOf(File);
  });
});

describe('How the saved link appears on HR page', () => {
  const openDetail = async (over: Partial<ApplicationDetailDto> = {}) => {
    mocks.shownApplication = application(over);
    mocks.scoredApplication = mocks.shownApplication;
    render(wrap(<ApplicantDetail id="a1" onDeleted={() => undefined} />));
    return screen.findByRole('heading', { name: 'Trần Minh Khoa' });
  };
  const hrefs = () => [...document.querySelectorAll('a')].map((a) => a.getAttribute('href') ?? '');

  it('should offer a web link as "Mở link CV", opened in a new tab without leaking the page', async () => {
    // Act
    await openDetail();

    // Assert
    const link = screen.getByRole('link', { name: 'Mở link CV' });
    expect(link.getAttribute('href')).toBe(DRIVE_LINK);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    ' javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'vbscript:msgbox(1)',
  ])('should never make %s clickable, even if it reached the database', async (cvLink) => {
    // Act
    await openDetail({ cvLink });

    // Assert
    expect(screen.queryByRole('link', { name: 'Mở link CV' })).toBeNull();
    expect(hrefs().filter((h) => /^\s*(javascript|data|file|vbscript):/i.test(h))).toEqual([]);
  });

  it('should show the link in the CV box as plain text', async () => {
    // Act
    await openDetail();

    // Assert
    const panel = screen.getByRole('region', { name: 'CV' });
    expect(within(panel).getByText(DRIVE_LINK)).toBeTruthy();
    expect(within(panel).queryByRole('link')).toBeNull();
  });

  it('should render markup in a link as text, never as HTML', async () => {
    // Arrange
    const cvLink = 'https://example.com/"><img src=x onerror=alert(1)>';

    // Act
    await openDetail({ cvLink });

    // Assert
    const panel = screen.getByRole('region', { name: 'CV' });
    expect(within(panel).getByText(cvLink)).toBeTruthy();
    expect(panel.querySelector('img')).toBeNull();
  });

  it('should offer the file, not a link, for a stored PDF', async () => {
    // Act
    await openDetail({ cvLink: null, cvFileName: 'CV.pdf' });

    // Assert
    expect(screen.getByRole('link', { name: 'Xem CV' }).getAttribute('href')).toBe('/api/hr/applications/a1/cv');
  });

  it('should say there is no CV when HR gave neither', async () => {
    // Act
    await openDetail({ cvLink: null, hasCv: false });

    // Assert
    expect(screen.getAllByText('Chưa có CV')).toHaveLength(2);
  });
});

describe('The match percent of a link on HR page', () => {
  const unknownItem = {
    requirement: 'Biết Excel',
    verdict: 'unknown' as const,
    evidence: null,
    reason: 'Không đọc được chữ trong CV (ảnh scan hoặc link), HR xem trực tiếp',
  };
  const linkScore = {
    percent: null,
    items: [unknownItem],
    note: 'CV là link, không đọc được tự động: HR mở link để xem.',
    scoredAt: '2026-10-20T03:00:00.000Z',
  };
  const open = async () => {
    render(wrap(<ApplicantDetail id="a1" onDeleted={() => undefined} />));
    await screen.findByRole('heading', { name: 'Trần Minh Khoa' });
    return screen.getByRole('region', { name: 'Chấm CV theo yêu cầu' });
  };

  it('should not start scoring a link by itself', async () => {
    // Act
    await open();

    // Assert
    expect(mocks.sent.some((s) => s.url.endsWith('/score'))).toBe(false);
  });

  it('should say the link was not read as soon as the profile opens', async () => {
    // Act
    const section = await open();

    // Assert
    expect(within(section).queryByText(/không đọc được|chưa đọc được/i)).not.toBeNull();
  });

  it('should not say a link was not read when the profile has no CV at all', async () => {
    // Arrange
    mocks.shownApplication = application({ cvLink: null, hasCv: false });

    // Act
    const section = await open();

    // Assert
    expect(within(section).queryByText(/không đọc được/i)).toBeNull();
  });

  it('should show no percent before scoring', async () => {
    // Act
    const section = await open();

    // Assert
    expect(within(section).queryByText(/\d+\s*%/)).toBeNull();
  });

  it('should show the honest note and no 0% after pressing "Chấm CV"', async () => {
    // Arrange
    mocks.scoredApplication = application({ cvScore: linkScore });
    const section = await open();

    // Act
    await userEvent.click(within(section).getByRole('button', { name: 'Xem chấm CV' }));

    // Assert
    expect(await within(section).findByText(linkScore.note)).toBeTruthy();
    expect(within(section).queryByText(/\d+\s*%/)).toBeNull();
  });

  it('should count requirements as "không chấm", none as not met', async () => {
    // Arrange
    mocks.shownApplication = application({ cvScore: linkScore });

    // Act
    const section = await open();

    // Assert
    expect(within(section).getByRole('button', { name: 'Không chấm: 1' })).toBeTruthy();
    expect(within(section).getByRole('button', { name: 'Không đạt: 0' })).toBeTruthy();
  });

  it('should show a real 0% for a PDF that was read and met nothing, as the control case', async () => {
    // Arrange
    mocks.shownApplication = application({
      cvLink: null,
      cvFileName: 'CV.pdf',
      cvScore: { ...linkScore, percent: 0, note: null, items: [{ ...unknownItem, verdict: 'unmet' }] },
    });

    // Act
    const section = await open();

    // Assert
    expect(within(section).getByText('0%')).toBeTruthy();
  });

  it('should score a stored PDF by itself when it opens', async () => {
    // Arrange
    mocks.shownApplication = application({ cvLink: null, cvFileName: 'CV.pdf' });

    // Act
    await open();

    // Assert
    await waitFor(() => expect(mocks.sent.some((s) => s.url.endsWith('/score'))).toBe(true));
  });

  const reviewItem = (over: Partial<ReviewItemPublicDto>): ReviewItemPublicDto => ({
    id: 'i1',
    fullName: 'Trần Minh Khoa',
    jobTitle: 'Kế toán',
    appliedAt: '2026-10-20T03:00:00.000Z',
    matchPercent: null,
    matchItems: [],
    hrPick: 'yes',
    hrComment: null,
    message: null,
    cv: 'link',
    cvLink: DRIVE_LINK,
    decision: null,
    reviewerComment: null,
    decidedAt: null,
    hrReply: null,
    hrRepliedAt: null,
    scheduled: false,
    cvUpdated: false,
    ...over,
  });
  const showCard = (over: Partial<ReviewItemPublicDto> = {}) =>
    render(wrap(<ReviewCard item={reviewItem(over)} token="t" readOnly onOpenCv={() => undefined} />));

  it('should show the reviewer "Chưa chấm" and a working link, never 0%', async () => {
    // Act
    showCard();

    // Assert
    expect(screen.getByText(/Chưa/)).toBeTruthy();
    expect(screen.queryByText(/\d+\s*%/)).toBeNull();
    expect(screen.getByRole('link').getAttribute('href')).toBe(DRIVE_LINK);
  });

  it.each(['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>'])(
    'should never make %s clickable for the reviewer, even if it reached the database',
    async (cvLink) => {
      // Act
      showCard({ cvLink });

      // Assert
      expect(screen.queryByRole('link')).toBeNull();
    },
  );
});

describe('Replacing the CV of a saved profile', () => {
  const openReplace = async () => {
    render(wrap(<ApplicantDetail id="a1" onDeleted={() => undefined} />));
    await userEvent.click(await screen.findByRole('button', { name: 'Đổi CV' }));
  };
  const puts = () => mocks.sent.filter((s) => s.method === 'PUT');

  it('should send the new link and close the box', async () => {
    // Arrange
    mocks.replaceReply = () => reply(200, application({ cvLink: 'https://example.com/moi.pdf' }));
    await openReplace();
    await pasteLink('https://example.com/moi.pdf');

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Lưu CV' }));

    // Assert
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Lưu CV' })).toBeNull());
    expect(puts()[0].body?.get('cvLink')).toBe('https://example.com/moi.pdf');
    expect(screen.getByRole('link', { name: 'Mở link CV' }).getAttribute('href')).toBe('https://example.com/moi.pdf');
  });

  it('should keep the box open and say why when the link is refused', async () => {
    // Arrange
    const message = 'Link CV phải bắt đầu bằng http:// hoặc https://';
    mocks.replaceReply = () => reply(422, { error: 'Link CV chưa đúng.', fieldErrors: { cv: message } });
    await openReplace();
    await pasteLink('javascript:alert(1)');

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Lưu CV' }));

    // Assert
    expect(await screen.findByText(message)).toBeTruthy();
    expect(box('Link CV').value).toBe('javascript:alert(1)');
    expect(screen.getByRole('link', { name: 'Mở link CV' }).getAttribute('href')).toBe(DRIVE_LINK);
  });

  it('should tell HR that a replacement link is only saved, not read', async () => {
    // Arrange
    await openReplace();

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Dán link' }));

    // Assert
    expect(screen.getByText(/chỉ được lưu lại/)).toBeTruthy();
  });

  it('should not let HR save an empty replacement', async () => {
    // Act
    await openReplace();

    // Assert
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Lưu CV' }).disabled).toBe(true);
  });

  it('should show the replaced link in the history', async () => {
    // Arrange
    mocks.shownApplication = application({
      cvHistory: [{ by: 'Phòng Nhân sự', at: '2026-10-20T03:00:00.000Z', previous: 'https://example.com/cu.pdf' }],
    });

    // Act
    render(wrap(<ApplicantDetail id="a1" onDeleted={() => undefined} />));

    // Assert
    const old = await screen.findByRole('link', { name: 'example.com' });
    expect(old.getAttribute('href')).toBe('https://example.com/cu.pdf');
    expect(screen.queryByText(/https:\/\/example\.com/)).toBeNull();
  });
});
