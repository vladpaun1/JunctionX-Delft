// frontend/src/lib/types.ts
export type JobStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';

export type JobListItem = {
  id: string;
  filename: string;
  status: JobStatus | string;          // tolerate unknown strings from API
  src_size?: number | null;
  wav_size?: number | null;
  duration_sec?: number | null;
  error?: string | null;
};

export type JobDataPayload = {
  job_id: string;
  filename: string;
  transcript_text: string;
  flags: Array<{
    label: string;
    text: string;
    start_sec: number;
    end_sec: number;
  }>;
};
