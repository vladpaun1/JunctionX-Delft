// frontend/src/App.tsx
import { useEffect, useMemo, useRef, useState } from "react";

// components
import UploadPanel from "./components/UploadPanel";
import JobsGrid from "./components/JobsGrid";
import JobDrawer from "./components/JobDrawer";
import ToastArea, { useToasts } from "./components/Toast";

// api + utils + types
import { listJobs, bulkCreate, getJob, getJobData, deleteJob, resetSession, exportUrl } from "./lib/api";
import { pretty, copyToClipboard } from "./lib/utils";
import type { JobsListResponse } from './lib/api';
import type { JobListItem } from './lib/types';

import { cache } from "./lib/cache";

function normalizeJobs(resp: JobsListResponse): JobListItem[] {
  if (Array.isArray(resp)) return resp as JobListItem[];
  if (Array.isArray((resp as any).results)) return (resp as any).results as JobListItem[];
  if (Array.isArray((resp as any).jobs)) return (resp as any).jobs as JobListItem[];
  return [];
}

export default function App() {
  const { toasts, push, remove } = useToasts();

  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [drawerJob, setDrawerJob] = useState<{ id: string; filename: string } | null>(null);

  // ---- helpers to mutate rows
  const refreshRow = (id: string, patch: Partial<JobListItem>) => {
    setJobs((cur) => cur.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  };
  const removeRow = (id: string) => {
    setJobs((cur) => cur.filter((j) => j.id !== id));
    cache.remove(id);
  };

  // ---- initial load
  useEffect(() => {
    (async () => {
      try {
        const payload = await listJobs(50);
        const rows = normalizeJobs(payload);

        // stitch cached sizes so refresh doesn't show "—"
        setJobs(
          rows.map((j) => {
            const size = j.src_size ?? j.wav_size ?? cache.getSize(j.id) ?? null;
            if (size) cache.setSize(j.id, size);
            return { ...j, src_size: size ?? j.src_size ?? null };
          })
        );
      } catch (e: any) {
        push({ msg: e?.message || "Failed to load jobs", kind: "danger" });
      }
    })();
  }, [push]);

  // ---- poll RUNNING/PENDING jobs
  const poller = useRef<number | null>(null);
  useEffect(() => {
    if (poller.current) window.clearInterval(poller.current);
    const pending = jobs.filter((j) => j.status !== "SUCCESS" && j.status !== "FAILED");
    if (!pending.length) return;

    poller.current = window.setInterval(async () => {
      try {
        const updates = await Promise.all(pending.map((j) => getJob(j.id).catch(() => null)));
        setJobs((cur) =>
          cur.map((row) => {
            const upd = updates.find((u) => u && u.id === row.id) as JobListItem | undefined;
            if (!upd) return row;
            const size = upd.src_size ?? upd.wav_size ?? row.src_size ?? cache.getSize(upd.id) ?? null;
            if (size) cache.setSize(upd.id, size);
            return { ...row, ...upd, src_size: size ?? upd.src_size ?? row.src_size ?? null };
          })
        );
      } catch {
        /* ignore */
      }
    }, 1200) as unknown as number;

    return () => {
      if (poller.current) window.clearInterval(poller.current);
    };
  }, [jobs]);

  // ---- actions
  const onAnalyze = async () => {
    if (!files.length) {
      push({ msg: "Please choose one or more audio/video files.", kind: "danger" });
      return;
    }
    setBusy(true);
    try {
      const { jobs: created } = await bulkCreate(files);
      const updates: JobListItem[] = created.map((j) => ({
        id: j.id,
        filename: j.filename,
        status: j.error ? "FAILED" : "PENDING",
        error: j.error ?? null,
        src_size: j.size ?? null,
        wav_size: null,
        duration_sec: null,
      }));
      updates.forEach((j) => j.src_size && cache.setSize(j.id, j.src_size));
      setJobs((cur) => [...updates, ...cur]);
      setFiles([]);
      push({ msg: "Files queued. Processing…", kind: "info" });
    } catch (e: any) {
      push({ msg: e?.message || "Upload failed", kind: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (job: JobListItem) => {
    try {
      await deleteJob(job.id);
      removeRow(job.id);
      push({ msg: "Deleted.", kind: "success" });
    } catch (e: any) {
      push({ msg: e?.message || "Delete failed", kind: "danger" });
    }
  };

  const onExport = (job: JobListItem) => {
    window.open(exportUrl(job.id), "_blank");
  };

  const onCopyJson = async (job: JobListItem) => {
    try {
      const payload = await getJobData(job.id);
      const ok = await copyToClipboard(pretty(payload));
      push({ msg: ok ? "JSON copied." : "Copy failed", kind: ok ? "success" : "danger" });
    } catch (e: any) {
      push({ msg: e?.message || "Copy failed", kind: "danger" });
    }
  };

  const onCopyAll = async () => {
    try {
      const payloads = await Promise.all(
        jobs.filter((j) => j.status === "SUCCESS").map((j) => getJobData(j.id).catch(() => null))
      );
      const merged = payloads.filter(Boolean);
      if (!merged.length) {
        push({ msg: "Nothing to copy.", kind: "info" });
        return;
      }
      const ok = await copyToClipboard(pretty(merged));
      push({ msg: ok ? "All JSON copied." : "Copy failed", kind: ok ? "success" : "danger" });
    } catch (e: any) {
      push({ msg: e?.message || "Copy failed", kind: "danger" });
    }
  };

  const onExportAll = async () => {
    try {
      const payloads = await Promise.all(
        jobs.filter((j) => j.status === "SUCCESS").map((j) => getJobData(j.id).catch(() => null))
      );
      const merged = payloads.filter(Boolean);
      if (!merged.length) {
        push({ msg: "Nothing to export.", kind: "info" });
        return;
      }
      const blob = new Blob([pretty(merged)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "junctionx_export.json";
      a.click();
      URL.revokeObjectURL(url);
      push({ msg: "Exported.", kind: "success" });
    } catch (e: any) {
      push({ msg: e?.message || "Export failed", kind: "danger" });
    }
  };

  const onResetSession = async () => {
    try {
      const res = await resetSession();
      cache.clear();
      setJobs([]);
      push({ msg: res?.deleted ? `Session reset. Removed ${res.deleted} job(s).` : "Session reset.", kind: "success" });
    } catch (e: any) {
      push({ msg: e?.message || "Reset failed", kind: "danger" });
    }
  };

  // quick stats for header
  const counts = useMemo(
    () => ({
      total: jobs.length,
      ok: jobs.filter((j) => j.status === "SUCCESS").length,
      run: jobs.filter((j) => j.status === "RUNNING" || j.status === "PENDING").length,
      fail: jobs.filter((j) => j.status === "FAILED").length,
    }),
    [jobs]
  );

  return (
    <main className="min-h-screen bg-bg">
      <ToastArea toasts={toasts} remove={remove} />

      <header className="container mx-auto px-5 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-brand/40 shadow-glow" />
          <h1 className="text-lg font-semibold text-ink">JunctionX · Moderation</h1>
          <div className="ml-4 hidden md:flex items-center gap-2 text-xs text-ink-dim">
            <span className="badge badge-ok">OK {counts.ok}</span>
            <span className="badge badge-run">RUN {counts.run}</span>
            <span className="badge badge-fail">FAIL {counts.fail}</span>
            <span className="badge bg-white/5 border-white/10 text-ink">TOTAL {counts.total}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn btn-soft text-xs" onClick={onCopyAll}>Copy all JSON</button>
          <button className="btn btn-soft text-xs" onClick={onExportAll}>Export all</button>
          <button className="btn btn-danger text-xs" onClick={onResetSession}>Reset session</button>
        </div>
      </header>

      <section className="container mx-auto px-5">
        <UploadPanel
          files={files}
          setFiles={setFiles}
          busy={busy}
          onAnalyze={onAnalyze}
        />

        <JobsGrid
          jobs={jobs}
          onSelect={(j) => j.status === "SUCCESS" && setDrawerJob({ id: j.id, filename: j.filename })}
          onDelete={onDelete}
          onExport={onExport}
          onCopyJson={onCopyJson}
        />
      </section>

      {/* detail drawer */}
      <JobDrawer
        job={drawerJob}
        load={(id) => getJobData(id)}
        onClose={() => setDrawerJob(null)}
      />

      <footer className="py-10" />
    </main>
  );
}
