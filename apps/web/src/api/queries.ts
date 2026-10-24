import type { JobInput, JobTemplate } from '@careers/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from './index';
import type { ApplicationPatch, ApplyInput, CandidatePatch, JobAction } from './types';

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
  hrApps: (jobId?: string, q = '') => ['hr', 'apps', jobId ?? 'all', q] as const,
  hrApp: (id: string) => ['hr', 'app', id] as const,
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

export const useLookup = () => useMutation({ mutationFn: (phone: string) => api.lookupApplications(phone) });

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

export const useApplications = (jobId?: string, q = '') =>
  useQuery({
    queryKey: keys.hrApps(jobId, q),
    queryFn: () => api.hrApplications(jobId, q),
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
