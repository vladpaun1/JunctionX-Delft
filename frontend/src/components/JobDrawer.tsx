import React, { useEffect, useMemo, useRef, useState } from "react";

/* ---------- types from your API ---------- */
export type JobDetail = {
  id: string;
  filename: string;
  status: string;
  duration_sec?: number | null;
  full_text?: string | null;
  labels?: any[] | null;
};

export type Flag = {
  label: string;
  text: string;
  start_sec: number;
  end_sec: number;
};

export type JobDataPayload = {
  job_id: string;
  filename: string;
  transcript_text: string;
  flags: Flag[];
};

/* ---------- utils ---------- */
const mmss = (sec?: number | null) => {
  if (sec == null || !Number.isFinite(sec)) return "00:00";
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const t = Math.floor(s % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${t}`;
};

const esc = (s: string) =>
  s.replace(/[<>&"']/g, (m) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" } as any)[m]);

/* ---------- label → css class ---------- */
const labelClass = (raw: string) => {
  const l = raw.toLowerCase();
  if (l.includes("hate")) return "lbl-hate";
  if (l.includes("abuse")) return "lbl-abuse";
  if (l.includes("bad")) return "lbl-bad";
  if (l.includes("skip")) return "plain";
  return "lbl-bad"; // default highlight
};

/* ---------- props ---------- */
export default function JobDrawer({
  open,
  job,
  load,
  onClose,
}: {
  open: boolean;
  job: { id: string; filename: string } | null;
  load: (id: string) => Promise<{ meta: JobDetail; data: JobDataPayload }>;
  onClose: () => void;
}) {
  const [meta, setMeta] = useState<JobDetail | null>(null);
  const [data, setData] = useState<JobDataPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  /* ---------- fetch payload when opened ---------- */
  useEffect(() => {
    let alive = true;
    setMeta(null);
    setData(null);
    setErr(null);
    if (open && job) {
      load(job.id)
        .then(({ meta, data }) => {
          if (!alive) return;
          setMeta(meta);
          setData(data);
        })
        .catch((e) => {
          if (!alive) return;
          setErr(e?.message || "Failed to load job data");
        });
    }
    return () => {
      alive = false;
    };
  }, [open, job, load]);

  /* ---------- build transcript HTML with inline flag spans ---------- */
  const transcriptHtml = useMemo(() => {
    if (!meta) return "";
    const txt = (data?.transcript_text || meta.full_text || "").trim();
    const flags = data?.flags || [];

    if (!flags.length) return esc(txt);

    // naive token-based replacement, in-order, using provided text spans
    // we assume flags[].text are substrings; wrap each occurrence once.
    let out = esc(txt);
    flags.forEach((f) => {
      const safe = esc(f.text || "");
      if (!safe) return;
      const cls = `${labelClass(f.label)} flagged`;
      // include data-* for tooltip
      const repl = `<span class="${cls}" data-label="${esc(f.label)}" data-start="${f.start_sec}" data-end="${f.end_sec}">${safe}</span>`;
      // replace first occurrence only to avoid wrapping same text elsewhere
      out = out.replace(safe, repl);
    });
    return out;
  }, [meta, data]);

  /* ---------- gutter ticks (every ~5 lines) ---------- */
  const [ticks, setTicks] = useState<{ top: number; label: string }[]>([]);
  const recomputeTicks = () => {
    const el = transcriptRef.current;
    const gutter = gutterRef.current;
    if (!el || !gutter) return;

    const cs = window.getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight || "0") || 20;
    const totalH = el.scrollHeight;
    if (!lh || !totalH) return;

    const totalLines = Math.max(1, Math.round(totalH / lh));
    const step = 5;
    const next: { top: number; label: string }[] = [];
    for (let i = 0; i <= totalLines; i += step) {
      const top = Math.round(i * lh);
      next.push({ top, label: mmss((data?.duration_sec || meta?.duration_sec || 0) * (i / totalLines)) });
    }
    setTicks(next);
  };

  useEffect(() => {
    if (!open) return;
    const ro = new ResizeObserver(() => recomputeTicks());
    const el = transcriptRef.current;
    if (el) ro.observe(el);
    window.addEventListener("resize", recomputeTicks);
    const sc = () => recomputeTicks();
    wrapRef.current?.addEventListener("scroll", sc, { passive: true });
    // initial
    setTimeout(recomputeTicks, 0);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recomputeTicks);
      wrapRef.current?.removeEventListener("scroll", sc as any);
    };
  }, [open, transcriptHtml]); // recompute whenever content changes

  /* ---------- tooltip on hover of .flagged ---------- */
  useEffect(() => {
    const root = transcriptRef.current;
    const tip = tooltipRef.current;
    if (!root || !tip) return;

    const onEnter = (ev: Event) => {
      const t = ev.target as HTMLElement;
      if (!t || !t.classList.contains("flagged")) return;
      const rect = t.getBoundingClientRect();
      const lab = t.getAttribute("data-label") || "flag";
      const s = Number(t.getAttribute("data-start") || "0");
      const e = Number(t.getAttribute("data-end") || "0");
      tip.innerHTML = `<div><b>${esc(lab)}</b></div><div>${mmss(s)} — ${mmss(e)}</div>`;
      // colorize subtle outline by type
      tip.className = "flag-fly " + labelClass(lab).replace("lbl-", "");
      // position: to the left gutter, vertically centered to the token
      const host = wrapRef.current?.getBoundingClientRect();
      const top = rect.top - (host?.top || 0) + (wrapRef.current?.scrollTop || 0) - 6;
      const left = 0; // we keep it pinned near gutter
      tip.style.transform = `translate(${left}px, ${Math.max(0, top)}px)`;
      tip.style.display = "block";
    };

    const onLeave = (ev: Event) => {
      const t = ev.target as HTMLElement;
      if (!t || !t.classList.contains("flagged")) return;
      tip.style.display = "none";
    };

    root.addEventListener("mouseover", onEnter);
    root.addEventListener("mouseout", onLeave);
    return () => {
      root.removeEventListener("mouseover", onEnter);
      root.removeEventListener("mouseout", onLeave);
    };
  }, [transcriptHtml]);

  if (!open) return null;

  return (
    <aside
      className={`fixed inset-y-0 right-0 w-[min(640px,92vw)] bg-bg/95 border-l border-white/10 shadow-2xl backdrop-blur-md transition ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
      aria-modal
      role="dialog"
    >
      <div className="h-full flex flex-col">
        <header className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-sm text-ink-dim">Job details</h2>
            <div className="text-base font-medium text-ink truncate max-w-[70vw]">{job?.filename || meta?.filename}</div>
          </div>
          <button className="btn btn-soft text-xs" onClick={onClose}>
            Close
          </button>
        </header>

        <div ref={wrapRef} className="relative flex-1 overflow-auto px-5 py-4">
          {/* legend */}
          <div className="mb-3 flex gap-2 text-xs">
            <span className="badge lbl-bad">Bad language</span>
            <span className="badge lbl-hate">Hate speech</span>
            <span className="badge lbl-abuse">Abuse</span>
          </div>

          {/* transcript + gutter */}
          <div className="transcript-wrap">
            <div ref={gutterRef} className="gutter" aria-hidden="true">
              {ticks.map((t, i) => (
                <div key={i} className="tick" style={{ position: "absolute", top: t.top }}>
                  {t.label}
                </div>
              ))}
            </div>
            <div
              ref={transcriptRef}
              className="transcript prose prose-invert max-w-none leading-7"
              dangerouslySetInnerHTML={{ __html: transcriptHtml || (err ? esc(err) : "") }}
            />
            <div ref={tooltipRef} className="flag-fly" style={{ display: "none", position: "absolute", left: 0 }} />
          </div>
        </div>
      </div>
    </aside>
  );
}
