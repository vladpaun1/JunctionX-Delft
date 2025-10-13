export type JobStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED'

export interface JobListItem {
  id: string
  filename: string | null
  status: JobStatus
  error: string | null
  src_size?: number | null
  wav_size?: number | null
  duration_sec?: number | null
}

export interface JobDetail {
  id: string
  status: JobStatus
  error: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  upload_rel: string | null
  normalized_rel: string | null
  src_size: number | null
  wav_size: number | null
  duration_sec: number | null
  full_text: string | null
  labels: any[] | null
  original_name: string | null
  stored_name: string | null
}

export interface BulkCreateResponse {
  jobs: Array<
    | { id: string; filename: string; size?: number | null }
    | { filename: string; error: string }
  >
}

export interface JobDataPayload {
  job_id: string
  filename: string
  transcript_text: string
  flags: Array<{ label: string; text: string; start_sec: number; end_sec: number }>
}
