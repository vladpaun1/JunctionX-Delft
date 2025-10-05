// Rebuilt but API-compatible with your endpoints.
(function () {
  const form       = document.getElementById('bulk-form');
  if (!form) return;

  const enqueueBtn = document.getElementById('enqueue-btn');
  const btnSpin    = document.getElementById('btn-spinner');
  const btnText    = enqueueBtn?.querySelector('.btn-label'); // <- class matches HTML
  const errorEl    = document.getElementById('error');

  const filesInput = document.getElementById('files');
  const clearBtn   = document.getElementById('clear-files');
  const tbody      = document.getElementById('jobs-body');

  // ---------- Toasts ----------
  let toastArea = document.getElementById('toast-area');
  if (!toastArea){
    toastArea = document.createElement('div');
    toastArea.id = 'toast-area';
    toastArea.className = 'toast-area';
    // Anchor to bottom-right regardless of page CSS
    Object.assign(toastArea.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      top: 'auto',
      left: 'auto',
      zIndex: '1060',           // above most content
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      pointerEvents: 'none',    // clicks pass through except buttons we re-enable
    });
    document.body.appendChild(toastArea);
  }

  const escapeHtml = (s)=> String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');

  const flash = (msg, kind='danger', ms=4000) => {
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    el.innerHTML = `<span>${escapeHtml(msg)}</span><button aria-label="Dismiss">✕</button>`;
    // Allow the close button to capture clicks
    el.style.pointerEvents = 'auto';
    const close = () => el.remove();
    el.querySelector('button').addEventListener('click', close);
    toastArea.appendChild(el);
    setTimeout(close, ms);
  };

  // ---------- Helpers ----------
  const getCookie=(n)=>{ const v=`; ${document.cookie}`; const p=v.split(`; ${n}=`); return p.length===2?p.pop().split(';').shift():''; };
  const getCSRF = () => (window.getCSRFToken && window.getCSRFToken()) || getCookie('csrftoken') || '';

  const fmtBytes = (n) => {
    const x = Number(n||0);
    const u = ['bytes','KB','MB','GB','TB'];
    let i=0, v=x;
    while (v>=1024 && i<u.length-1){ v/=1024; i++; }
    return `${v.toFixed(v<10&&i>0?2:1)} ${u[i]}`;
  };

  const showError=(m)=>{ errorEl.textContent=m; errorEl.classList.remove('d-none'); };
  const hideError=()=> errorEl.classList.add('d-none');

  const setUploading = (v)=>{
    enqueueBtn.disabled = v;
    btnSpin?.classList.toggle('d-none', !v);
    if (btnText) btnText.textContent = v ? 'Uploading…' : 'Analyze selected';
  };

  const pretty = (obj)=> JSON.stringify(obj, null, 2);
  const copyToClipboard = async (text)=>{
    try{ await navigator.clipboard.writeText(text); return true; }
    catch{
      const ta=document.createElement('textarea');
      ta.value=text; document.body.appendChild(ta); ta.select();
      const ok=document.execCommand('copy'); ta.remove(); return ok;
    }
  };

  // ---------- Row rendering ----------
  const actionHtmlFor = (id, status, err) => {
    if (status === 'SUCCESS'){
      return `
        <div class="action-row">
          <a class="btn btn-outline-primary btn-sm" href="/job/${id}/">See details</a>
          <button class="btn btn-outline-secondary btn-sm btn-copy-json" data-id="${id}">Copy JSON</button>
          <a class="btn btn-outline-dark btn-sm" href="/api/jobs/${id}/export/" download>Export JSON</a>
          <button class="btn btn-outline-secondary btn-sm btn-delete" data-id="${id}">Delete</button>
        </div>`;
    }
    if (status === 'FAILED'){
      return `
        <div class="action-row">
          <button class="btn btn-outline-danger btn-sm" disabled>Failed</button>
          <button class="btn btn-outline-secondary btn-sm btn-delete" data-id="${id}">Delete</button>
        </div>`;
    }
    // Pending: reserve space via the same container; show spinner inside
    return `
      <div class="action-row">
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
      </div>`;
  };

  const statusBadge = (label)=>{
    if (label==='SUCCESS') return `<span class="badge bg-success">SUCCESS</span>`;
    if (label==='FAILED')  return `<span class="badge bg-danger">FAILED</span>`;
    return `<span class="badge text-bg-secondary">${escapeHtml(label||'PENDING')}</span>`;
  };

  const rowTpl = ({id, filename, size, status, error})=>{
    const lab = error ? 'FAILED'
      : status === 'SUCCESS' ? 'SUCCESS'
      : status === 'FAILED'  ? 'FAILED'
      : status || 'PENDING';

    if (error) flash(error, 'danger');

    return `
      <tr data-id="${id}">
        <td>${escapeHtml(filename||'')}</td>
        <td>${size!=null ? fmtBytes(size) : ''}</td>
        <td class="status">${statusBadge(lab)}</td>
        <td class="text-end action">${actionHtmlFor(id, lab, error)}</td>
      </tr>`;
  };

  const upsertRow = (job)=>{
    const existing = tbody.querySelector(`tr[data-id="${job.id}"]`);
    const tmp = document.createElement('tbody');
    tmp.innerHTML = rowTpl(job).trim();
    const fresh = tmp.firstElementChild;
    if (existing) tbody.replaceChild(fresh, existing);
    else tbody.prepend(fresh);
  };

  // ---------- Polling ----------
  const polling = new Map();

  const startPolling = (id)=>{
    if (polling.has(id)) return;

    const iv = setInterval(async ()=>{
      try{
        const res = await fetch(`/api/jobs/${id}/`, { credentials:'same-origin' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const tr = tbody.querySelector(`tr[data-id="${id}"]`);
        if (!tr) return;

        const statusCell = tr.querySelector('.status');
        const actionCell = tr.querySelector('.action');

        if (data.status === 'SUCCESS'){
          statusCell.innerHTML = statusBadge('SUCCESS');
          actionCell.innerHTML = actionHtmlFor(id,'SUCCESS');
          clearInterval(iv); polling.delete(id);
        } else if (data.status === 'FAILED'){
          statusCell.innerHTML = statusBadge('FAILED');
          actionCell.innerHTML = actionHtmlFor(id,'FAILED', data.error);
          if (data.error) flash(data.error,'danger');
          clearInterval(iv); polling.delete(id);
        } else {
          statusCell.innerHTML = statusBadge(data.status || 'PENDING');
          actionCell.innerHTML = actionHtmlFor(id,'PENDING');
        }
      }catch(e){
        console.error('poll error', e);
      }
    }, 1200);

    polling.set(id, iv);
  };

  const stopAllPolling = ()=>{
    polling.forEach(clearInterval);
    polling.clear();
  };
  window.addEventListener('beforeunload', stopAllPolling);

  // ---------- Load existing ----------
  const loadMyJobs = async ()=>{
    try{
      const res = await fetch('/api/jobs/?limit=50', { credentials:'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      (data.jobs || []).forEach((j)=>{
        upsertRow({
          id: j.id, filename: j.filename, size: j.size,
          status: j.status, error: j.error || null
        });
        if (j.status!=='SUCCESS' && j.status!=='FAILED') startPolling(j.id);
      });
    }catch(e){ console.error('loadMyJobs error', e); }
  };
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', loadMyJobs)
    : loadMyJobs();

  // ---------- Enqueue ----------
  const enqueue = async ()=>{
    const files = Array.from(filesInput.files || []);
    if (!files.length){ showError('Please choose one or more audio/video files.'); return; }
    hideError();

    const fd = new FormData();
    files.forEach((f)=> fd.append('files', f, f.name));

    setUploading(true);
    try{
      const res = await fetch('/api/jobs/', {
        method:'POST', credentials:'same-origin',
        headers:{ 'X-CSRFToken': getCSRF() }, body: fd
      });

      const ct = res.headers.get('content-type')||'';
      const data = ct.includes('application/json') ? await res.json()
                   : { detail: (await res.text()).slice(0,1000) };

      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);

      (data.jobs || []).forEach((j)=>{
        const jobView = {
          id: j.id || crypto.randomUUID(),
          filename: j.filename,
          size: j.size,
          status: j.error ? 'FAILED' : 'PENDING',
          error: j.error || null,
        };
        upsertRow(jobView);
        if (j.error) flash(`${j.filename || 'File'}: ${j.error}`,'danger');
        if (!j.error && j.id) startPolling(j.id);
      });

      if (!data.jobs?.length) showError('No files were accepted by the server.');
    }catch(err){
      console.error('[enqueue] error', err);
      showError(err?.message || 'Unexpected error');
    }finally{
      setUploading(false);
    }
  };

  // ---------- Events ----------
  enqueueBtn.addEventListener('click', enqueue);
  form.addEventListener('submit', (e)=> e.preventDefault());
  clearBtn.addEventListener('click', ()=>{
    filesInput.value='';
    tbody.innerHTML='';
    stopAllPolling();
    flash('Selection cleared.', 'info', 2500); // bottom-right toast
  });

  tbody.addEventListener('click', async (e)=>{
    // DELETE
    const delBtn = e.target.closest('.btn-delete');
    if (delBtn){
      const id = delBtn.getAttribute('data-id'); if (!id) return;
      if (!confirm('Delete this job and its files?')) return;
      try{
        const res = await fetch(`/api/jobs/${id}/`, {
          method:'DELETE', credentials:'same-origin',
          headers:{ 'X-CSRFToken': getCSRF() },
        });
        if (res.status === 204){
          tbody.querySelector(`tr[data-id="${id}"]`)?.remove();
          flash('Job deleted.', 'info', 2500); // also bottom-right
        }else{
          const data = await res.json().catch(()=>({}));
          showError(data.detail || `Failed to delete (HTTP ${res.status})`);
        }
      }catch(err){
        console.error('delete error', err);
        showError(err?.message || 'Delete failed');
      }
      return;
    }

    // COPY JSON
    const copyBtn = e.target.closest('.btn-copy-json');
    if (copyBtn){
      const id = copyBtn.getAttribute('data-id'); if (!id) return;
      copyBtn.disabled = true;
      const old = copyBtn.textContent;
      try{
        const res = await fetch(`/api/jobs/${id}/data/`, { credentials:'same-origin' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        const ok = await copyToClipboard(pretty(payload));
        copyBtn.textContent = ok ? 'Copied!' : 'Copy failed';
      }catch(err){
        console.error('copy error', err);
        copyBtn.textContent = 'Copy failed';
      }finally{
        setTimeout(()=> (copyBtn.textContent = old), 1200);
        copyBtn.disabled = false;
      }
    }
  });
})();
