import { fieldErrors, hrApplicationSchema, type ApplicationDetailDto, type SourceDto } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { AddApplicationDialog } from './AddApplicationDialog';

/** What the "Thêm hồ sơ" flow tests share: the fake server, and the steps HR takes on the page. */

export const JOB_ID = '11111111-1111-4111-8111-111111111111';
const CLOSED_JOB_ID = '22222222-2222-4222-8222-222222222222';
export const DRIVE_LINK = 'https://drive.google.com/file/d/1AbCdEf/view?usp=sharing';

interface Sent {
  url: string;
  method: string;
  body: FormData | null;
  headers: Record<string, string>;
  credentials: RequestCredentials | undefined;
}

export const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const SOURCES: SourceDto[] = [
  { key: 'website', name: 'Website', kind: 'system', hidden: false, applications: 0 },
  { key: 'email', name: 'Email', kind: 'builtin', hidden: false, applications: 0 },
  { key: 'zalo', name: 'Zalo', kind: 'builtin', hidden: false, applications: 0 },
  { key: 'referral', name: 'Người giới thiệu', kind: 'builtin', hidden: false, applications: 0 },
  { key: 'topcv', name: 'TopCV', kind: 'builtin', hidden: true, applications: 0 },
];

export const asText = (form: FormData) =>
  Object.fromEntries([...form.entries()].filter((entry): entry is [string, string] => typeof entry[1] === 'string'));

/** What apps/api/src/services/hr-intake.ts answers for this form when the job and phone are fine. */
export function byRealRules(form: FormData): Response {
  const fields = asText(form);
  const parsed = hrApplicationSchema.safeParse({ ...fields, consent: fields.consent === 'true' });
  if (parsed.success) return reply(201, { id: 'new-id' });
  return reply(422, { error: 'Kiểm tra lại các ô được đánh dấu.', fieldErrors: fieldErrors(parsed.error) });
}

export const duplicateReply = () =>
  reply(409, {
    error: 'Đã có hồ sơ của Trần Khoa cho vị trí này.',
    fieldErrors: {},
    code: 'duplicate',
    existing: { id: 'old-id', fullName: 'Trần Khoa', status: 'seen', createdAt: '2026-10-20T03:00:00.000Z' },
  });

export const parsedCv = (over: Record<string, unknown> = {}) =>
  reply(200, {
    fullName: 'Nguyễn Thị Mai Anh',
    phone: '0903456789',
    email: 'maianh@example.com',
    readable: true,
    ...over,
  });

export const application = (over: Partial<ApplicationDetailDto> = {}): ApplicationDetailDto => ({
  id: 'a1',
  jobId: JOB_ID,
  jobTitle: 'Kế toán',
  fullName: 'Trần Minh Khoa',
  phone: '0912345678',
  status: 'seen',
  createdAt: '2026-10-20T03:00:00.000Z',
  hasCv: true,
  matchPercent: null,
  matchBonus: 0,
  noteLine: null,
  interviewAt: null,
  review: null,
  source: 'zalo',
  cvUpdatedByCandidate: false,
  reviewInfo: null,
  referrer: null,
  addedBy: 'Phòng Nhân sự',
  consentBy: 'Phòng Nhân sự',
  cvHistory: [],
  email: null,
  message: null,
  cvFileName: null,
  cvLink: DRIVE_LINK,
  note: null,
  noteUpdatedAt: null,
  noteUpdatedBy: null,
  interviewMode: null,
  meetingUrl: null,
  cvScore: null,
  contacts: [],
  otherApplications: [],
  ...over,
});

/** The fake server's replies, changed by each test, and every request it received. */
export const mocks: {
  /** The reply to "Lưu hồ sơ"; by default the real shared rules decide, like the server route. */
  addReply: (form: FormData) => Response | Promise<Response>;
  /** The reply to reading a PDF. */
  parseReply: (file: File) => Response | Promise<Response>;
  /** The reply to replacing a CV. */
  replaceReply: () => Response | Promise<Response>;
  /** The application GET /hr/applications/:id answers, and what scoring turns it into. */
  shownApplication: ApplicationDetailDto;
  scoredApplication: ApplicationDetailDto;
  sent: Sent[];
} = {
  addReply: byRealRules,
  parseReply: () => parsedCv(),
  replaceReply: () => reply(200, application()),
  shownApplication: application(),
  scoredApplication: application(),
  sent: [],
};

