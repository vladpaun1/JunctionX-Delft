// UB table rendering + polling
(function () {
  const UB = (window.UB = window.UB || {});
  const { escapeHtml, fmtBytes, flash } = UB.dom;
  const { listJobs, getJob } = UB.api;
  const { openJobModal } = UB.modal;

  // status + row ui
  const statusBadge = (label) => {
    if (label === 'SUCCESS') return `<span class="badge bg-success">SUCCESS</span>`;
    if (label === 'FAILED') return `<span class="badge bg-danger">FAILED</span>`;
    if (label === 'RUNNING') return `<span class="badge bg-secondary">RUNNING</span>`;
    return `<span class="badge text-bg-secondary">${escapeHtml(label || 'PENDING')}</span>`;
  };

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
    return `
      <div class="action-row">
        <button class="btn btn-outline-primary btn-sm btn-view" data-id="${id}">Details</button>
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
      </div>`;
  };

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
        <td class="text-end action">${actionHtmlFor(id, lab, error)}</td>
      </tr>`;
  };

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
          const actionCell = tr.querySelector('.action');

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

  async function loadMyJobs(tbody, poller) {
    try {
      const jobs = await listJobs(50); // API returns newest→oldest
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

  UB.table = { createRenderer, createPoller, loadMyJobs, statusBadge, actionHtmlFor, openJobModal };
})();
