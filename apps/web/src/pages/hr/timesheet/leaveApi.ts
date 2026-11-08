import type { AbsenceBatchDto, AbsenceBatchInput, AbsenceBatchSaveDto, LeaveBalanceDto } from '@careers/shared';
import { ApiError, isDemo } from '../../../api';

/**
 * The leave-balance hint and "Nghỉ công ty" over the real BE, read the way the shared client reads answers (CSRF header,
 * cookies, ApiError with the body's code and extra fields). Kept here, next to the tabs that use it.
 *
 *   GET    /hr/timesheet/employees/:id/leave-balance?from=&to=&code=  → LeaveBalanceDto
 *   GET    /hr/timesheet/absence-batches?year=                        → AbsenceBatchDto[]
 *   POST   /hr/timesheet/absence-batches         AbsenceBatchInput    → AbsenceBatchSaveDto   409 { code, employeeId } who failed
 *   PATCH  /hr/timesheet/absence-batches/:id     AbsenceBatchInput    → AbsenceBatchSaveDto   409 batch_changed
 *   DELETE /hr/timesheet/absence-batches/:id                          → { removed }
 */
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const textOf = (v: unknown) => (typeof v === 'string' ? v : undefined);

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (isDemo) throw new ApiError(404, 'Bản demo không có chấm công.');
  const res = await fetch(`${BASE}/hr/timesheet${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'x-requested-with': 'careers-web', ...(init.body ? { 'content-type': 'application/json' } : {}) },
  });
  const body: unknown = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (res.ok) return body as T;
  const fields = isRecord(body) && isRecord(body.fieldErrors) ? Object.fromEntries(Object.entries(body.fieldErrors).map(([k, v]) => [k, String(v)])) : {};
  throw new ApiError(res.status, (isRecord(body) && textOf(body.error)) || 'Có lỗi xảy ra, thử lại sau.', fields, isRecord(body) ? textOf(body.code) : undefined, isRecord(body) ? body : {});
}

const json = (method: string, data: unknown): RequestInit => ({ method, body: JSON.stringify(data) });

export const leaveApi = {
  balance: (employeeId: string, q: { from: string; to: string; code: string }) =>
    call<LeaveBalanceDto>(`/employees/${encodeURIComponent(employeeId)}/leave-balance?${new URLSearchParams(q).toString()}`),
  batches: (year: number) => call<AbsenceBatchDto[]>(`/absence-batches?year=${year}`),
  createBatch: (input: AbsenceBatchInput) => call<AbsenceBatchSaveDto>('/absence-batches', json('POST', input)),
  updateBatch: (id: string, input: AbsenceBatchInput) => call<AbsenceBatchSaveDto>(`/absence-batches/${encodeURIComponent(id)}`, json('PATCH', input)),
  removeBatch: (id: string) => call<{ removed: number }>(`/absence-batches/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

/** Whose refusal it is, when a company day off could not be saved for one person. */
export const failedPersonOf = (error: unknown): string | null => (error instanceof ApiError ? textOf(error.details.employeeId) ?? null : null);
