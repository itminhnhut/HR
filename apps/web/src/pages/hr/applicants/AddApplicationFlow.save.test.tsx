import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => vi.stubEnv('VITE_API_URL', '/api'));
import {
  addPosts,
  asText,
  box,
  byRealRules,
  clickSave,
  deferred,
  DRIVE_LINK,
  fillForm,
  JOB_ID,
  mocks,
  onlyAdd,
  parsedCv,
  pasteLink,
  pdf,
  pickJob,
  pickPdf,
  pickSource,
  reply,
  show,
  tickConsent,
  useFlowServer,
} from './AddApplicationFlow.helpers';

useFlowServer();

describe('Filling the boxes from a PDF', () => {
  it('should never overwrite what HR typed before the reply arrives', async () => {
    // Arrange
    const late = deferred<Response>();
    mocks.parseReply = () => late.promise;
    show();
    await pickPdf();
    await userEvent.type(box('Họ và tên'), 'Tên HR gõ');

    // Act
    late.resolve(parsedCv());
    await screen.findByText(/Đã điền sẵn/);

    // Assert
    expect(box('Họ và tên').value).toBe('Tên HR gõ');
    expect(box('Số điện thoại').value).toBe('0903 456 789');
  });

  it('should replace the first CV details with those of a second PDF', async () => {
    // Arrange
    show();
    await pickPdf(pdf('A.pdf'));
    await screen.findByText(/Đã điền sẵn/);
    mocks.parseReply = () => parsedCv({ fullName: 'Lê Văn Bình', phone: '0987654321', email: 'binh@example.com' });

    // Act
    await pickPdf(pdf('B.pdf'));

    // Assert
    await waitFor(() => expect(box('Họ và tên').value).toBe('Lê Văn Bình'));
    expect(box('Số điện thoại').value).toBe('0987 654 321');
    expect(box(/^Email/).value).toBe('binh@example.com');
  });

  it('should keep what HR corrected when a second PDF arrives', async () => {
    // Arrange
    show();
    await pickPdf(pdf('A.pdf'));
    await screen.findByText(/Đã điền sẵn/);
    await userEvent.clear(box('Họ và tên'));
    await userEvent.type(box('Họ và tên'), 'Tên đã sửa');
    mocks.parseReply = () => parsedCv({ fullName: 'Lê Văn Bình', phone: '0987654321', email: null });

    // Act
    await pickPdf(pdf('B.pdf'));

    // Assert
    await waitFor(() => expect(box('Số điện thoại').value).toBe('0987 654 321'));
    expect(box('Họ và tên').value).toBe('Tên đã sửa');
  });

  it('should ignore a late reply for the PDF that was replaced', async () => {
    // Arrange
    const first = deferred<Response>();
    mocks.parseReply = (file) => (file.name === 'A.pdf' ? first.promise : parsedCv({ fullName: 'Lê Văn Bình' }));
    show();
    await pickPdf(pdf('A.pdf'));
    await pickPdf(pdf('B.pdf'));
    await waitFor(() => expect(box('Họ và tên').value).toBe('Lê Văn Bình'));

    // Act
    first.resolve(parsedCv({ fullName: 'Người Cũ' }));
    await Promise.resolve();

    // Assert
    await waitFor(() => expect(box('Họ và tên').value).toBe('Lê Văn Bình'));
  });

  it('should clear the first CV details when the second PDF is a scan', async () => {
    // Arrange
    show();
    await pickPdf(pdf('A.pdf'));
    await screen.findByText(/Đã điền sẵn/);
    mocks.parseReply = () => parsedCv({ fullName: null, phone: null, email: null, readable: false });

    // Act
    await pickPdf(pdf('Scan.pdf'));

    // Assert
    await screen.findByText(/ảnh scan/);
    expect(box('Họ và tên').value).toBe('');
    expect(box('Số điện thoại').value).toBe('');
  });

  it('should not leave the first candidate details on a second PDF that could not be read', async () => {
    // Arrange
    show();
    await pickPdf(pdf('A.pdf'));
    await screen.findByText(/Đã điền sẵn/);
    mocks.parseReply = () => reply(500, { error: 'Có lỗi xảy ra, thử lại sau.' });

    // Act
    await pickPdf(pdf('B.pdf'));
    await screen.findByText(/Không đọc được CV lúc này/);

    // Assert
    expect(box('Họ và tên').value).toBe('');
    expect(box('Số điện thoại').value).toBe('');
    expect(screen.queryAllByText('Lấy từ CV')).toEqual([]);
  });

  it('should not keep calling a box "Lấy từ CV" once that PDF was swapped for a link', async () => {
    // Arrange
    show();
    await pickPdf(pdf('A.pdf'));
    await screen.findByText(/Đã điền sẵn/);

    // Act
    await pasteLink(DRIVE_LINK);

    // Assert
    expect(screen.queryAllByText('Lấy từ CV')).toEqual([]);
  });

  it('should empty the first candidate details while a second PDF is still being read', async () => {
    // Arrange
    show();
    await pickPdf(pdf('A.pdf'));
    await screen.findByText(/Đã điền sẵn/);
    mocks.parseReply = () => deferred<Response>().promise;

    // Act
    await pickPdf(pdf('B.pdf'));
    await screen.findByText('Đang đọc CV…');

    // Assert
    expect(box('Họ và tên').value).toBe('');
    expect(box('Số điện thoại').value).toBe('');
    expect(box(/^Email/).value).toBe('');
    expect(screen.queryAllByText('Lấy từ CV')).toEqual([]);
  });

  it('should empty what the PDF filled when it is swapped for a link, keeping what HR typed', async () => {
    // Arrange
    show();
    await pickPdf(pdf('A.pdf'));
    await screen.findByText(/Đã điền sẵn/);
    await userEvent.clear(box('Họ và tên'));
    await userEvent.type(box('Họ và tên'), 'Tên đã sửa');

    // Act
    await pasteLink(DRIVE_LINK);

    // Assert
    expect(box('Họ và tên').value).toBe('Tên đã sửa');
    expect(box('Số điện thoại').value).toBe('');
    expect(box(/^Email/).value).toBe('');
  });

  it('should empty what the PDF filled when a file that is not a PDF replaces it', async () => {
    // Arrange
    show();
    await pickPdf(pdf('A.pdf'));
    await screen.findByText(/Đã điền sẵn/);

    // Act
    await userEvent.upload(screen.getByLabelText(/\.pdf/), new File(['x'], 'cv.docx', { type: 'application/msword' }), {
      applyAccept: false,
    });

    // Assert
    expect(await screen.findByText('CV cần là file PDF.')).toBeTruthy();
    expect(box('Họ và tên').value).toBe('');
    expect(screen.queryAllByText('Lấy từ CV')).toEqual([]);
  });

  it('should keep what HR typed when the PDF cannot be read', async () => {
    // Arrange
    mocks.parseReply = () => reply(500, { error: 'Có lỗi xảy ra, thử lại sau.' });
    show();
    await userEvent.type(box('Họ và tên'), 'Tên HR gõ');

    // Act
    await pickPdf();
    await screen.findByText(/Không đọc được CV lúc này/);

    // Assert
    expect(box('Họ và tên').value).toBe('Tên HR gõ');
  });
});

