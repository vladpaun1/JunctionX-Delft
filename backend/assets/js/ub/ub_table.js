// UB table rendering + polling (centered action; spinner-only pending)
// Uses UB.cache to persist size across reloads.
(function () {
  const UB = (window.UB = window.UB || {});

  const dom    = UB.dom    || {};
  const api    = UB.api    || {};
  const modal  = UB.modal  || {};
  const cache  = UB.cache  || { getSize:()=>null, setSize:()=>{} };

  const escapeHtml = dom.escapeHtml || ((x) => String(x));
  const fmtBytes   = dom.fmtBytes   || (() => "—");
  const flash      = dom.flash      || ((...a) => console.log("[flash]", ...a));

  const listJobs     = api.listJobs || (async () => []);
  const getJob       = api.getJob   || (async () => ({}));
  const openJobModal = modal.openJobModal || (() => {});

  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const pickSize = (obj) =>
    toNum(obj?.size) ??
    toNum(obj?.src_size) ??
    toNum(obj?.file_size) ??
    toNum(obj?.src_bytes) ??
    null;

  const statusBadge = (label) => {
    if (label === "SUCCESS") return `<span class="badge bg-success">SUCCESS</span>`;
    if (label === "FAILED")  return `<span class="badge bg-danger">FAILED</span>`;
    if (label === "RUNNING") return `<span class="badge bg-secondary">RUNNING</span>`;
    return `<span class="badge text-bg-secondary">${escapeHtml(label || "PENDING")}</span>`;
  };

  const actionHtmlFor = (id, status, err) => {
    if (status === "SUCCESS") {
      return `
        <div class="action-row">
          <button class="btn btn-outline-primary btn-sm btn-view" data-id="${id}">Details</button>
          <button class="btn btn-outline-secondary btn-sm btn-copy-json" data-id="${id}">Copy JSON</button>
          <a class="btn btn-outline-secondary btn-sm" href="/api/jobs/${id}/export/" download>Export JSON</a>
          <button class="btn btn-outline-danger btn-sm btn-delete" data-id="${id}">Delete</button>
        </div>`;
    }
    if (status === "FAILED") {
      return `
        <div class="action-row">
          <button class="btn btn-outline-danger btn-sm" disabled>Failed</button>
          <button class="btn btn-outline-secondary btn-sm btn-delete" data-id="${id}">Delete</button>
        </div>`;
    }
    return `
      <div class="action-row">
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
      </div>`;
  };

  const rowTpl = ({ id, filename, size, status, error }) => {
    const lab =
      error ? "FAILED" :
      status === "SUCCESS" ? "SUCCESS" :
      status === "FAILED"  ? "FAILED" :
      status || "PENDING";

    if (error) flash(error, "danger");

    // prefer explicit size; else check cache
    const sizeNum  = toNum(size) ?? cache.getSize(id);
    const sizeText = sizeNum != null ? fmtBytes(sizeNum) : "—";
    const sizeAttr = sizeNum != null ? String(sizeNum) : "";

    return `
      <tr data-id="${id}">
        <td>${escapeHtml(filename || "")}</td>
        <td class="size-cell" data-size="${sizeAttr}">${sizeText}</td>
        <td class="status">${statusBadge(lab)}</td>
        <td class="action-cell">${actionHtmlFor(id, lab, error)}</td>
      </tr>`;
  };

  function createRenderer(tbody) {
    const upsertRow = (job) => {
      const existing = tbody.querySelector(`tr[data-id="${job.id}"]`);
      const tmp = document.createElement("tbody");
      tmp.innerHTML = rowTpl(job).trim();
      const fresh = tmp.firstElementChild;
      if (existing) tbody.replaceChild(fresh, existing);
      else tbody.prepend(fresh);
    };
    return { upsertRow };
  }

  function createPoller(tbody) {
    const polling = new Map();

    const start = (id) => {
      if (polling.has(id)) return;
      const iv = setInterval(async () => {
        try {
          const data = await getJob(id);
          const tr = tbody.querySelector(`tr[data-id="${id}"]`);
          if (!tr) return;

          const statusCell = tr.querySelector(".status");
          const actionCell = tr.querySelector(".action-cell");
          const sizeCell   = tr.querySelector(".size-cell");

          // Update size when available; also persist to cache
          const newSize = pickSize(data);
          if (newSize != null) {
            cache.setSize(id, newSize);
            if (sizeCell && sizeCell.dataset.size !== String(newSize)) {
              sizeCell.dataset.size = String(newSize);
              sizeCell.textContent  = fmtBytes(newSize);
            }
          }

          if (data.status === "SUCCESS") {
            statusCell.innerHTML = statusBadge("SUCCESS");
            actionCell.innerHTML = actionHtmlFor(id, "SUCCESS");
            clearInterval(iv);
            polling.delete(id);
          } else if (data.status === "FAILED") {
            statusCell.innerHTML = statusBadge("FAILED");
            actionCell.innerHTML = actionHtmlFor(id, "FAILED", data.error);
            if (data.error) flash(data.error, "danger");
            clearInterval(iv);
            polling.delete(id);
          } else {
            statusCell.innerHTML = statusBadge(data.status || "PENDING");
            actionCell.innerHTML = actionHtmlFor(id, "PENDING");
          }
        } catch (e) {
          console.error("poll error", e);
        }
      }, 1200);
      polling.set(id, iv);
    };

    const stopAll = () => {
      polling.forEach(clearInterval);
      polling.clear();
    };

    window.addEventListener("beforeunload", stopAll);
    return { start, stopAll };
  }

  async function loadMyJobs(tbody, poller) {
    try {
      const jobs = await listJobs(50);
      tbody.innerHTML = jobs.map((j) => {
        // seed cache with any size the list DID provide
        const s = pickSize(j);
        if (s != null) cache.setSize(j.id, s);

        return rowTpl({
          id: j.id,
          filename: j.filename,
          size: s,       // if null, rowTpl will fallback to cache (from enqueue)
          status: j.status,
          error: j.error || null,
        });
      }).join("");

      jobs.forEach((j) => {
        if (j.status !== "SUCCESS" && j.status !== "FAILED") poller.start(j.id);
      });

      // Optional: one-time detail fetch to fill missing sizes immediately on reload
      const missing = jobs.filter(j => j.status !== "FAILED" && !pickSize(j) && !cache.getSize(j.id));
      for (const j of missing) {
        try {
          const d = await getJob(j.id);
          const s2 = pickSize(d);
          if (s2 != null) {
            cache.setSize(j.id, s2);
            const tr = tbody.querySelector(`tr[data-id="${j.id}"]`);
            const sizeCell = tr?.querySelector(".size-cell");
            if (sizeCell) { sizeCell.dataset.size = String(s2); sizeCell.textContent = fmtBytes(s2); }
          }
        } catch {}
      }
    } catch (e) {
      console.error("loadMyJobs error", e);
    }
  }

  (function ensureStyles() {
    const id = "__ub_table_styles__";
    if (document.getElementById(id)) return;
    const st = document.createElement("style");
    st.id = id;
    st.textContent = `
      td.action-cell { text-align: center; }
      .action-row {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: .5rem;
      }
    `;
    document.head.appendChild(st);
  })();

  UB.table = { createRenderer, createPoller, loadMyJobs, statusBadge, actionHtmlFor, openJobModal };
})();
