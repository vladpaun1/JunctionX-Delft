// frontend/src/lib/api.ts
import type { JobListItem, JobDataPayload } from './types';

async function api<T = any>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { credentials: 'include', ...init });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  // some endpoints (DELETE) return no body
  try { return (await res.json()) as T; } catch { return {} as T; }
}

// ---- Jobs
export type JobsListResponse =
  | { results?: JobListItem[]; count?: number }
  | { jobs?: JobListItem[]; length?: number }
  | JobListItem[];

export function listJobs(limit = 50) {
  return api<JobsListResponse>(`/api/jobs/?limit=${limit}`);
}

export function getJob(id: string) {
  return api<JobListItem>(`/api/jobs/${id}/`);
}

export async function bulkCreate(files: File[]) {
  const fd = new FormData();
  files.forEach((f) => fd.append('files', f));
  return api<{ jobs: { id: string; filename: string; size?: number; error?: string }[] }>(
    '/api/jobs/bulk/', { method: 'POST', body: fd }
  );
}

export function deleteJob(id: string) {
  // 204 no content
  return fetch(`/api/jobs/${id}/`, { method: 'DELETE', credentials: 'include' }).then((r) => {
    if (!r.ok && r.status !== 204) throw new Error('Delete failed');
  });
}

export function getJobData(id: string) {
  return api<JobDataPayload>(`/api/jobs/${id}/data/`);
}

export function exportUrl(id: string) {
  return `/api/jobs/${id}/export/`;
}

// ---- Misc
export function resetSession() {
  return api<{ ok: boolean; deleted?: number }>('/api/reset-session/');
}
