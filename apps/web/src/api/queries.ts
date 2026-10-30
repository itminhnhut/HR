import type {
  ApplicationDetailDto,
  ApplicationSource,
  ContactChannel,
  HrContactInput,
  HrNewsPostDto,
  JobInput,
  JobTemplate,
  NewsPostInput,
  ReviewCreateInput,
  ReviewDecisionInput,
  TemplateKey,
} from '@careers/shared';
import { useEffect, useState } from 'react';
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from './index';
import type {
  ApplicationPatch,
  AddApplicationInput,
  ApplyInput,
  CandidatePatch,
  CvInput,
  HrProfilePatch,
  JobAction,
  NewsListQuery,
  ReviewAction,
} from './types';

export const keys = {
  jobs: ['jobs'] as const,
  job: (slug: string) => ['job', slug] as const,
  candidate: ['candidate'] as const,
  hrMe: ['hr', 'me'] as const,
  hrJobs: ['hr', 'jobs'] as const,
  hrJob: (id: string) => ['hr', 'job', id] as const,
  hrJobTemplate: ['hr', 'job-template'] as const,
  hrDashboard: ['hr', 'dashboard'] as const,
  hrUsers: ['hr', 'users'] as const,
  hrMessageTemplates: ['hr', 'message-templates'] as const,
  hrApps: (jobId?: string, q = '') => ['hr', 'apps', jobId ?? 'all', q] as const,
  hrApp: (id: string) => ['hr', 'app', id] as const,
  news: (query: NewsListQuery) => ['news', 'list', query.category ?? '', query.tag ?? '', query.page ?? 1] as const,
  newsPost: (slug: string) => ['news', 'post', slug] as const,
  hrNews: ['hr', 'news'] as const,
  hrNewsPost: (id: string) => ['hr', 'news', 'post', id] as const,
  hrNewsTags: (q: string) => ['hr', 'news', 'tags', q] as const,
  hrReviews: ['hr', 'reviews'] as const,
  hrReview: (id: string) => ['hr', 'review', id] as const,
  reviewPage: (token: string) => ['review', token] as const,
  hrSources: ['hr', 'sources'] as const,
};

// ── Public ───────────────────────────────────────────────────────────────

export const useJobs = () => useQuery({ queryKey: keys.jobs, queryFn: api.listJobs });

export const useJob = (slug: string) => useQuery({ queryKey: keys.job(slug), queryFn: () => api.getJob(slug) });

export function useApply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplyInput) => api.apply(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.candidate });
      qc.invalidateQueries({ queryKey: ['hr'] });
    },
    onError: (err) => {
      // The job closed while the form was open: refresh it so the page shows why.
      if (err instanceof ApiError && err.code === 'job_closed') {
        qc.invalidateQueries({ queryKey: ['job'] });
        qc.invalidateQueries({ queryKey: keys.jobs });
      }
    },
  });
}

export const useLookup = () =>
  useMutation({
    mutationFn: ({ phone, captchaToken }: { phone: string; captchaToken?: string }) =>
      api.lookupApplications(phone, captchaToken),
  });

// ── Candidate account ────────────────────────────────────────────────────

export const useCandidate = () => useQuery({ queryKey: keys.candidate, queryFn: api.candidateOverview });

export function useGoogleSignIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.googleSignIn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.candidate });
    },
  });
}

export function useUpdateCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: CandidatePatch) => api.updateCandidate(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.candidate }),
  });
}

export function useCandidateSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { deleteData: boolean }) =>
      opts.deleteData ? api.deleteCandidateData() : api.candidateLogout(),
    onSuccess: () => {
      qc.setQueryData(keys.candidate, null);
    },
  });
}

// ── HR ───────────────────────────────────────────────────────────────────

export const useHrMe = () => useQuery({ queryKey: keys.hrMe, queryFn: api.hrMe, staleTime: 60_000 });

export function useHrSignIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => api.hrSignIn(email, password),
    onSuccess: (me) => qc.setQueryData(keys.hrMe, me),
  });
}

export function useHrSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.hrLogout(),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['hr'] });
      qc.setQueryData(keys.hrMe, null);
    },
  });
}

export const useHrJobs = () => useQuery({ queryKey: keys.hrJobs, queryFn: api.hrJobs });

export const useJobTemplate = () =>
  useQuery({ queryKey: keys.hrJobTemplate, queryFn: api.hrJobTemplate, staleTime: 5 * 60_000 });

export const useHrJob = (id: string | undefined) =>
  useQuery({ queryKey: keys.hrJob(id ?? 'new'), queryFn: () => api.hrJob(id!), enabled: !!id });

