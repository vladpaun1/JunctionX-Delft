import React, { useEffect, useMemo, useRef, useState } from "react";

/* ===== Types ===== */
type Flag = { label?: string; text?: string; start_sec?: number; end_sec?: number };
export type JobDetail = {
  id: string;
  original_name?: string | null;
  stored_name?: string | null;
  full_text?: string | null;
  labels?: any[] | null;
};
export type JobDataPayload = {
  job_id: string;
  filename: string;
  transcript_text: string;
  flags: Flag[];
};

/* ===== Small helpers ===== */
const mmss = (sec?: number | null) => {
  if (sec == null || !isFinite(sec)) return "00:00";
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const t = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${t}`;
};
const esc = (s: string) =>
  s.replace(/[<>&"']/g, (m) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" } as any)[m]);

const classFor = (label?: string) => {
  const l = (label || "").toLowerCase();
  if (l.includes("hate")) return "lbl-hate";
  if (l.includes("abuse")) return "lbl-abuse";
  if (l.includes("bad")) return "lbl-bad";
  if (l.includes("skip")) return "plain";
  return "flagged";
};

function normalizeLabels(input: any[] | null | undefined): Flag[] {
  if (!Array.isArray(input)) return [];
  const out: Flag[] = [];
  for (const row of input) {
    if (Array.isArray(row)) {
      const [label, text, start, end] = row;
      out.push({
        label: String(label ?? ""),
        text: String(text ?? ""),
        start_sec: start != null ? Number(start) : 0,
        end_sec: end != null ? Number(end) : 0,
      });
    } else if (row && typeof row === "object") {
      out.push({
        label: row.label ?? row.type ?? "flag",
        text: row.text ?? row.span ?? "",
        start_sec: Number(row.start_sec ?? row.start ?? 0),
        end_sec: Number(row.end_sec ?? row.end ?? 0),
      });
    }
  }
  return out;
}

/* ===== Component ===== */
export default function JobDrawer({
  open,
  job,                 // { id, filename }
  load,                // (id) => Promise<{meta, data}>
  onClose,
}: {
  open: boolean;
  job: { id: string; filename: string } | null;
  load: (id: string) => Promise<{ meta: JobDetail; data: JobDataPayload }>;
  onClose: () => void;
}) {
  const [meta, setMeta] = useState<JobDetail | null>(null);
  const [data, setData] = useState<JobDataPayload | null>(null);
  const [busy, setBusy] = useState(false);

  // DOM refs
  const wrapRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Load when opened for a given job id
  useEffect(() => {
    if (!open || !job) return;
    setBusy(true);
    setMeta(null);
    setData(null);
    load(job.id)
      .then(({ meta, data }) => {
        setMeta(meta);
        setData(data);
      })
      .finally(() => setBusy(false));
  }, [open, job, load]);

  const transcriptHtml = useMemo(() => {
    if (!meta) return "";
    const flags: Flag[] =
      (data?.flags && data.flags.length ? data.flags : []) ||
      normalizeLabels(meta.labels || []);
    const txt = data?.transcript_text || meta?.full_text || "";

    if (flags.length) {
      return flags
        .map((f) => {
          const cls = classFor(f.label);
          const label = esc(f.label || "");
          const text = esc(f.text || "");
          const s = Number.isFinite(f.start_sec) ? String(f.start_sec) : "";
          const e = Number.isFinite(f.end_sec) ? String(f.end_sec) : "";
          return `<span class="${cls}" data-label="${label}" data-start="${s}" data-end="${e}">${text}</span><span> </span>`;
        })
        .join("");
    }
    return esc(txt);
  }, [meta, data]);

  // Hover tooltip for flagged spans
  useEffect(() => {
    if (!open) return;
    const root = bodyRef.current;
    if (!root) return;
    const tip = document.createElement("div");
    tip.className = "flag-fly";
    tip.style.position = "absolute";
    tip.style.visibility = "hidden";
    root.appendChild(tip);

    function show(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t || !t.classList.contains("flagged")) return;
      const label = t.getAttribute("data-label") || "flag";
      const start = Number(t.getAttribute("data-start") || "0");
      const end = Number(t.getAttribute("data-end") || "0");
      tip.textContent = `${label} · ${mmss(start)}–${mmss(end)}`;
      tip.className = `flag-fly ${classFor(label).replace("lbl-", "")}`;
      const r = t.getBoundingClientRect();
      tip.style.left = `${r.left + window.scrollX}px`;
      tip.style.top = `${r.top + window.scrollY - 32}px`;
      tip.style.visibility = "visible";
    }
    function hide() {
      tip.style.visibility = "hidden";
    }

    root.addEventListener("mousemove", show);
    root.addEventListener("mouseleave", hide);
    document.addEventListener("scroll", hide, true);

    return () => {
      root.removeEventListener("mousemove", show);
      root.removeEventListener("mouseleave", hide);
      document.removeEventListener("scroll", hide, true);
      tip.remove();
    };
  }, [open, transcriptHtml]);

  // Gutter: every 5th visual line shows the time of the first span on that line
  useEffect(() => {
    if (!open) return;
    const scrollHost = wrapRef.current;
    const gutter = gutterRef.current;
    const transcript = bodyRef.current?.querySelector(".transcript") as HTMLElement | null;
    if (!scrollHost || !gutter || !transcript) return;

    const redraw = () => {
      const spans = Array.from(transcript.querySelectorAll("span"));
      gutter.innerHTML = "";
      if (!spans.length) return;

      const lines: { top: number; el: HTMLElement }[] = [];
      let lastTop = -1;
      for (const el of spans as HTMLElement[]) {
        const r = el.getBoundingClientRect();
        if (lastTop < 0 || Math.abs(r.top - lastTop) > 2) {
          lines.push({ top: r.top, el });
          lastTop = r.top;
        }
      }

      lines.forEach((ln, idx) => {
        if (idx % 5 !== 0) return;
        const y = (ln.el as HTMLElement).offsetTop;
        const tick = document.createElement("div");
        tick.className = "tick";
        tick.style.position = "absolute";
        tick.style.left = "0";
        tick.style.top = `${y}px`;
        const s = Number((ln.el as HTMLElement).getAttribute("data-start") || "0");
        tick.textContent = mmss(Number.isFinite(s) ? s : 0);
        gutter.appendChild(tick);
      });
    };

    const ro = new ResizeObserver(() => redraw());
    ro.observe(transcript);
    const iv = window.setInterval(redraw, 300);
    redraw();

    const onScroll = () => {/* no-op */};
    scrollHost.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      ro.disconnect();
      window.clearInterval(iv);
      scrollHost.removeEventListener("scroll", onScroll);
    };
  }, [open, transcriptHtml]);

  const title = meta?.original_name || meta?.stored_name || job?.filename || "Job details";

  if (!open || !job) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside
        className="absolute top-0 right-0 h-full w-[min(720px,92vw)] card border-white/10 bg-bg-card/80 overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <header className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="text-xs text-ink-dim">Job details</div>
            <h2 className="font-medium text-ink truncate max-w-[520px]">{busy ? "Loading…" : title}</h2>
          </div>
          <button className="btn btn-soft text-xs" onClick={onClose}>Close</button>
        </header>

        <div ref={wrapRef} className="h-[calc(100%-56px)] overflow-auto p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="badge lbl-bad">Bad language</span>
            <span className="badge lbl-hate">Hate speech</span>
            <span className="badge lbl-abuse">Abuse</span>
          </div>
          <div className="transcript-wrap">
            <div ref={gutterRef} className="gutter relative" aria-hidden="true" />
            <div
              ref={bodyRef}
              className="transcript"
              dangerouslySetInnerHTML={{ __html: transcriptHtml }}
            />
          </div>
        </div>
      </aside>
    </div>
  );
}
