// UB bulk helpers (copy/export all)
(function () {
  const UB = (window.UB = window.UB || {});
  const { pretty, copyToClipboard, downloadBlob, isoStamp, flash } = UB.dom;
  const { listJobs, getJobData } = UB.api;

  // fetch payloads for SUCCESS jobs
  const fetchAllSuccessPayloads = async () => {
    const jobs = await listJobs(200);
    const okJobs = jobs.filter((j) => j.status === 'SUCCESS');
    if (!okJobs.length) return [];
    const results = [];
    for (const j of okJobs) {
      try {
        const payload = await getJobData(j.id);
        results.push(payload);
      } catch {
        // ignore per-item failures
      }
    }
    return results;
  };

  const withBusy = async (btn, fn, busyLabel = 'Working…') => {
    const spinner = btn.querySelector('.spinner-border');
    const labelEl = btn.querySelector('.btn-label');
    const original = labelEl ? labelEl.textContent : '';
    btn.disabled = true;
    if (spinner) spinner.classList.remove('d-none');
    if (labelEl) labelEl.textContent = busyLabel;
    try {
      return await fn();
    } finally {
      if (spinner) spinner.classList.add('d-none');
      if (labelEl) labelEl.textContent = original;
      btn.disabled = false;
    }
  };

  const doCopyAll = async () => {
    const payloads = await fetchAllSuccessPayloads();
    if (!payloads.length) {
      flash('No finished jobs to copy.', 'info', 2500);
      return;
    }
    const ok = await copyToClipboard(pretty(payloads));
    if (ok) flash(`Copied ${payloads.length} item(s) to clipboard.`, 'info', 2500);
    else flash('Copy to clipboard failed.', 'danger');
  };

  const doExportAll = async () => {
    const payloads = await fetchAllSuccessPayloads();
    if (!payloads.length) {
      flash('No finished jobs to export.', 'info', 2500);
      return;
    }
    const fname = `session-transcripts-${isoStamp()}.json`;
    downloadBlob(fname, pretty(payloads));
    flash(`Exported ${payloads.length} item(s) as ${fname}.`, 'info', 3000);
  };

  UB.bulk = { withBusy, doCopyAll, doExportAll };
})();
