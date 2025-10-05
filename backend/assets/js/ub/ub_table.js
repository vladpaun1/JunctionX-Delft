// UB table rendering + polling (centered Action column; spinner only while pending)
(function () {
  const UB = (window.UB = window.UB || {});

  // --- safe access to other modules (prevents crash if order is off) ---
  const dom   = UB.dom   || {};
  const api   = UB.api   || {};
  const modal = UB.modal || {};

  const escapeHtml = dom.escapeHtml || ((x) => String(x));
  const fmtBytes   = dom.fmtBytes   || (() => '—');
  const flash      = dom.flash      || ((...args) => console.log('[flash]', ...args));

  const listJobs     = api.listJobs || (async () => []);
  const getJob       = api.getJob   || (async () => ({}));
  const openJobModal = (modal && modal.openJobModal) ? modal.openJobModal : (() => {});

  // --- status badge ---
  const statusBadge = (label) => {
    if (label === 'SUCCESS') return `<span class="badge bg-success">SUCCESS</span>`;
    if (label === 'FAILED')  return `<span class="badge bg-danger">FAILED</span>`;
    if (label === 'RUNNING') return `<span class="badge bg-secondary">RUNNING</span>`;
    return `<span class="badge text-bg-secondary">${escapeHtml(label || 'PENDING')}</span>`;
  };

  // --- action row HTML ---
  // SUCCESS: full button set
  // FAILED : failed + delete
  // PENDING/RUNNING: spinner ONLY (no Details button)
  const actionHtmlFor = (id, status, err) => {
    if (status === 'SUCCESS') {
      return `
        <div class="action-row">
          <button class="btn btn-outline-primary btn-sm btn-view" data-id="${id}">Details</button>
          <button class="btn btn-outline-secondary btn-sm btn-copy-json" data-id="${id}">Copy JSON</button>
          <a class="btn btn-outline-secondary btn-sm" href="/api/jobs/${id}/export/" download>Export JSON</a>
          <button class="btn btn-outline-danger btn-sm btn-delete" data-id="${id}">Delete</button>
        </div>`;
    }
    if (status === 'FAILED') {
      return `
        <div class="action-row">
          <button class="btn btn-outline-danger btn-sm" disabled>Failed</button>
          <button class="btn btn-outline-secondary btn-sm btn-delete" data-id="${id}">Delete</button>
        </div>`;
    }
    // Pending / Running: spinner only
    return `
      <div class="action-row">
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
      </div>`;
  };

  // --- table row template (center the Action column) ---
  const rowTpl = ({ id, filename, size, status, error }) => {
    const lab = error
      ? 'FAILED'
      : status === 'SUCCESS'
      ? 'SUCCESS'
      : status === 'FAILED'
      ? 'FAILED'
      : status || 'PENDING';

    if (error) flash(error, 'danger');

    return `
      <tr data-id="${id}">
        <td>${escapeHtml(filename || '')}</td>
        <td>${fmtBytes(size)}</td>
        <td class="status">${statusBadge(lab)}</td>
        <td class="action-cell">${actionHtmlFor(id, lab, error)}</td>
      </tr>`;
  };

  // --- public: renderer (insert/replace rows) ---
  function createRenderer(tbody) {
    const upsertRow = (job) => {
      const existing = tbody.querySelector(`tr[data-id="${job.id}"]`);
      const tmp = document.createElement('tbody');
      tmp.innerHTML = rowTpl(job).trim();
      const fresh = tmp.firstElementChild;
      if (existing) tbody.replaceChild(fresh, existing);
      else tbody.prepend(fresh);
    };
    return { upsertRow };
  }

  // --- public: poller (keeps statuses fresh) ---
  function createPoller(tbody) {
    const polling = new Map();

    const start = (id) => {
      if (polling.has(id)) return;
      const iv = setInterval(async () => {
        try {
          const data = await getJob(id);
          const tr = tbody.querySelector(`tr[data-id="${id}"]`);
          if (!tr) return;

          const statusCell = tr.querySelector('.status');
          const actionCell = tr.querySelector('.action-cell');

          if (data.status === 'SUCCESS') {
            statusCell.innerHTML = statusBadge('SUCCESS');
            actionCell.innerHTML = actionHtmlFor(id, 'SUCCESS');
            clearInterval(iv);
            polling.delete(id);
          } else if (data.status === 'FAILED') {
            statusCell.innerHTML = statusBadge('FAILED');
            actionCell.innerHTML = actionHtmlFor(id, 'FAILED', data.error);
            if (data.error) flash(data.error, 'danger');
            clearInterval(iv);
            polling.delete(id);
          } else {
            // Pending/Running — spinner only
            statusCell.innerHTML = statusBadge(data.status || 'PENDING');
            actionCell.innerHTML = actionHtmlFor(id, 'PENDING');
          }
        } catch (e) {
          console.error('poll error', e);
        }
      }, 1200);
      polling.set(id, iv);
    };

    const stopAll = () => {
      polling.forEach(clearInterval);
      polling.clear();
    };

    window.addEventListener('beforeunload', stopAll);
    return { start, stopAll };
  }

  // --- public: initial load (API returns newest → oldest already) ---
  async function loadMyJobs(tbody, poller) {
    try {
      const jobs = await listJobs(50);
      tbody.innerHTML = jobs
        .map((j) =>
          rowTpl({
            id: j.id,
            filename: j.filename,
            size: j.size,
            status: j.status,
            error: j.error || null,
          })
        )
        .join('');

      jobs.forEach((j) => {
        if (j.status !== 'SUCCESS' && j.status !== 'FAILED') poller.start(j.id);
      });
    } catch (e) {
      console.error('loadMyJobs error', e);
    }
  }

  // --- minimal CSS (center Action column) ---
  (function ensureStyles() {
    const id = '__ub_table_styles__';
    if (document.getElementById(id)) return;
    const st = document.createElement('style');
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

  // export
  UB.table = { createRenderer, createPoller, loadMyJobs, statusBadge, actionHtmlFor, openJobModal };
})();
