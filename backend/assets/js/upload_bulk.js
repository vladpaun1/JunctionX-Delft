// upload_bulk.js
// Full rewrite: modal details + labels + gutter + bulk JSON actions.
(function () {
  const form       = document.getElementById('bulk-form');
  if (!form) return;

  const enqueueBtn = document.getElementById('enqueue-btn');
  const btnSpin    = document.getElementById('btn-spinner');
  const btnText    = enqueueBtn?.querySelector('.btn-label');
  const errorEl    = document.getElementById('error');

  const filesInput = document.getElementById('files');
  const clearBtn   = document.getElementById('clear-files');
  const tbody      = document.getElementById('jobs-body');

  // NEW: bulk buttons
  const copyAllBtn   = document.getElementById('copy-all-json');
  const exportAllBtn = document.getElementById('export-all-json');

  /* ---------------- Toasts ---------------- */
  let toastArea = document.getElementById('toast-area');
  if (!toastArea){
    toastArea = document.createElement('div');
    toastArea.id = 'toast-area';
    toastArea.className = 'toast-area';
    Object.assign(toastArea.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      zIndex: '1060',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      pointerEvents: 'none',
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
    el.style.pointerEvents = 'auto';
    const close = () => el.remove();
    el.querySelector('button').addEventListener('click', close);
    toastArea.appendChild(el);
    setTimeout(close, ms);
  };

  /* ---------------- Helpers ---------------- */
  const getCookie=(n)=>{ const v=`; ${document.cookie}`; const p=v.split(`; ${n}=`); return p.length===2?p.pop().split(';').shift():''; };
  const getCSRF = () => (window.getCSRFToken && window.getCSRFToken()) || getCookie('csrftoken') || '';

  const fmtBytes = (n) => {
    const x = Number(n||0);
    if (!isFinite(x) || x <= 0) return '—';
    const u = ['bytes','KB','MB','GB','TB'];
    let i=0,v=x; while(v>=1024 && i<u.length-1){ v/=1024; i++; }
    return `${v.toFixed(v<10&&i>0?2:1)} ${u[i]}`;
  };

  const mmss = (v) => {
    if (v === null || v === undefined || v === '') return '—';
    const s = Number(v); if (!isFinite(s) || s < 0) return '—';
    const m = Math.floor(s/60).toString().padStart(2,'0');
    const sec = Math.floor(s%60).toString().padStart(2,'0');
    return `${m}:${sec}`;
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

  const downloadBlob = (filename, dataStr) => {
    const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const isoStamp = () => {
    const d = new Date();
    const pad = (n)=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  };

  /* ---------------- Modal (auto-injected) ---------------- */
  let modalEl = document.getElementById('jobDetailModal');
  if (!modalEl){
    modalEl = document.createElement('div');
    modalEl.id = 'jobDetailModal';
    modalEl.className = 'modal fade';
    modalEl.tabIndex = -1;
    modalEl.setAttribute('aria-hidden','true');
    modalEl.innerHTML = `
      <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Job details</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div id="job-modal-body"><div class="text-muted">Loading…</div></div>
          </div>
          <div class="modal-footer">
            <a id="job-modal-open-page" class="btn btn-outline-primary" target="_blank" rel="noopener">Open full page</a>
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modalEl);
  }
  const jobModalBody = modalEl.querySelector('#job-modal-body');
  const jobModalOpenPage = modalEl.querySelector('#job-modal-open-page');

  // Bootstrap modal wrapper (fallback if bootstrap missing)
  let modalInstance = null;
  const ensureModal = () => {
    if (window.bootstrap?.Modal){
      if (!modalInstance) modalInstance = new bootstrap.Modal(modalEl);
      return { show:()=>modalInstance.show(), hide:()=>modalInstance.hide() };
    }
    return {
      show: ()=>{
        modalEl.classList.add('show'); modalEl.style.display='block'; modalEl.removeAttribute('aria-hidden');
        document.body.classList.add('modal-open');
        let back=document.getElementById('__modal_backdrop__');
        if(!back){ back=document.createElement('div'); back.id='__modal_backdrop__'; back.className='modal-backdrop fade show'; document.body.appendChild(back);}
      },
      hide: ()=>{
        modalEl.classList.remove('show'); modalEl.style.display='none'; modalEl.setAttribute('aria-hidden','true');
        document.body.classList.remove('modal-open');
        document.getElementById('__modal_backdrop__')?.remove();
      }
    };
  };
  const modal = ensureModal();

  // Keep modal body tidy
  (function injectModalFixes(){
    const id='__job_modal_fixes__';
    if (document.getElementById(id)) return;
    const st=document.createElement('style'); st.id=id;
    st.textContent=`
      .modal .modal-body{ overflow-x:hidden; }
      .modal .modal-body code, .modal .modal-body .transcript{ white-space:normal; word-break:break-word; overflow-wrap:anywhere; }
      .modal .transcript-wrap{ position:relative; padding-left:64px; }
      .modal .gutter{ position:absolute; left:0; top:0; width:56px; pointer-events:none; }
      .legend .chip{ display:inline-block; padding:.15rem .5rem; border-radius:999px; font-size:.75rem; margin-left:.25rem; }
      .chip.bad{ background:rgba(0,0,0,.08); }
      .chip.hate{ background:rgba(220,53,69,.12); }
      .chip.terror{ background:rgba(255,193,7,.18); }
      .flag-fly{ position:fixed; left:0; top:0; transform:translate(-50%,-100%); background:#111; color:#fff; font-size:.75rem; padding:.25rem .5rem; border-radius:.5rem; opacity:0; pointer-events:none; transition:opacity .08s linear; }
      .flag-fly.hate{ background:#b02a37; }
      .flag-fly.terror{ background:#ad7a00; }
    `;
    document.head.appendChild(st);
  })();

  const statusBadge = (label)=>{
    if (label==='SUCCESS') return `<span class="badge bg-success">SUCCESS</span>`;
    if (label==='FAILED')  return `<span class="badge bg-danger">FAILED</span>`;
    if (label==='RUNNING') return `<span class="badge bg-secondary">RUNNING</span>`;
    return `<span class="badge text-bg-secondary">${escapeHtml(label||'PENDING')}</span>`;
  };

  /* ---------------- Row rendering ---------------- */
  const actionHtmlFor = (id, status, err) => {
    if (status === 'SUCCESS'){
      return `
        <div class="action-row">
          <button class="btn btn-outline-primary btn-sm btn-view" data-id="${id}">Details</button>
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
    return `
      <div class="action-row">
        <button class="btn btn-outline-primary btn-sm btn-view" data-id="${id}">Details</button>
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
      </div>`;
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
        <td>${fmtBytes(size)}</td>
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

  /* ---------------- Polling ---------------- */
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

  /* ---------------- Load existing ---------------- */
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

  /* ---------------- Enqueue ---------------- */
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

  /* ---------------- Modal rendering + enhancements ---------------- */
  const statusPill = (s) => {
    if (s === 'SUCCESS') return '<span class="badge bg-success">SUCCESS</span>';
    if (s === 'FAILED')  return '<span class="badge bg-danger">FAILED</span>';
    if (s === 'RUNNING') return '<span class="badge bg-secondary">RUNNING</span>';
    return `<span class="badge text-bg-secondary">${escapeHtml(s||'PENDING')}</span>`;
  };

  const renderTranscript = (meta, payload) => {
    const flags  = Array.isArray(payload?.flags) ? payload.flags : null;
    const labels = Array.isArray(payload?.labels) ? payload.labels
                  : Array.isArray(meta?.labels) ? meta.labels
                  : null;
    const txt    = payload?.transcript_text || '';

    let parts = '';

    if (flags && flags.length) {
      parts = flags.map((f) => {
        const lbl = f.label ?? '';
        const isSkip = String(lbl).toLowerCase().includes('skip');
        const cls = isSkip ? 'plain' : 'flagged';
        const dataLbl = isSkip ? '' : `data-label="${escapeHtml(lbl)}" tabindex="0"`;
        const st = f.start_sec ?? f.start ?? '';
        const en = f.end_sec ?? f.end ?? '';
        return `<span class="${cls}" ${dataLbl} data-start="${st}" data-end="${en}">${escapeHtml(f.text || '')}</span><span> </span>`;
      }).join('');
    } else if (labels && labels.length) {
      parts = labels.map((row) => {
        let lbl, text, start, end;
        if (Array.isArray(row)) [lbl, text, start, end] = row;
        else ({ label: lbl, text, start, end } = row);

        const isSkip = String(lbl||'').toLowerCase().includes('skip');
        const cls = isSkip ? 'plain' : 'flagged';
        const dataLbl = isSkip ? '' : `data-label="${escapeHtml(lbl)}" tabindex="0"`;
        return `<span class="${cls}" ${dataLbl} data-start="${start??''}" data-end="${end??''}">${escapeHtml(text||'')}</span><span> </span>`;
      }).join('');
    } else if (txt) {
      return `
        <div class="d-flex align-items-center justify-content-between mb-2">
          <h6 class="mb-0">Transcript</h6>
        </div>
        <div class="transcript-wrap" id="transcript-wrap">
          <div class="gutter" id="transcript-gutter" aria-hidden="true"></div>
          <div class="transcript" id="transcript">${escapeHtml(txt)}</div>
        </div>
      `;
    } else {
      return '';
    }

    return `
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h6 class="mb-0">Transcript</h6>
        <div class="legend">
          <span class="chip bad">Bad language</span>
          <span class="chip hate">Hate speech</span>
          <span class="chip terror">Terrorism support</span>
        </div>
      </div>
      <div class="transcript-wrap" id="transcript-wrap">
        <div class="gutter" id="transcript-gutter" aria-hidden="true"></div>
        <div class="transcript" id="transcript">${parts}</div>
      </div>
    `;
  };

  const renderJobModal = (meta, payload) => {
    const rows = [
      ['Status',   statusPill(meta?.status)],
      ['Original file', escapeHtml(meta?.original_name ?? '')],
      ['Stored file',   escapeHtml(meta?.stored_name ?? '')],
      ['Uploaded path', `<code>${escapeHtml(meta?.upload_rel ?? meta?.upload_path ?? '')}</code>`],
      ['Size',     fmtBytes(meta?.src_size)],
      ['Duration', mmss(meta?.duration_sec)],
    ];

    const errorRow = meta?.error ? `<div class="mb-2"><strong class="text-danger">Error:</strong> ${escapeHtml(meta.error)}</div>` : '';
    const dl = rows.map(([k,v]) => `
      <dt class="col-sm-3">${k}</dt>
      <dd class="col-sm-9">${v || '—'}</dd>
    `).join('');

    const transcriptBlock = renderTranscript(meta, payload);

    jobModalBody.innerHTML = `
      <dl class="row mb-3">${dl}</dl>
      ${errorRow}
      ${transcriptBlock}
    `;

    enhanceFlagsAndGutter(jobModalBody);
  };

  function enhanceFlagsAndGutter(root){
    root.querySelectorAll('.flagged').forEach((el)=>{
      const label = (el.dataset.label || '').toLowerCase();
      if (label.includes('terror')) el.classList.add('lbl-terror');
      else if (label.includes('hate')) el.classList.add('lbl-hate');
      else el.classList.add('lbl-bad');
    });

    let tip = root.querySelector('.flag-fly');
    if (!tip){
      tip = document.createElement('div');
      tip.className = 'flag-fly';
      root.appendChild(tip);
    }
    const mmssLocal = (v)=>{
      if (v === null || v === undefined || v === '') return '—';
      const s = Number(v); if (!isFinite(s) || s < 0) return '—';
      const m = Math.floor(s/60).toString().padStart(2,'0');
      const sec = Math.floor(s%60).toString().padStart(2,'0');
      return `${m}:${sec}`;
    };
    const showTip = (el)=>{
      const label = el.dataset.label || '—';
      const st = el.dataset.start, en = el.dataset.end;
      const lbl = label.toLowerCase().includes('terror') ? 'terror'
                : label.toLowerCase().includes('hate')   ? 'hate' : 'bad';
      tip.textContent = `${label} • ${mmssLocal(st)}–${mmssLocal(en)}`;
      tip.className = `flag-fly ${lbl}`;
      tip.style.opacity = '1';
    };
    const hideTip = ()=> { tip.style.opacity = '0'; };
    root.querySelectorAll('.flagged').forEach((el)=>{
      el.addEventListener('mouseenter', ()=> showTip(el));
      el.addEventListener('mousemove', (e)=>{
        const margin=12, w=tip.offsetWidth||180, h=tip.offsetHeight||28;
        let x=e.clientX, y=e.clientY;
        x = Math.max(margin + w/2, Math.min(window.innerWidth - margin - w/2, x));
        y = Math.max(margin + h, y - 14);
        tip.style.left = `${x}px`;
        tip.style.top  = `${y}px`;
      });
      el.addEventListener('mouseleave', hideTip);
      el.addEventListener('focus', ()=> showTip(el));
      el.addEventListener('blur', hideTip);
    });

    const wrap   = root.querySelector('#transcript-wrap');
    const body   = root.querySelector('#transcript');
    const gutter = root.querySelector('#transcript-gutter');
    if (!wrap || !body || !gutter) return;

    const getScrollParent = (node)=>{
      let p = node && node.parentElement;
      while (p && p !== document.body){
        const s = getComputedStyle(p);
        if (/(auto|scroll)/.test(s.overflowY)) return p;
        p = p.parentElement;
      }
      return document.scrollingElement || document.documentElement;
    };
    const scroller = getScrollParent(wrap);

    const buildGutter = ()=>{
      gutter.innerHTML = '';
      const rows = new Map();
      const wrapRect = wrap.getBoundingClientRect();

      body.querySelectorAll('.plain, .flagged').forEach((el)=>{
        const tStart = Number(el.dataset.start);
        const rects = el.getClientRects();
        for (const r of rects) {
          const yContent = r.top - wrapRect.top;
          const key = Math.round(yContent);
          const current = rows.get(key);
          if (!current || r.left < current.left) {
            rows.set(key, { left: r.left, top: yContent, height: r.height, time: tStart });
          }
        }
      });

      const lines = Array.from(rows.values()).sort((a,b)=>a.top-b.top);
      if (!lines.length) return;

      const step = 5;
      for (let i=0;i<lines.length;i+=step){
        const row = lines[i];
        const tick = document.createElement('div');
        tick.className = 'tick';
        const baselineY = row.top + (row.height * 0.25);
        tick.style.top = `${baselineY}px`;
        tick.textContent = mmssLocal(row.time);
        gutter.appendChild(tick);
      }
    };

    let rafId;
    const schedule = ()=>{
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(buildGutter);
    };

    window.addEventListener('resize', schedule, { passive:true });
    (scroller||document).addEventListener('scroll', schedule, { passive:true });

    const ro = new ResizeObserver(schedule);
    ro.observe(body);

    schedule();
  }

  const openJobModal = async (jobId) => {
    const ensureDetailAssets = () => {
      if (!document.querySelector('link[data-jobdetail]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/static/css/job_detail.css';
        link.dataset.jobdetail = '1';
        document.head.appendChild(link);
      }
      if (!window.__job_detail_loaded__) {
        const script = document.createElement('script');
        script.src = '/static/js/job_detail.js';
        script.dataset.jobdetail = '1';
        script.onload = () => (window.__job_detail_loaded__ = true);
        document.body.appendChild(script);
      }
    };
    ensureDetailAssets();

    jobModalBody.innerHTML = `<div class="text-muted">Loading…</div>`;
    jobModalOpenPage.href = `/job/${jobId}/`;
    modal.show();

    try {
      const [metaRes, dataRes] = await Promise.all([
        fetch(`/api/jobs/${jobId}/`, { credentials: 'same-origin' }),
        fetch(`/api/jobs/${jobId}/data/`, { credentials: 'same-origin' }).catch(() => null),
      ]);
      const meta = metaRes.ok ? await metaRes.json() : {};
      const payload = (dataRes && dataRes.ok) ? await dataRes.json() : {};
      renderJobModal(meta, payload);
      if (window.__job_detail_loaded__ && typeof window.initializeJobDetail === 'function') {
        window.initializeJobDetail();
      }
    } catch (e) {
      console.error('modal fetch error', e);
      jobModalBody.innerHTML = `<div class="text-danger">Failed to load job details.</div>`;
    }
  };

  /* ---------------- Bulk helpers (NEW) ---------------- */

  // Fetch up to N jobs for current principal. Adjust limit if needed.
  const fetchMyJobs = async (limit=200) => {
    const res = await fetch(`/api/jobs/?limit=${limit}`, { credentials:'same-origin' });
    if (!res.ok) throw new Error(`Failed to list jobs (HTTP ${res.status})`);
    const data = await res.json();
    return Array.isArray(data.jobs) ? data.jobs : [];
  };

  // Fetch payloads for all SUCCESS jobs
  const fetchAllSuccessPayloads = async () => {
    const jobs = await fetchMyJobs(200);
    const okJobs = jobs.filter(j => j.status === 'SUCCESS'); // skip non-success
    if (!okJobs.length) return [];

    const results = [];
    // fetch sequentially to avoid hammering the backend; order newest-first already from API
    for (const j of okJobs) {
      try{
        const r = await fetch(`/api/jobs/${j.id}/data/`, { credentials:'same-origin' });
        if (!r.ok) continue;
        const payload = await r.json();
        results.push(payload);
      }catch(_e){
        // ignore failures per job
      }
    }
    return results;
  };

  const withBusy = async (btn, fn, busyLabel='Working…') => {
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
    if (!payloads.length){
      flash('No finished jobs to copy.', 'info', 2500);
      return;
    }
    const txt = pretty(payloads);
    const ok = await copyToClipboard(txt);
    if (ok) flash(`Copied ${payloads.length} item(s) to clipboard.`, 'info', 2500);
    else flash('Copy to clipboard failed.', 'danger');
  };

  const doExportAll = async () => {
    const payloads = await fetchAllSuccessPayloads();
    if (!payloads.length){
      flash('No finished jobs to export.', 'info', 2500);
      return;
    }
    const fname = `session-transcripts-${isoStamp()}.json`;
    downloadBlob(fname, pretty(payloads));
    flash(`Exported ${payloads.length} item(s) as ${fname}.`, 'info', 3000);
  };

  /* ---------------- Events ---------------- */
  enqueueBtn.addEventListener('click', enqueue);
  form.addEventListener('submit', (e)=> e.preventDefault());
  clearBtn.addEventListener('click', () => {
    // Only clear the current selection in the file input
    filesInput.value = '';
    filesInput.dispatchEvent(new Event('change')); // if you want any change listeners to run
    flash('Selection cleared.', 'info', 2000);
  });


  // NEW: bulk action listeners
  if (copyAllBtn) {
    copyAllBtn.addEventListener('click', () => withBusy(copyAllBtn, doCopyAll, 'Collecting…'));
  }
  if (exportAllBtn) {
    exportAllBtn.addEventListener('click', () => withBusy(exportAllBtn, doExportAll, 'Collecting…'));
  }

  tbody.addEventListener('click', async (e)=>{
    // DETAILS (modal)
    const viewBtn = e.target.closest('.btn-view');
    if (viewBtn){
      const id = viewBtn.getAttribute('data-id');
      if (id) openJobModal(id);
      return;
    }

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
          flash('Job deleted.', 'info', 2500);
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

    // COPY JSON (single)
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
