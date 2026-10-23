import type { JobInput } from '@careers/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from './index';
import type { ApplicationPatch, ApplyInput, CandidatePatch, JobAction, SubscribeInput } from './types';

export const keys = {
  jobs: ['jobs'] as const,
  job: (slug: string) => ['job', slug] as const,
  saved: ['saved'] as const,
  candidate: ['candidate'] as const,
  hrMe: ['hr', 'me'] as const,
  hrJobs: ['hr', 'jobs'] as const,
  hrJob: (id: string) => ['hr', 'job', id] as const,
  hrApps: (jobId?: string) => ['hr', 'apps', jobId ?? 'all'] as const,
  hrApp: (id: string) => ['hr', 'app', id] as const,
  hrSubs: ['hr', 'subs'] as const,
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

export const useSubscribe = () => useMutation({ mutationFn: (input: SubscribeInput) => api.subscribe(input) });

export const useSavedSlugs = () => useQuery({ queryKey: keys.saved, queryFn: api.savedJobSlugs, staleTime: Infinity });

export function useToggleSaved() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, saved }: { slug: string; saved: boolean }) => api.setSavedJob(slug, saved),
    onMutate: async ({ slug, saved }) => {
      await qc.cancelQueries({ queryKey: keys.saved });
      const prev = qc.getQueryData<string[]>(keys.saved) ?? [];
      qc.setQueryData(keys.saved, saved ? [...new Set([...prev, slug])] : prev.filter((s) => s !== slug));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx && qc.setQueryData(keys.saved, ctx.prev),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.saved });
      qc.invalidateQueries({ queryKey: keys.candidate });
    },
  });
}

// ── Candidate account ────────────────────────────────────────────────────

export const useCandidate = () => useQuery({ queryKey: keys.candidate, queryFn: api.candidateOverview });

export const useRequestOtp = () =>
  useMutation({
    mutationFn: ({ phone, channel }: { phone: string; channel: 'zalo' | 'sms' }) => api.requestOtp(phone, channel),
  });

export function useVerifyOtp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ phone, code }: { phone: string; code: string }) => api.verifyOtp(phone, code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.candidate });
      qc.invalidateQueries({ queryKey: keys.saved });
    },
  });
}

export const useGoogleSignIn = () => useMutation({ mutationFn: () => api.googleSignIn() });

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
      qc.invalidateQueries({ queryKey: keys.saved });
    },
  });
}

// ── HR ───────────────────────────────────────────────────────────────────

export const useHrMe = () => useQuery({ queryKey: keys.hrMe, queryFn: api.hrMe, staleTime: 60_000 });

export function useHrSignIn() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.hrGoogleSignIn(), onSuccess: (me) => qc.setQueryData(keys.hrMe, me) });
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

export const useApplications = (jobId?: string) =>
  useQuery({
    queryKey: keys.hrApps(jobId),
    queryFn: () => api.hrApplications(jobId),
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
      qc.invalidateQueries({ queryKey: ['hr', 'apps'] });
      qc.invalidateQueries({ queryKey: keys.hrJobs });
    },
  });
}

export const useSubscribers = () => useQuery({ queryKey: keys.hrSubs, queryFn: api.hrSubscribers });

export function useDeleteSubscriber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.hrDeleteSubscriber(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.hrSubs }),
  });
}
