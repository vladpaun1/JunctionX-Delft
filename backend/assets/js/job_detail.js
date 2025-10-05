window.initializeJobDetail = function () {
  (function () {
     /* --------- helpers --------- */
  function mmss(v) {
    if (v === null || v === undefined || v === "") return "—";
    const s = Number(v);
    if (!isFinite(s)) return "—";
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  }

  // Back-compat: labels containing "abuse" OR legacy "terror" map to the same styles.
  function classFor(label) {
    const l = (label || "").toLowerCase();
    if (l.includes("abuse") || l.includes("terror")) return { span: "lbl-abuse", chip: "abuse" };
    if (l.includes("hate"))   return { span: "lbl-hate",   chip: "hate" };
    if (l.includes("bad"))    return { span: "lbl-bad",    chip: "bad" };
    return { span: "lbl-bad", chip: "bad" };
  }

  /* --------- tooltip (cursor-follow) --------- */
  const tip = document.createElement("div");
  tip.className = "flag-fly";
  document.body.appendChild(tip);

  document.querySelectorAll(".flagged").forEach((el) => {
    const label = el.dataset.label || "—";
    const st = el.dataset.start;
    const en = el.dataset.end;

    const { span, chip } = classFor(label);
    el.classList.add(span);

    el.addEventListener("mouseenter", () => {
      const pretty = chip === 'abuse' ? 'Abuse' : chip === 'hate' ? 'Hate speech' : 'Bad language';
      tip.textContent = `${pretty} • ${mmss(st)}–${mmss(en)}`;
      tip.className = `flag-fly ${chip}`;
      tip.style.opacity = "1";
    });
    el.addEventListener("mousemove", (e) => {
      const margin = 12, w = tip.offsetWidth || 180, h = tip.offsetHeight || 28;
      let x = e.clientX, y = e.clientY;
      x = Math.max(margin + w/2, Math.min(window.innerWidth - margin - w/2, x));
      y = Math.max(margin + h, y - 14);
      tip.style.left = `${x}px`;
      tip.style.top  = `${y}px`;
    });
    el.addEventListener("mouseleave", () => { tip.style.opacity = "0"; });
    el.addEventListener("focus", () => {
      const pretty = classFor(label).chip === 'abuse' ? 'Abuse' : classFor(label).chip === 'hate' ? 'Hate speech' : 'Bad language';
      tip.textContent = `${pretty} • ${mmss(st)}–${mmss(en)}`;
      tip.className = `flag-fly ${classFor(label).chip}`;
      tip.style.opacity = "1";
    });
    el.addEventListener("blur", () => { tip.style.opacity = "0"; });
  });

  /* --------- left gutter timestamps --------- */
  function buildGutter() {
    const wrap   = document.getElementById("transcript-wrap");
    const body   = document.getElementById("transcript");
    const gutter = document.getElementById("transcript-gutter");
    if (!wrap || !body || !gutter) return;

    gutter.innerHTML = "";

    const pieces = body.querySelectorAll(".plain, .flagged");

    const rows = new Map();

    pieces.forEach((el) => {
      const tStart = Number(el.dataset.start);
      const rects = el.getClientRects();
      for (const r of rects) {
        const key = Math.round(r.top);
        const current = rows.get(key);
        if (!current || r.left < current.left) {
          rows.set(key, { left: r.left, top: r.top, height: r.height, time: tStart });
        }
      }
    });

    const lines = Array.from(rows.values()).sort((a, b) => a.top - b.top);
    if (!lines.length) return;

    const wrapBox = wrap.getBoundingClientRect();
    const step = 5;

    for (let i = 0; i < lines.length; i += step) {
      const row = lines[i];
      const tick = document.createElement("div");
      tick.className = "tick";

      const baselineY = row.top - wrapBox.top + (row.height * 0.25);

      tick.style.top = `${baselineY}px`;
      tick.textContent = mmss(row.time);

      gutter.appendChild(tick);
    }
  }

  window.addEventListener("load", buildGutter);
  window.addEventListener("resize", buildGutter);

  let raf;
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(buildGutter);
  });
  const transcriptEl = document.getElementById("transcript");
  if (transcriptEl) ro.observe(transcriptEl);
  })();
};

if (document.querySelector('#transcript')) {
  window.initializeJobDetail();
}
