// static/js/upload_bulk.js (full file)
(function () {
  const form       = document.getElementById('bulk-form');
  const enqueueBtn = document.getElementById('enqueue-btn');
  const btnSpin    = document.getElementById('btn-spinner');
  const btnText    = enqueueBtn?.querySelector('.btn-text');
  const errorEl    = document.getElementById('error');
  const overlay    = document.getElementById('overlay');

  const filesInput = document.getElementById('files');
  const clearBtn   = document.getElementById('clear-files');
  const tbody      = document.getElementById('jobs-body');

  if (!form) return;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  // Get CSRF token
  const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return '';
  };
  const getCSRF = () =>
    (window.getCSRFToken && window.getCSRFToken()) ||
    getCookie('csrftoken') ||
    '';

  const escapeHtml = (s) =>
    String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

  const fmtBytes = (n) => {
    if (typeof n !== 'number' || !isFinite(n)) return '';
    const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
    let u = 0, v = n;
    while (v >= 1024 && u < units.length - 1) {
      v /= 1024;
      u++;
    }
    return `${v.toFixed(v < 10 && u > 0 ? 2 : 1)} ${units[u]}`;
  };

  const setUploading = (v) => {
    if (!enqueueBtn) return;
    enqueueBtn.disabled = v;
    if (btnSpin) btnSpin.classList.toggle('d-none', !v);
    if (btnText) btnText.textContent = v ? 'Uploading…' : 'Analyze selected';
    if (overlay) overlay.style.display = v ? 'flex' : 'none';
  };

  const showError = (msg) => {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.classList.remove('d-none');
  };
  const hideError = () => errorEl && errorEl.classList.add('d-none');

  // ---------------------------------------------------------------------------
  // Table rendering
  // ---------------------------------------------------------------------------

  const actionHtmlFor = (id, status, error) => {
    if (status === 'SUCCESS') {
      return `
        <div class="d-flex gap-2 justify-content-end">
          <a class="btn btn-sm btn-outline-primary" href="/job/${id}/">See details</a>
          <button class="btn btn-sm btn-outline-secondary btn-delete" data-id="${id}">Delete</button>
        </div>`;
    }
    if (status === 'FAILED') {
      return `
        <div class="d-flex gap-2 justify-content-end">
          <button class="btn btn-sm btn-outline-danger" disabled>Failed</button>
          <button class="btn btn-sm btn-outline-secondary btn-delete" data-id="${id}">Delete</button>
        </div>`;
    }
    return `<span class="spinner-border" role="status" aria-hidden="true"></span>`;
  };

  const rowTpl = ({ id, filename, size, status, error }) => {
    const statusLabel = error
      ? 'FAILED'
      : status === 'SUCCESS'
      ? 'SUCCESS'
      : status === 'FAILED'
      ? 'FAILED'
      : status || 'QUEUED';

    const statusHtml =
      statusLabel === 'SUCCESS'
        ? `<span class="badge bg-success">SUCCESS</span>`
        : statusLabel === 'FAILED'
        ? `<span class="badge bg-danger">FAILED</span>`
        : `<span class="badge bg-secondary">${escapeHtml(statusLabel)}</span>`;

    const infoHtml = error
      ? `<span class="text-danger small">${escapeHtml(error)}</span>`
      : '';

    return `
      <tr data-id="${id}">
        <td>${escapeHtml(filename || '')}</td>
        <td>${size != null ? fmtBytes(size) : ''}</td>
        <td class="status">${statusHtml}</td>
        <td class="info">${infoHtml}</td>
        <td class="text-end action">${actionHtmlFor(id, statusLabel, error)}</td>
      </tr>
    `;
  };

  const upsertRow = (job) => {
    const existing = tbody.querySelector(`tr[data-id="${job.id}"]`);
    const html = rowTpl(job);
    const tmp = document.createElement('tbody');
    tmp.innerHTML = html.trim();
    if (existing) {
      tbody.replaceChild(tmp.firstElementChild, existing);
    } else {
      tbody.prepend(tmp.firstElementChild);
    }
  };

  // ---------------------------------------------------------------------------
  // Polling
  // ---------------------------------------------------------------------------

  const polling = new Map(); // job_id -> intervalId

  const startPolling = (id) => {
    if (polling.has(id)) return;

    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${id}/`, { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const tr = tbody.querySelector(`tr[data-id="${id}"]`);
        if (!tr) return;

        const statusCell = tr.querySelector('.status');
        const actionCell = tr.querySelector('.action');
        const infoCell = tr.querySelector('.info');

        if (data.status === 'SUCCESS') {
          statusCell.innerHTML = `<span class="badge bg-success">SUCCESS</span>`;
          actionCell.innerHTML = `
            <div class="d-flex gap-2 justify-content-end">
              <a class="btn btn-sm btn-outline-primary" href="${data.detail_url}">See details</a>
              <button class="btn btn-sm btn-outline-secondary btn-delete" data-id="${id}">Delete</button>
            </div>`;
          infoCell.textContent = '';
          clearInterval(iv);
          polling.delete(id);
        } else if (data.status === 'FAILED') {
          statusCell.innerHTML = `<span class="badge bg-danger">FAILED</span>`;
          actionCell.innerHTML = `
            <div class="d-flex gap-2 justify-content-end">
              <button class="btn btn-sm btn-outline-danger" disabled>Failed</button>
              <button class="btn btn-sm btn-outline-secondary btn-delete" data-id="${id}">Delete</button>
            </div>`;
          infoCell.innerHTML = data.error
            ? `<span class="text-danger small">${escapeHtml(data.error)}</span>`
            : '';
          clearInterval(iv);
          polling.delete(id);
        } else {
          statusCell.innerHTML = `<span class="badge bg-secondary">${escapeHtml(
            data.status || 'PENDING'
          )}</span>`;
          actionCell.innerHTML =
            `<span class="spinner-border" role="status" aria-hidden="true"></span>`;
        }
      } catch (e) {
        console.error('poll error', e);
        // keep polling
      }
    }, 1200);

    polling.set(id, iv);
  };

  const stopAllPolling = () => {
    polling.forEach((iv) => clearInterval(iv));
    polling.clear();
  };
  window.addEventListener('beforeunload', stopAllPolling);

  // ---------------------------------------------------------------------------
  // Enqueue uploads
  // ---------------------------------------------------------------------------

  const enqueue = async () => {
    const files = Array.from(filesInput.files || []);
    if (!files.length) {
      showError('Please choose one or more audio/video files.');
      return;
    }
    hideError();

    const fd = new FormData();
    files.forEach((f) => fd.append('files', f, f.name));

    setUploading(true);
    try {
      const res = await fetch('/api/jobs/', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRFToken': getCSRF() },
        body: fd,
      });

      let data;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = { detail: text.slice(0, 1000) };
      }

      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);

      (data.jobs || []).forEach((j) => {
        const jobView = {
          id: j.id || crypto.randomUUID(),
          filename: j.filename,   // original name from server
          size: j.size,
          status: j.error ? 'FAILED' : 'PENDING',
          error: j.error || null,
        };
        upsertRow(jobView);
        if (!j.error && j.id) startPolling(j.id);
      });

      if (!data.jobs || !data.jobs.length) {
        showError('No files were accepted by the server.');
      }
    } catch (err) {
      console.error('[enqueue] error', err);
      showError(err?.message || 'Unexpected error');
    } finally {
      setUploading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Load existing jobs on page load
  // ---------------------------------------------------------------------------

  const loadMyJobs = async () => {
    try {
      const res = await fetch('/api/jobs/?limit=50', { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      (data.jobs || []).forEach((j) => {
        const jobView = {
          id: j.id,
          filename: j.filename,   // original name from API list
          size: j.size,
          status: j.status,
          error: j.error || null,
        };
        upsertRow(jobView);
        if (j.status !== 'SUCCESS' && j.status !== 'FAILED') startPolling(j.id);
      });
    } catch (e) {
      console.error('loadMyJobs error', e);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadMyJobs);
  } else {
    loadMyJobs();
  }

  // ---------------------------------------------------------------------------
  // Event bindings
  // ---------------------------------------------------------------------------

  enqueueBtn?.addEventListener('click', enqueue);
  form.addEventListener('submit', (e) => e.preventDefault());

  clearBtn.addEventListener('click', () => {
    filesInput.value = '';
    tbody.innerHTML = '';
    stopAllPolling();
  });

  // Delete job (and files) via API
  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-delete');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (!id) return;

    if (!confirm('Delete this job and its files?')) return;

    try {
      const res = await fetch(`/api/jobs/${id}/`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'X-CSRFToken': getCSRF() },
      });
      if (res.status === 204) {
        const tr = tbody.querySelector(`tr[data-id="${id}"]`);
        tr && tr.remove();
      } else {
        const data = await res.json().catch(() => ({}));
        showError(data.detail || `Failed to delete (HTTP ${res.status})`);
      }
    } catch (err) {
      console.error('delete error', err);
      showError(err?.message || 'Delete failed');
    }
  });
})();
