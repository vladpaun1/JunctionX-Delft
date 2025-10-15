import React, { useEffect, useMemo, useRef, useState } from "react";

type Flag = {
  label: string;
  text: string;
  start_sec: number;
  end_sec: number;
};
type JobDataPayload = {
  job_id: string;
  filename: string;
  transcript_text: string;
  flags: Flag[];
};
type Job = { id: string; filename: string };

function esc(s: string) {
  return s.replace(/[<>&"']/g, (m) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" } as any)[m]);
}
const mmss = (sec?: number | null) => {
  if (sec == null || !isFinite(sec as any)) return "00:00";
  const s = Math.max(0, Math.floor(Number(sec)));
  const m = String(Math.floor(s / 60)).padStart(2, "0");
  const t = String(Math.floor(s % 60)).padStart(2, "0");
  return `${m}:${t}`;
};

export default function JobDrawer({
  job,
  load,
  onClose,
}: {
  job: Job | null;
  load: (id: string) => Promise<JobDataPayload>;
  onClose: () => void;
}) {
  const [data, setData] = useState<JobDataPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);

  // fetch on open
  useEffect(() => {
    if (!job) return;
    setLoading(true); setErr(null); setData(null);
    load(job.id)
      .then(setData)
      .catch((e) => setErr(e?.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, [job, load]);

  // build transcript HTML: prefer flags if present
  const transcriptHtml = useMemo(() => {
    if (!data) return "";
    const flags = Array.isArray(data.flags) ? data.flags : [];
    const txt = data.transcript_text || "";

    if (flags.length) {
      return flags
        .map((f) => {
          const cls = /skip/i.test(f.label) ? "plain" : "flagged";
          return `<span class="${cls}" data-label="${esc(f.label)}" data-start="${f.start_sec}" data-end="${f.end_sec}">${esc(
            f.text || ""
          )}</span><span> </span>`;
        })
        .join("");
    }
    // fallback: plain text
    return esc(txt);
  }, [data]);

  // hover tooltips for timestamps
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const tip = tipRef.current!;
    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!(t instanceof HTMLElement)) return;
      if (t.tagName !== "SPAN") {
        tip.style.display = "none";
        return;
      }
      const label = t.getAttribute("data-label");
      const start = Number(t.getAttribute("data-start") || "0");
      const end = Number(t.getAttribute("data-end") || "0");
      if (!label && !start && !end) {
        tip.style.display = "none";
        return;
      }
      tip.innerHTML = `
        <div><strong>${esc(label || "Span")}</strong></div>
        <div>${mmss(start)} – ${mmss(end)}</div>
      `;
      tip.className = `flag-fly ${labelClass(label)}`;
      tip.style.display = "block";
      tip.style.left = Math.min(window.innerWidth - 220, e.pageX + 14) + "px";
      tip.style.top = e.pageY + 10 + "px";
    };
    const onOut = () => { tip.style.display = "none"; };
    el.addEventListener("mousemove", onOver);
    el.addEventListener("mouseleave", onOut);
    return () => {
      el.removeEventListener("mousemove", onOver);
      el.removeEventListener("mouseleave", onOut);
    };
  }, [transcriptHtml]);

  // left gutter: render a tick roughly every 5 spans with the span's start time
  useEffect(() => {
    const gutter = gutterRef.current;
    const host = wrapRef.current;
    if (!gutter || !host) return;
    gutter.innerHTML = "";
    const spans = Array.from(host.querySelectorAll("span"));
    if (!spans.length) return;
    const step = 5;
    for (let i = 0; i < spans.length; i += step) {
      const s = spans[i] as HTMLElement;
      const sec = Number(s.getAttribute("data-start") || "0");
      const div = document.createElement("div");
      div.className = "tick";
      div.textContent = mmss(sec);
      gutter.appendChild(div);
    }
  }, [transcriptHtml]);

  if (!job) return null;

  return (
    <>
      {/* overlay */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />

      {/* panel */}
      <aside className="fixed right-0 top-0 bottom-0 w-full md:w-[680px] z-50 card rounded-none md:rounded-l-2xl border-l border-white/10 overflow-hidden">
        <header className="px-5 py-4 flex items-center justify-between border-b border-white/10">
          <div>
            <div className="text-sm text-ink-dim">Job details</div>
            <div className="font-medium text-ink truncate max-w-[520px]" title={job.filename}>
              {job.filename}
            </div>
          </div>
          <button className="btn btn-soft" onClick={onClose}>Close</button>
        </header>

        <section className="p-5 space-y-4 overflow-y-auto h-full">
          {loading && <div className="text-ink-dim text-sm">Loading…</div>}
          {err && <div className="text-rose-300 text-sm">{err}</div>}
          {data && (
            <>
              <div className="flex items-center gap-2">
                <span className="badge badge-ok">Bad language</span>
                <span className="badge badge-fail">Hate speech</span>
                <span className="badge bg-white/5 border-white/10 text-ink">Abuse</span>
              </div>

              <div className="transcript-wrap">
                <div ref={gutterRef} className="gutter" aria-hidden="true" />
                <div
                  ref={wrapRef}
                  className="prose prose-invert max-w-none text-sm leading-6 transcript"
                  dangerouslySetInnerHTML={{ __html: transcriptHtml }}
                />
                <div ref={tipRef} className="flag-fly" style={{ display: "none" }} />
              </div>
            </>
          )}
        </section>
      </aside>
    </>
  );
}

function labelClass(lbl?: string | null) {
  const s = String(lbl || "").toLowerCase();
  if (s.includes("hate")) return "hate";
  if (s.includes("abuse")) return "abuse";
  if (s.includes("bad")) return "bad";
  return "";
}
