import React, { useEffect, useMemo, useRef, useState } from "react";

// components you already have in src/components
import JobsGrid from "./components/JobsGrid";

// --- tiny, local toast stack (kept here so we don't depend on any other file)
type Toast = { id: string; msg: string; kind?: "danger" | "success" | "info"; ms?: number };
function useToasts() {
  const [toasts, set] = useState<Toast[]>([]);
  const push = (t: Omit<Toast, "id">) => {
    const toast: Toast = { id: crypto.randomUUID(), ...t };
    set((prev) => [...prev, toast]);
    const ttl = typeof t.ms === "number" ? t.ms : 2500;
    window.setTimeout(() => set((cur) => cur.filter((x) => x.id !== toast.id)), ttl);
  };
  const remove = (id: string) => set((cur) => cur.filter((x) => x.id !== id));
  return { toasts, push, remove };
}
function ToastArea({ toasts, remove }: { toasts: Toast[]; remove: (id: string) => void }) {
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind === "success" ? "border-emerald-400/30" : t.kind === "info" ? "border-sky-400/30" : "toast-danger"}`}>
          <span className="text-sm">{t.msg}</span>
          <button className="btn btn-soft px-2 py-1 text-xs" onClick={() => remove(t.id)}>Dismiss</button>
        </div>
      ))}
    </div>
  );
}

// --- types
type Job = {
  id: string;
  filename: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | string;
  src_size?: number | null;
  wav_size?: number | null;
  duration_sec?: number | null;
  error?: string | null;
};

// --- very small client for our API
async function api<T = any>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { credentials: "include", ...init });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return res.json().catch(() => ({} as any));
}
const listJobs = (limit = 50) => api<{ results?: Job[]; jobs?: Job[]; length?: number; [k: string]: any }>(`/api/jobs/?limit=${limit}`);
const getJob = (id: string) => api<Job>(`/api/jobs/${id}/`);
const bulkCreate = async (files: File[]) => {
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  return api<{ jobs: { id: string; filename: string; size?: number; error?: string }[] }>("/api/jobs/bulk/", { method: "POST", body: fd });
};
const deleteJob = (id: string) => fetch(`/api/jobs/${id}/`, { method: "DELETE", credentials: "include" }).then((r) => {
  if (!r.ok && r.status !== 204) throw new Error("Delete failed");
});
const getJobData = (id: string) => api(`/api/jobs/${id}/data/`);
const resetSession = () => api<{ ok: boolean; deleted?: number }>("/api/reset-session/");
const exportUrl = (id: string) => `/api/jobs/${id}/export/`;

// cache for file sizes so refresh doesn't show "—"
const SIZE_KEY = "ub:sizes:v1";
const readSizes = () => {
  try { return JSON.parse(localStorage.getItem(SIZE_KEY) || "{}"); } catch { return {}; }
};
const writeSizes = (m: Record<string, number>) => { try { localStorage.setItem(SIZE_KEY, JSON.stringify(m)); } catch {} };
const getCachedSize = (id: string) => {
  const m = readSizes(); const v = m[id];
  return Number.isFinite(v) && v > 0 ? v : null;
};
const setCachedSize = (id: string, bytes?: number | null) => {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return;
  const m = readSizes(); if (m[id] === n) return;
  m[id] = n; writeSizes(m);
};
const clearCachedSizes = () => localStorage.removeItem(SIZE_KEY);

// --- helpers
const pretty = (obj: unknown) => JSON.stringify(obj, null, 2);
const copy = async (s: string) => {
  try {
    await navigator.clipboard.writeText(s);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = s; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); return true; }
    catch { return false; }
    finally { document.body.removeChild(ta); }
  }
};

export default function App() {
  const { toasts, push, remove } = useToasts();
  const [files, setFiles] = useState<File[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);

  // --- initial load
  useEffect(() => {
    (async () => {
      try {
        const payload = await listJobs(50);
        const arr: Job[] = Array.isArray(payload?.results)
          ? payload.results as Job[]
          : Array.isArray((payload as any)?.jobs)
          ? (payload as any).jobs as Job[]
          : (payload as any) as Job[]; // some DRF configs return a flat array

        // stitch cached sizes
        setJobs(arr.map(j => {
          const sz = j.src_size ?? j.wav_size ?? getCachedSize(j.id) ?? null;
          if (sz) setCachedSize(j.id, sz);
          return { ...j, src_size: sz ?? j.src_size ?? null };
        }));
      } catch (e: any) {
        push({ msg: e?.message || "Failed to load jobs", kind: "danger" });
      }
    })();
  }, []); // eslint-disable-line

  // --- poll RUNNING/PENDING jobs
  const poller = useRef<number | null>(null);
  useEffect(() => {
    if (poller.current) window.clearInterval(poller.current);
    const pending = jobs.filter(j => j.status !== "SUCCESS" && j.status !== "FAILED");
    if (!pending.length) return;
    poller.current = window.setInterval(async () => {
      try {
        const updates = await Promise.all(pending.map(j => getJob(j.id).catch(() => null)));
        setJobs(cur => cur.map(row => {
          const upd = updates.find(u => u && u.id === row.id) as Job | undefined;
          if (!upd) return row;
          const sz = upd.src_size ?? upd.wav_size ?? row.src_size ?? getCachedSize(upd.id) ?? null;
          if (sz) setCachedSize(upd.id, sz);
          return { ...row, ...upd, src_size: sz ?? upd.src_size ?? row.src_size ?? null };
        }));
      } catch {/* ignore */}
    }, 1200) as unknown as number;
    return () => { if (poller.current) window.clearInterval(poller.current); };
  }, [jobs]);

  // --- actions
  const onAnalyze = async () => {
    if (!files.length) { push({ msg: "Please choose one or more audio/video files.", kind: "danger" }); return; }
    setBusy(true);
    try {
      const { jobs: created } = await bulkCreate(files);
      const next: Job[] = created.map(j => ({
        id: j.id,
        filename: j.filename,
        status: j.error ? "FAILED" : "PENDING",
        src_size: j.size ?? null,
        wav_size: null,
        duration_sec: null,
        error: j.error ?? null,
      }));
      // prime cache
      next.forEach(j => j.src_size && setCachedSize(j.id, j.src_size));
      setJobs(cur => [...next, ...cur]);
      setFiles([]);
      push({ msg: "Files queued. Processing…", kind: "info" });
    } catch (e: any) {
      push({ msg: e?.message || "Upload failed", kind: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (job: Job) => {
    try {
      await deleteJob(job.id);
      setJobs(cur => cur.filter(j => j.id !== job.id));
      push({ msg: "Deleted.", kind: "success" });
    } catch (e: any) {
      push({ msg: e?.message || "Delete failed", kind: "danger" });
    }
  };

  const onExport = (job: Job) => {
    // simple file download
    window.open(exportUrl(job.id), "_blank");
  };

  const onCopyJson = async (job: Job) => {
    try {
      const payload = await getJobData(job.id);
      const ok = await copy(pretty(payload));
      push({ msg: ok ? "JSON copied." : "Copy failed", kind: ok ? "success" : "danger" });
    } catch (e: any) {
      push({ msg: e?.message || "Copy failed", kind: "danger" });
    }
  };

  const onCopyAll = async () => {
    try {
      const payloads = await Promise.all(
        jobs
          .filter(j => j.status === "SUCCESS")
          .map(j => getJobData(j.id).catch(() => null))
      );
      const merged = payloads.filter(Boolean);
      if (!merged.length) { push({ msg: "Nothing to copy.", kind: "info" }); return; }
      const ok = await copy(pretty(merged));
      push({ msg: ok ? "All JSON copied." : "Copy failed", kind: ok ? "success" : "danger" });
    } catch (e: any) {
      push({ msg: e?.message || "Copy failed", kind: "danger" });
    }
  };

  const onExportAll = async () => {
    // client-side bundle into one file
    try {
      const payloads = await Promise.all(
        jobs
          .filter(j => j.status === "SUCCESS")
          .map(j => getJobData(j.id).catch(() => null))
      );
      const merged = payloads.filter(Boolean);
      if (!merged.length) { push({ msg: "Nothing to export.", kind: "info" }); return; }
      const blob = new Blob([pretty(merged)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "junctionx_export.json"; a.click();
      URL.revokeObjectURL(url);
      push({ msg: "Exported.", kind: "success" });
    } catch (e: any) {
      push({ msg: e?.message || "Export failed", kind: "danger" });
    }
  };

  const onResetSession = async () => {
    try {
      const res = await resetSession(); // server also deletes session-owned jobs + files
      clearCachedSizes();
      setJobs([]);
      push({ msg: res?.deleted ? `Session reset. Removed ${res.deleted} job(s).` : "Session reset.", kind: "success" });
    } catch (e: any) {
      push({ msg: e?.message || "Reset failed", kind: "danger" });
    }
  };

  // convenient computed stats
  const counts = useMemo(() => {
    return {
      total: jobs.length,
      ok: jobs.filter(j => j.status === "SUCCESS").length,
      run: jobs.filter(j => j.status === "RUNNING" || j.status === "PENDING").length,
      fail: jobs.filter(j => j.status === "FAILED").length,
    };
  }, [jobs]);

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
        {/* upload panel */}
        <div className="card p-5 mb-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label className="flex-1">
              <span className="block text-sm mb-2 text-ink-dim">Select audio/video</span>
              <input
                type="file"
                multiple
                accept="audio/*,video/*"
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                className="block w-full text-sm file:mr-4 file:px-3 file:py-2 file:rounded-lg file:border file:border-white/10 file:bg-white/5 file:text-ink hover:file:bg-white/10"
              />
            </label>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={onAnalyze} disabled={busy}>
                {busy ? "Uploading…" : "Analyze selected"}
              </button>
            </div>
          </div>
          {files.length > 0 && (
            <p className="text-xs text-ink-dim mt-2">{files.length} file(s) selected.</p>
          )}
        </div>

        {/* jobs grid */}
        <JobsGrid
          jobs={jobs}
          onSelect={async (job) => {
            if (job.status !== "SUCCESS") return;
            // copy json on click, quick win; you can swap to a Drawer later
            try {
              const payload = await getJobData(job.id);
              const ok = await copy(pretty(payload));
              push({ msg: ok ? "JSON copied." : "Copy failed", kind: ok ? "success" : "danger" });
            } catch (e: any) {
              push({ msg: e?.message || "Failed to load data", kind: "danger" });
            }
          }}
          onDelete={onDelete}
          onExport={onExport}
        />
      </section>

      <footer className="py-10" />
    </main>
  );
}