export function useSaveJob(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: JobInput) => api.hrSaveJob(id ?? null, input),
    onSuccess: (job) => {
      qc.setQueryData(keys.hrJob(job.id), job);
      qc.invalidateQueries({ queryKey: keys.hrJobs });
      qc.invalidateQueries({ queryKey: keys.jobs });
      qc.invalidateQueries({ queryKey: ['job'] });
    },
  });
}

export function useJobAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: JobAction }) => api.hrJobAction(id, action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.hrJobs });
      qc.invalidateQueries({ queryKey: keys.jobs });
      qc.invalidateQueries({ queryKey: ['job'] });
    },
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.hrDeleteJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.hrJobs }),
  });
}

export const useApplications = (jobId?: string, q = '', source?: ApplicationSource) =>
  useQuery({
    queryKey: [...keys.hrApps(jobId, q), source ?? 'all-sources'],
    queryFn: () => api.hrApplications(jobId, q, source),
    placeholderData: keepPreviousData,
  });

export function useApplication(id: string | null) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: keys.hrApp(id ?? 'none'),
    enabled: !!id,
    queryFn: async () => {
      const detail = await api.hrApplication(id!);
      // Opening marks "Mới" as "Đã xem"; refresh counts quietly.
      qc.invalidateQueries({ queryKey: ['hr', 'apps'] });
      qc.invalidateQueries({ queryKey: keys.hrJobs });
      return detail;
    },
  });
}

export function useUpdateApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ApplicationPatch }) => api.hrUpdateApplication(id, patch),
    onSuccess: (detail) => {
      qc.setQueryData(keys.hrApp(detail.id), detail);
      refreshApplications(qc);
    },
  });
}

/** Everything that shows application counts. */
function refreshApplications(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['hr', 'apps'] });
  qc.invalidateQueries({ queryKey: keys.hrJobs });
  qc.invalidateQueries({ queryKey: keys.hrDashboard });
}

export function useDeleteApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.hrDeleteApplication(id),
    onSuccess: (_r, id) => {
      qc.removeQueries({ queryKey: keys.hrApp(id) });
      refreshApplications(qc);
    },
  });
}

export function useDeleteDueApplications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.hrDeleteDueApplications(),
    onSuccess: () => refreshApplications(qc),
  });
}

export function useSetDeadline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, deadline }: { id: string; deadline: string }) => api.hrSetDeadline(id, deadline),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.hrJobs });
      qc.invalidateQueries({ queryKey: keys.hrDashboard });
      qc.invalidateQueries({ queryKey: keys.jobs });
      qc.invalidateQueries({ queryKey: ['job'] });
    },
  });
}

export const useDashboard = () => useQuery({ queryKey: keys.hrDashboard, queryFn: api.hrDashboard });

export function useSaveJobTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (template: JobTemplate) => api.hrSaveJobTemplate(template),
    onSuccess: (data) => qc.setQueryData(keys.hrJobTemplate, data),
  });
}

// ── HR accounts ──────────────────────────────────────────────────────────

export const useHrUsers = () => useQuery({ queryKey: keys.hrUsers, queryFn: api.hrUsers });

export function useHrUserAction() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: keys.hrUsers });
  return {
    create: useMutation({ mutationFn: api.hrCreateUser, onSuccess: done }),
    reset: useMutation({ mutationFn: api.hrResetPassword, onSuccess: done }),
    remove: useMutation({ mutationFn: api.hrDeleteUser, onSuccess: done }),
  };
}

export function useChangePassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) => api.hrChangePassword(current, next),
    onSuccess: (me) => qc.setQueryData(keys.hrMe, me),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: HrProfilePatch) => api.hrUpdateProfile(patch),
    onSuccess: (me) => {
      qc.setQueryData(keys.hrMe, me);
      qc.invalidateQueries({ queryKey: keys.hrUsers });
    },
  });
}

// ── Message templates ────────────────────────────────────────────────────

export const useMessageTemplates = () =>
  useQuery({ queryKey: keys.hrMessageTemplates, queryFn: api.hrMessageTemplates, staleTime: 5 * 60_000 });

export function useMessageTemplateActions() {
  const qc = useQueryClient();
  const done = (data: Awaited<ReturnType<typeof api.hrMessageTemplates>>) =>
    qc.setQueryData(keys.hrMessageTemplates, data);
  return {
    save: useMutation({
      mutationFn: ({ key, subject, body }: { key: TemplateKey; subject: string; body: string }) =>
        api.hrSaveMessageTemplate(key, { subject, body }),
      onSuccess: done,
    }),
    reset: useMutation({ mutationFn: (key: TemplateKey) => api.hrResetMessageTemplate(key), onSuccess: done }),
  };
}