describe('Saving', () => {
  it('should create one profile when HR double-clicks "Lưu hồ sơ"', async () => {
    // Arrange
    const pending = deferred<Response>();
    mocks.addReply = () => pending.promise;
    const onAdded = show();
    await fillForm();

    // Act
    await userEvent.dblClick(screen.getByRole('button', { name: 'Lưu hồ sơ' }));

    // Assert
    expect(addPosts()).toHaveLength(1);
    pending.resolve(reply(201, { id: 'new-id' }));
    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1));
  });

  it('should create one profile when HR presses Enter again while saving', async () => {
    // Arrange
    const pending = deferred<Response>();
    mocks.addReply = () => pending.promise;
    show();
    await fillForm();

    // Act
    await userEvent.type(box('Họ và tên'), '{Enter}');
    await userEvent.type(box('Họ và tên'), '{Enter}');

    // Assert
    expect(addPosts()).toHaveLength(1);
    pending.resolve(reply(201, { id: 'new-id' }));
  });

  it('should show that it is saving and disable the button', async () => {
    // Arrange
    const pending = deferred<Response>();
    mocks.addReply = () => pending.promise;
    show();
    await fillForm();

    // Act
    await clickSave();

    // Assert
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Đang lưu…' }).disabled).toBe(true);
    pending.resolve(reply(201, { id: 'new-id' }));
  });

  it('should keep everything typed after a server error and save on retry', async () => {
    // Arrange
    mocks.addReply = () => reply(500, { error: 'Có lỗi xảy ra, thử lại sau.' });
    const onAdded = show();
    await fillForm();
    await userEvent.type(box(/^Email/), 'khoa@example.com');
    await userEvent.type(box(/Ghi chú nội bộ/), 'Gửi qua Zalo');
    await pasteLink(DRIVE_LINK);

    // Act
    await clickSave();
    await screen.findByText('Có lỗi xảy ra, thử lại sau.');

    // Assert
    expect(box('Họ và tên').value).toBe('Trần Khoa');
    expect(box('Số điện thoại').value).toBe('0912 345 678');
    expect(box(/^Email/).value).toBe('khoa@example.com');
    expect(box(/Ghi chú nội bộ/).value).toBe('Gửi qua Zalo');
    expect(box('Link CV').value).toBe(DRIVE_LINK);
    expect(box('Vị trí ứng tuyển').value).toBe(JOB_ID);
    expect(box('Nguồn hồ sơ').value).toBe('zalo');
    expect(screen.getByRole<HTMLInputElement>('checkbox').checked).toBe(true);
    mocks.addReply = byRealRules;
    await clickSave();
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith('new-id'));
    expect(addPosts()[1].body?.get('cvLink')).toBe(DRIVE_LINK);
  });

  it('should keep the picked PDF for the retry after a server error', async () => {
    // Arrange
    mocks.addReply = () => reply(500, { error: 'Có lỗi xảy ra, thử lại sau.' });
    show();
    await fillForm();
    await pickPdf(pdf('Giu lai.pdf'));

    // Act
    await clickSave();
    await screen.findByText('Có lỗi xảy ra, thử lại sau.');
    mocks.addReply = byRealRules;
    await clickSave();

    // Assert
    await waitFor(() => expect(addPosts()).toHaveLength(2));
    const file = addPosts()[1].body?.get('cv');
    expect(file instanceof File ? file.name : null).toBe('Giu lai.pdf');
  });

  it('should keep everything and explain when the network is down', async () => {
    // Arrange
    mocks.addReply = () => Promise.reject(new TypeError('Failed to fetch'));
    show();
    await fillForm();

    // Act
    await clickSave();

    // Assert
    expect(await screen.findByText('Chưa thực hiện được, thử lại sau ít phút.')).toBeTruthy();
    expect(box('Họ và tên').value).toBe('Trần Khoa');
  });

  it('should say the session ended and keep the form when HR is logged out', async () => {
    // Arrange
    mocks.addReply = () => reply(401, { error: 'Phiên đăng nhập đã hết, đăng nhập lại.' });
    const onAdded = show();
    await fillForm();

    // Act
    await clickSave();

    // Assert
    expect(await screen.findByText('Phiên đăng nhập đã hết, đăng nhập lại.')).toBeTruthy();
    expect(box('Họ và tên').value).toBe('Trần Khoa');
    expect(onAdded).not.toHaveBeenCalled();
  });

  it('should send the CSRF header and the session cookie with the form and the PDF read', async () => {
    // Arrange
    show();
    await fillForm();
    await pickPdf();
    await screen.findByText(/Đã điền sẵn|Đã đọc CV/);

    // Act
    await clickSave();
    await waitFor(() => expect(addPosts()).toHaveLength(1));

    // Assert
    const posts = mocks.sent.filter((s) => s.method === 'POST');
    expect(posts.map((p) => p.url).sort()).toEqual(['/api/hr/applications', '/api/hr/applications/parse-cv']);
    for (const post of posts) {
      expect(post.headers['x-requested-with']).toBe('careers-web');
      expect(post.credentials).toBe('include');
    }
  });

  it('should send the tick as "true" and a referral with its referrer', async () => {
    // Arrange
    const onAdded = show();
    await pickJob();
    await pickSource('referral');
    await userEvent.type(screen.getByLabelText('Ai giới thiệu'), 'Anh Tuấn');
    await userEvent.type(box('Họ và tên'), 'Trần Khoa');
    await userEvent.type(box('Số điện thoại'), '0912345678');
    await tickConsent();

    // Act
    await clickSave();

    // Assert
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith('new-id'));
    expect(asText(onlyAdd())).toMatchObject({ consent: 'true', source: 'referral', referrer: 'Anh Tuấn' });
  });
});
