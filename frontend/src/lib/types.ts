export type JobStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED'
export type JobListItem = {
  id: string
  filename: string
  status: JobStatus
  error?: string|null
  src_size?: number|null
  wav_size?: number|null
  duration_sec?: number|null
}
export type JobDetail = JobListItem & {
  upload_rel?: string|null
  normalized_rel?: string|null
  stored_name?: string|null
}
export type Flag = { label: string; text: string; start_sec: number; end_sec: number }
export type JobDataPayload = { job_id: string; filename: string; transcript_text: string; flags: Flag[] }