export function useLogContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, templateKey, channel }: { id: string; templateKey: TemplateKey; channel: ContactChannel }) =>
      api.hrLogContact(id, { templateKey, channel }),
    // Only the contact list: this answer may be older than a save that ran at the same time (Meet link).
    onSuccess: (detail) =>
      qc.setQueryData<ApplicationDetailDto>(keys.hrApp(detail.id), (old) =>
        old ? { ...old, contacts: detail.contacts } : detail,
      ),
  });
}

export function useAddTemplateChoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ list, value }: { list: 'departments' | 'experiences' | 'educations'; value: string }) =>
      api.hrAddTemplateChoice(list, value),
    onSuccess: (data) => qc.setQueryData(keys.hrJobTemplate, data),
  });
}

/**
 * Scores CV files without an up-to-date result in the background, a batch per call, refreshing the list as
 * percents arrive. Returns how many are still waiting (null when none or done).
 */
export function useScorePending(enabled: boolean): number | null {
  const qc = useQueryClient();
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    const run = async () => {
      try {
        for (;;) {
          const { scored, remaining } = await api.hrScorePending();
          if (stopped) return;
          if (scored > 0) await qc.invalidateQueries({ queryKey: ['hr', 'apps'] });
          setLeft(remaining > 0 && scored > 0 ? remaining : null);
          if (remaining === 0 || scored === 0) return;
        }
      } catch (e) {
        // The list still works without percents; opening an application scores it.
        console.warn('Could not score CVs', e);
        setLeft(null);
      }
    };
    void run();
    return () => {
      stopped = true;
    };
  }, [enabled, qc]);
  return left;
}

export function useScoreCv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.hrScoreCv(id),
    onSuccess: (detail) => {
      qc.setQueryData(keys.hrApp(detail.id), detail);
      qc.invalidateQueries({ queryKey: ['hr', 'apps'] });
    },
  });
}

// ── News ─────────────────────────────────────────────────────────────────

export const useNewsList = (query: NewsListQuery) =>
  useQuery({ queryKey: keys.news(query), queryFn: () => api.listNews(query), placeholderData: keepPreviousData });

/** Phones: one growing list ("Xem thêm bài") instead of numbered pages, starting at `from`. */
export const useNewsInfinite = (query: Omit<NewsListQuery, 'page'>, from: number, enabled: boolean) =>
  useInfiniteQuery({
    queryKey: ['news', 'more', query.category ?? '', query.tag ?? '', from],
    queryFn: ({ pageParam }) => api.listNews({ ...query, page: pageParam }),
    initialPageParam: from,
    getNextPageParam: (last) => (last.page < last.pageCount ? last.page + 1 : undefined),
    enabled,
  });

export const useNewsPost = (slug: string) =>
  useQuery({ queryKey: keys.newsPost(slug), queryFn: () => api.getNews(slug) });

export const useHrNews = () => useQuery({ queryKey: keys.hrNews, queryFn: api.hrNews });

export const useHrNewsPost = (id: string | null) =>
  useQuery({
    queryKey: keys.hrNewsPost(id ?? 'new'),
    queryFn: () => (id ? api.hrNewsPost(id) : Promise.reject(new Error('No post id'))),
    enabled: !!id,
    // The editor keeps its own copy once open: a refetch must never reset what HR is typing.
    staleTime: Infinity,
    refetchOnMount: 'always',
  });

/**
 * Lists (HR and public) that show this post. The editor keeps its own state, so its query is only updated.
 * `quiet`: mark stale without refetching now (autosave runs every few seconds; lists refetch when opened).
 */
function refreshNews(qc: ReturnType<typeof useQueryClient>, post?: HrNewsPostDto, quiet = false) {
  if (post) qc.setQueryData(keys.hrNewsPost(post.id), post);
  const refetchType = quiet ? 'none' : 'active';
  qc.invalidateQueries({ queryKey: keys.hrNews, exact: true, refetchType });
  qc.invalidateQueries({ queryKey: ['news'], refetchType });
}

/** Autosave: creates the post on the first save, then updates it. */
export function useSaveNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: NewsPostInput }) =>
      id ? api.hrSaveNews(id, input) : api.hrCreateNews(input),
    onSuccess: (post) => refreshNews(qc, post, true),
  });
}

export function useNewsAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'publish' | 'unpublish' }) =>
      action === 'publish' ? api.hrPublishNews(id) : api.hrUnpublishNews(id),
    onSuccess: (post) => refreshNews(qc, post),
  });
}

export function useDeleteNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.hrDeleteNews(id),
    onSuccess: (_r, id) => {
      qc.removeQueries({ queryKey: keys.hrNewsPost(id) });
      refreshNews(qc);
    },
  });
}

