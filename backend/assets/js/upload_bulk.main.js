// Page glue: wires DOM, events, and uses UB modules
(function () {
  const UB = (window.UB = window.UB || {});
  const { flash } = UB.dom;
  const { createJobs } = UB.api;
  const { createRenderer, createPoller, loadMyJobs, openJobModal } = UB.table;
  const { withBusy, doCopyAll, doExportAll } = UB.bulk;

  const form = document.getElementById('bulk-form');
  if (!form) return;

  const enqueueBtn = document.getElementById('enqueue-btn');
  const errorEl = document.getElementById('error');
  const filesInput = document.getElementById('files');
  const clearBtn = document.getElementById('clear-files');
  const tbody = document.getElementById('jobs-body');

  const copyAllBtn = document.getElementById('copy-all-json');
  const exportAllBtn = document.getElementById('export-all-json');

  const renderer = createRenderer(tbody);
  const poller = createPoller(tbody);

  const showError = (m) => {
    if (!errorEl) return;
    errorEl.textContent = m;
    errorEl.classList.remove('d-none');
  };
  const hideError = () => errorEl && errorEl.classList.add('d-none');

  const setUploading = (v) => {
    enqueueBtn.disabled = v;
    const btnSpin = document.getElementById('btn-spinner');
    btnSpin?.classList.toggle('d-none', !v);
    const btnText = enqueueBtn?.querySelector('.btn-label');
    if (btnText) btnText.textContent = v ? 'Uploading…' : 'Analyze selected';
  };

    async function enqueue() {
    const files = Array.from(filesInput.files || []);
    if (!files.length) {
        showError('Please choose one or more audio/video files.');
        return;
    }
    hideError();
    setUploading(true);

    // map filename -> size (bytes) for a best-effort match
    const fileSizeByName = new Map(files.map(f => [f.name, f.size]));

    try {
        const created = await createJobs(files);

        created.forEach((j) => {
        // Prefer backend size; otherwise fall back to the chosen File size
        const backendSize =
            (j && (j.size ?? j.src_size ?? j.file_size ?? j.src_bytes)) ?? null;
        const fallbackSize = fileSizeByName.get(j.filename) ?? null;
        const chosenSize = backendSize ?? fallbackSize ?? null;

        if (chosenSize && window.UB?.cache) {
            UB.cache.setSize(j.id, chosenSize);
        }

        const jobView = {
            id: j.id || crypto.randomUUID(),
            filename: j.filename,
            size: chosenSize,            // pass what we know now
            status: j.error ? 'FAILED' : 'PENDING',
            error: j.error || null,
        };
        renderer.upsertRow(jobView);
        if (j.error) flash(`${j.filename || 'File'}: ${j.error}`, 'danger');
        if (!j.error && j.id) poller.start(j.id);
        });

        if (!created.length) showError('No files were accepted by the server.');
    } catch (err) {
        console.error('[enqueue] error', err);
        showError(err?.message || 'Unexpected error');
    } finally {
        setUploading(false);
    }
    }


  // initial load
  const go = () => loadMyJobs(tbody, poller);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', go) : go();

  // events
  enqueueBtn.addEventListener('click', enqueue);
  form.addEventListener('submit', (e) => e.preventDefault());
  clearBtn.addEventListener('click', () => {
    filesInput.value = '';
    filesInput.dispatchEvent(new Event('change'));
    flash('Selection cleared.', 'info', 2000);
  });

  if (copyAllBtn) {
    copyAllBtn.addEventListener('click', () => withBusy(copyAllBtn, doCopyAll, 'Collecting…'));
  }
  if (exportAllBtn) {
    exportAllBtn.addEventListener('click', () => withBusy(exportAllBtn, doExportAll, 'Collecting…'));
  }

  // table click delegation
  tbody.addEventListener('click', async (e) => {
    const viewBtn = e.target.closest('.btn-view');
    if (viewBtn) {
      const id = viewBtn.getAttribute('data-id');
      if (id) UB.modal.openJobModal(id) || openJobModal(id);
      return;
    }

    const delBtn = e.target.closest('.btn-delete');
    if (delBtn) {
      const id = delBtn.getAttribute('data-id');
      if (!id) return;
      try {
        await UB.api.deleteJob(id);
        tbody.querySelector(`tr[data-id="${id}"]`)?.remove();
        flash('Job deleted.', 'info', 2500);
      } catch (err) {
        console.error('delete error', err);
        showError(err?.message || 'Delete failed');
      }
      return;
    }

    const copyBtn = e.target.closest('.btn-copy-json');
    if (copyBtn) {
      const id = copyBtn.getAttribute('data-id');
      if (!id) return;
      copyBtn.disabled = true;
      const old = copyBtn.textContent;
      try {
        const payload = await UB.api.getJobData(id);
        const ok = await UB.dom.copyToClipboard(UB.dom.pretty(payload));
        copyBtn.textContent = ok ? 'Copied!' : 'Copy failed';
      } catch (err) {
        console.error('copy error', err);
        copyBtn.textContent = 'Copy failed';
      } finally {
        setTimeout(() => (copyBtn.textContent = old), 1200);
        copyBtn.disabled = false;
      }
    }
  });
})();
