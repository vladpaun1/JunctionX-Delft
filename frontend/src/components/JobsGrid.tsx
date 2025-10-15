import React from "react";

type Job = {
  id: string;
  filename: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | string;
  src_size?: number | null;
  wav_size?: number | null;
  duration_sec?: number | null;
  error?: string | null;
};

type JobsProp =
  | Job[]
  | { results: Job[] }
  | { jobs: Job[] }
  | null
  | undefined;

interface JobsGridProps {
  jobs: JobsProp;
  onSelect?: (job: Job) => void;
  onDelete?: (job: Job) => void;
  onExport?: (job: Job) => void;
}

/**
 * Normalizes jobs array regardless of API shape (flat or paginated)
 */
function normalizeJobs(input: JobsProp): Job[] {
  if (Array.isArray(input)) return input;
  if (input && Array.isArray((input as any).results))
    return (input as any).results;
  if (input && Array.isArray((input as any).jobs)) return (input as any).jobs;
  return [];
}

/**
 * Status badge renderer
 */
function StatusBadge({ status }: { status: string }) {
  const base = "badge";
  const cls =
    status === "SUCCESS"
      ? `${base} badge-ok`
      : status === "RUNNING"
      ? `${base} badge-run`
      : status === "FAILED"
      ? `${base} badge-fail`
      : `${base} bg-slate-500/20 text-slate-200 border-slate-400/30`;
  return <span className={cls}>{status}</span>;
}

/**
 * JobsGrid – displays a responsive card grid of upload jobs
 */
export default function JobsGrid({
  jobs,
  onSelect,
  onDelete,
  onExport,
}: JobsGridProps) {
  const safeJobs = normalizeJobs(jobs);

  if (!safeJobs.length) {
    return (
      <div className="card p-10 text-center text-ink-dim flex flex-col items-center justify-center gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-10 h-10 text-ink-dim/70"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 13h6m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5l2 2h6a2 2 0 012 2v6m-3 5v4m0 0h4m-4 0h-4"
          />
        </svg>
        <p className="text-sm">
          No jobs yet — upload audio or video files to start processing.
        </p>
      </div>
    );
  }

  return (
    <section className="grid-auto">
      {safeJobs.map((job) => (
        <div
          key={job.id}
          className="card p-4 flex flex-col gap-3 transition hover:shadow-glow cursor-pointer"
          onClick={() => onSelect?.(job)}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-medium truncate text-ink">{job.filename}</h3>
            <StatusBadge status={job.status} />
          </div>

          <div className="text-xs text-ink-dim flex flex-col gap-0.5">
            {job.src_size ? (
              <span>
                Size: {(job.src_size / 1024 / 1024).toFixed(2)} MB
              </span>
            ) : (
              <span>Size: —</span>
            )}
            {job.duration_sec ? (
              <span>
                Duration: {(job.duration_sec / 60).toFixed(1)} min
              </span>
            ) : (
              <span>Duration: —</span>
            )}
          </div>

          <div className="flex gap-2 mt-auto">
            {onExport && (
              <button
                className="btn btn-soft flex-1 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onExport(job);
                }}
              >
                Export JSON
              </button>
            )}
            {onDelete && (
              <button
                className="btn btn-danger flex-1 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(job);
                }}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
