import type { JobListItem, JobDetail, JobDataPayload } from './types'

const unwrapJobs = (payload: any) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  if (payload && Array.isArray(payload.jobs)) return payload.jobs; // our bulk/create shape
  return [];
};

async function j<T=any>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`
    try { const body = await res.json(); msg = body.detail || JSON.stringify(body) } catch {}
    throw new Error(msg)
  }
  return await res.json() as T
}

export async function listJobs(limit = 50) {
  const res = await fetch(`/api/jobs/?limit=${limit}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Jobs list failed: ${res.status}`);
  const json = await res.json();
  return unwrapJobs(json);
}

export async function bulkCreate(files: File[]) {
  const fd = new FormData()
  files.forEach(f => fd.append('files', f, f.name))
  const res = await fetch('/api/jobs/bulk/', { method:'POST', body: fd, credentials:'include' })
  const data = await j<{jobs:any[]}>(res); return data.jobs || []
}

export async function getJob(id: string): Promise<JobDetail> {
  const res = await fetch(`/api/jobs/${id}/`, { credentials:'include' })
  return j(res)
}

export async function getJobData(id: string): Promise<JobDataPayload> {
  const res = await fetch(`/api/jobs/${id}/data/`, { credentials:'include' })
  return j(res)
}

export async function deleteJob(id: string) {
  const res = await fetch(`/api/jobs/${id}/`, { method:'DELETE', credentials:'include' })
  if (!res.ok) throw new Error('Delete failed')
}

export async function resetSession() {
  const res = await fetch('/api/reset-session/', { credentials:'include' })
  return j(res)
}