function route(url: string, method: string, body: FormData | null): Response | Promise<Response> {
  if (url.endsWith('/hr/jobs')) {
    return reply(200, {
      jobs: [
        { id: JOB_ID, title: 'Kế toán', status: 'open' },
        { id: CLOSED_JOB_ID, title: 'Lái xe', status: 'closed' },
        { id: '33333333-3333-4333-8333-333333333333', title: 'Thủ kho', status: 'expired' },
        { id: '44444444-4444-4444-8444-444444444444', title: 'Bản nháp', status: 'draft' },
      ],
      newApplications: 0,
      dueForDeletion: 0,
    });
  }
  if (url.endsWith('/hr/sources')) return reply(200, SOURCES);
  if (url.endsWith('/hr/me')) return reply(401, { error: 'x' });
  if (url.endsWith('/hr/applications/parse-cv') && body) {
    const file = body.get('cv');
    return file instanceof File ? mocks.parseReply(file) : reply(422, { error: 'x', fieldErrors: {} });
  }
  if (url.endsWith('/hr/applications') && method === 'POST' && body) return mocks.addReply(body);
  if (url.endsWith('/cv') && method === 'PUT') return mocks.replaceReply();
  if (url.endsWith('/score') && method === 'POST') return reply(200, mocks.scoredApplication);
  if (url.endsWith(`/hr/applications/${mocks.shownApplication.id}`)) return reply(200, mocks.shownApplication);
  return reply(404, { error: 'not found' });
}

/** Registers the fake server and the page cleanup for the test file that calls it. */
export function useFlowServer() {
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
    mocks.sent = [];
    mocks.addReply = byRealRules;
    mocks.parseReply = () => parsedCv();
    mocks.replaceReply = () => reply(200, application());
    mocks.shownApplication = application();
    mocks.scoredApplication = application();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        const body = init?.body instanceof FormData ? init.body : null;
        mocks.sent = [
          ...mocks.sent,
          {
            url,
            method,
            body,
            headers: (init?.headers ?? {}) as Record<string, string>,
            credentials: init?.credentials,
          },
        ];
        return route(url, method, body);
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
}

export const wrap = (children: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
);

export function show(onAdded = vi.fn()) {
  render(wrap(<AddApplicationDialog open onClose={() => undefined} onAdded={onAdded} />));
  return onAdded;
}

export const addPosts = () => mocks.sent.filter((s) => s.method === 'POST' && s.url.endsWith('/hr/applications'));
export const onlyAdd = () => {
  const [post] = addPosts();
  if (!post?.body) throw new Error('Nothing was saved');
  return post.body;
};
export const box = (label: string | RegExp) => screen.getByLabelText<HTMLInputElement>(label);
export const clickSave = () => userEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));

export const pdf = (name = 'CV Mai Anh.pdf') => new File(['%PDF-1.7\n%%EOF\n'], name, { type: 'application/pdf' });
export const pickPdf = (file = pdf()) => userEvent.upload(screen.getByLabelText(/Chọn file CV|\.pdf/), file);
export const pasteLink = async (link: string) => {
  await userEvent.click(screen.getByRole('button', { name: 'Dán link' }));
  await userEvent.click(screen.getByLabelText('Link CV'));
  await userEvent.paste(link);
};

export async function pickJob(name = 'Kế toán') {
  await userEvent.selectOptions(
    await screen.findByLabelText('Vị trí ứng tuyển'),
    await screen.findByRole('option', { name }),
  );
}
export async function pickSource(key = 'zalo') {
  await screen.findByRole('option', { name: 'Zalo' });
  await userEvent.selectOptions(screen.getByLabelText('Nguồn hồ sơ'), key);
}
export const tickConsent = () => userEvent.click(screen.getByRole('checkbox'));

/** Everything the form needs except the CV. */
export async function fillForm() {
  await pickJob();
  await pickSource();
  await userEvent.type(box('Họ và tên'), 'Trần Khoa');
  await userEvent.type(box('Số điện thoại'), '0912345678');
  await tickConsent();
}

export const deferred = <T,>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
