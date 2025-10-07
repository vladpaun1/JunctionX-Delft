// UB API calls (network only)
(function () {
  const UB = (window.UB = window.UB || {});
  const { getCSRF } = UB.dom;

  const listJobs = async (limit = 50) => {
    const res = await fetch(`/api/jobs/?limit=${limit}`, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data.jobs) ? data.jobs : [];
  };

  const createJobs = async (files) => {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f, f.name));
    const res = await fetch('/api/jobs/', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRFToken': getCSRF() },
      body: fd,
    });
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : { detail: (await res.text()).slice(0, 1000) };
    if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
    return Array.isArray(data.jobs) ? data.jobs : [];
  };

  const getJob = async (id) => {
    const r = await fetch(`/api/jobs/${id}/`, { credentials: 'same-origin' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  };

  const getJobData = async (id) => {
    const r = await fetch(`/api/jobs/${id}/data/`, { credentials: 'same-origin' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  };

  const deleteJob = async (id) => {
    const r = await fetch(`/api/jobs/${id}/`, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'X-CSRFToken': getCSRF() },
    });
    if (r.status !== 204) {
      const data = await r.json().catch(() => ({}));
      throw new Error(data.detail || `Failed to delete (HTTP ${r.status})`);
    }
  };

  UB.api = { listJobs, createJobs, getJob, getJobData, deleteJob };
})();
