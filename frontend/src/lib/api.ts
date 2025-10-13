import { getCSRF } from './csrf'
import type { JobListItem, BulkCreateResponse, JobDetail, JobDataPayload } from './types'

export async function listJobs(limit = 50): Promise<JobListItem[]> {
  const r = await fetch(`/api/jobs/?limit=${limit}`, { credentials: 'same-origin' })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const data = await r.json()
  // DRF pagination format
  if (Array.isArray(data.results)) return data.results
  // Legacy fallback (if any)
  if (Array.isArray(data.jobs)) return data.jobs
  return []
}

export async function bulkCreate(files: File[]): Promise<BulkCreateResponse['jobs']> {
  const fd = new FormData()
  files.forEach(f => fd.append('files', f, f.name))
  const r = await fetch('/api/jobs/bulk/', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'X-CSRFToken': getCSRF() },
    body: fd,
  })
  const ct = r.headers.get('content-type') || ''
  const data = ct.includes('application/json') ? await r.json() : { detail: (await r.text()).slice(0, 1000) }
  if (!r.ok) throw new Error(data?.detail || `HTTP ${r.status}`)
  return Array.isArray(data.jobs) ? data.jobs : []
}

export async function getJob(id: string): Promise<JobDetail> {
  const r = await fetch(`/api/jobs/${id}/`, { credentials: 'same-origin' })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

export async function getJobData(id: string): Promise<JobDataPayload> {
  const r = await fetch(`/api/jobs/${id}/data/`, { credentials: 'same-origin' })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

export async function deleteJob(id: string): Promise<void> {
  const r = await fetch(`/api/jobs/${id}/`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'X-CSRFToken': getCSRF() },
  })
  if (r.status !== 204) {
    const data = await r.json().catch(() => ({}))
    throw new Error(data.detail || `Failed to delete (HTTP ${r.status})`)
  }
}

export async function resetSession(): Promise<void> {
  const r = await fetch('/api/reset-session/', { credentials: 'include' })
  if (!r.ok) throw new Error('Failed to reset session')
}

