// src/api.ts
export type UploadResponse = { fileId: string }         // adjust
export type StartAnalysisResponse = { jobId: string }   // adjust
export type JobStatus = 'queued' | 'processing' | 'done' | 'error'
export type JobInfo = { jobId: string; status: JobStatus; result?: any } // adjust

const base = '/api'  // Vite dev proxy forwards this to Django

export async function uploadFile(file: File): Promise<UploadResponse> {
  const fd = new FormData()
  fd.append('file', file)
  const r = await fetch(`${base}/upload/`, { method: 'POST', body: fd })
  if (!r.ok) throw new Error(`Upload failed: ${r.status}`)
  return r.json()
}

export async function startAnalysis(fileId: string): Promise<StartAnalysisResponse> {
  const r = await fetch(`${base}/analyze/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId }),
  })
  if (!r.ok) throw new Error(`Start analyze failed: ${r.status}`)
  return r.json()
}

export async function getJob(jobId: string): Promise<JobInfo> {
  const r = await fetch(`${base}/jobs/${jobId}/`)
  if (!r.ok) throw new Error(`Get job failed: ${r.status}`)
  return r.json()
}

export async function getDetails(fileId: string): Promise<any> {
  const r = await fetch(`${base}/files/${fileId}/`)
  if (!r.ok) throw new Error(`Get details failed: ${r.status}`)
  return r.json()
}