export function useNewsCategoryActions() {
  const qc = useQueryClient();
  const done = () => refreshNews(qc);
  return {
    create: useMutation({ mutationFn: (name: string) => api.hrCreateNewsCategory(name), onSuccess: done }),
    rename: useMutation({
      mutationFn: ({ id, name }: { id: string; name: string }) => api.hrRenameNewsCategory(id, name),
      onSuccess: done,
    }),
    remove: useMutation({ mutationFn: (id: string) => api.hrDeleteNewsCategory(id), onSuccess: done }),
  };
}

/** Hashtag suggestions while HR types (kept for a minute: they change only when posts are saved). */
export const useNewsTagSuggestions = (q: string, enabled: boolean) =>
  useQuery({
    queryKey: keys.hrNewsTags(q.trim()),
    queryFn: () => api.hrNewsTags(q),
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

export const useUploadNewsImage = () => useMutation({ mutationFn: (file: File) => api.hrUploadNewsImage(file) });

// ── "Sếp duyệt ứng viên" (spec-boss-review.md) ──────────────────────────

/** HR sees the reviewer's choices without reloading: the list every 30 s, an open batch every 15 s. */
export const useReviews = () =>
  useQuery({ queryKey: keys.hrReviews, queryFn: () => api.hrReviews(), refetchInterval: 30_000 });

export const useReview = (id: string) =>
  useQuery({ queryKey: keys.hrReview(id), queryFn: () => api.hrReview(id), refetchInterval: 15_000 });

export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReviewCreateInput) => api.hrCreateReview(input),
    onSuccess: (batch) => {
      qc.setQueryData(keys.hrReview(batch.id), batch);
      qc.invalidateQueries({ queryKey: keys.hrReviews });
      qc.invalidateQueries({ queryKey: ['hr', 'apps'] });
    },
  });
}

export function useReviewAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: ReviewAction) => api.hrReviewAction(id, action),
    onSuccess: (batch) => {
      qc.setQueryData(keys.hrReview(id), batch);
      qc.invalidateQueries({ queryKey: keys.hrReviews });
      qc.invalidateQueries({ queryKey: ['hr', 'apps'] });
      qc.invalidateQueries({ queryKey: ['hr', 'app'] });
    },
  });
}

/** The reviewer's page: a wrong or old link answers 404 at once, no retries. */
export const useReviewPage = (token: string) =>
  useQuery({ queryKey: keys.reviewPage(token), queryFn: () => api.reviewPage(token), retry: false });

export function useReviewDecide(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: ReviewDecisionInput }) =>
      api.reviewDecide(token, itemId, input),
    onSuccess: (page) => qc.setQueryData(keys.reviewPage(token), page),
  });
}

export function useReviewDone(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.reviewDone(token),
    onSuccess: (page) => qc.setQueryData(keys.reviewPage(token), page),
  });
}

// ── "Thêm và cập nhật CV" (spec-cv-intake.md) ───────────────────────────

export function useAddApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddApplicationInput) => api.hrAddApplication(input),
    onSuccess: () => refreshApplications(qc),
  });
}

/** HR changes a CV or contact details: the detail comes back, lists refresh. */
export function useApplicationEdit(id: string) {
  const qc = useQueryClient();
  const done = (detail: ApplicationDetailDto) => {
    qc.setQueryData(keys.hrApp(detail.id), detail);
    refreshApplications(qc);
  };
  return {
    replaceCv: useMutation({ mutationFn: (cv: CvInput) => api.hrReplaceCv(id, cv), onSuccess: done }),
    updateContact: useMutation({
      mutationFn: (input: HrContactInput) => api.hrUpdateContact(id, input),
      onSuccess: done,
    }),
  };
}

export function useCandidateReplaceCv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId, cv }: { applicationId: string; cv: CvInput }) =>
      api.candidateReplaceCv(applicationId, cv),
    onSuccess: (overview) => qc.setQueryData(keys.candidate, overview),
  });
}

// ── "Nguồn hồ sơ" (spec-custom-sources.md) ──────────────────────────────

/** One list for every screen that names a source (filter, labels, dashboard, pickers). */
export const useSources = () =>
  useQuery({ queryKey: keys.hrSources, queryFn: () => api.hrSources(), staleTime: 60_000 });

export function useSourceActions() {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: keys.hrSources });
    qc.invalidateQueries({ queryKey: keys.hrDashboard });
  };
  return {
    create: useMutation({ mutationFn: (name: string) => api.hrCreateSource(name), onSuccess: refresh }),
    update: useMutation({
      mutationFn: ({ key, patch }: { key: string; patch: { name?: string; hidden?: boolean } }) =>
        api.hrUpdateSource(key, patch),
      onSuccess: (list) => {
        qc.setQueryData(keys.hrSources, list);
        refresh();
      },
    }),
    remove: useMutation({
      mutationFn: (key: string) => api.hrDeleteSource(key),
      onSuccess: (list) => qc.setQueryData(keys.hrSources, list),
    }),
  };
}
