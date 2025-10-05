// UB job detail modal + transcript rendering + gutter enhancements
(function () {
  const UB = (window.UB = window.UB || {});
  const { escapeHtml, fmtBytes, mmss, flash } = UB.dom;
  const { getJob, getJobData } = UB.api;

  // ----- modal shell (auto-injected) -----
  let modalEl = document.getElementById('jobDetailModal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'jobDetailModal';
    modalEl.className = 'modal fade';
    modalEl.tabIndex = -1;
    modalEl.setAttribute('aria-hidden', 'true');
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

  // bootstrap fallback
  let modalInstance = null;
  const modal = (function ensureModal() {
    if (window.bootstrap?.Modal) {
      if (!modalInstance) modalInstance = new bootstrap.Modal(modalEl);
      return { show: () => modalInstance.show(), hide: () => modalInstance.hide() };
    }
    return {
      show: () => {
        modalEl.classList.add('show');
        modalEl.style.display = 'block';
        modalEl.removeAttribute('aria-hidden');
        document.body.classList.add('modal-open');
        let back = document.getElementById('__modal_backdrop__');
        if (!back) {
          back = document.createElement('div');
          back.id = '__modal_backdrop__';
          back.className = 'modal-backdrop fade show';
          document.body.appendChild(back);
        }
      },
      hide: () => {
        modalEl.classList.remove('show');
        modalEl.style.display = 'none';
        modalEl.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        document.getElementById('__modal_backdrop__')?.remove();
      },
    };
  })();

  // one-time style fixes
  (function injectModalFixes() {
    const id = '__job_modal_fixes__';
    if (document.getElementById(id)) return;
    const st = document.createElement('style');
    st.id = id;
    st.textContent = `
      .modal .modal-body{ overflow-x:hidden; }
      .modal .modal-body code, .modal .modal-body .transcript{ white-space:normal; word-break:break-word; overflow-wrap:anywhere; }
      .modal .transcript-wrap{ position:relative; padding-left:64px; }
      .modal .gutter{ position:absolute; left:0; top:0; width:56px; pointer-events:none; }
      .legend .chip{ display:inline-block; padding:.15rem .5rem; border-radius:999px; font-size:.75rem; margin-left:.25rem; }
      .chip.bad{ background:rgba(0,0,0,.08); }
      .chip.hate{ background:rgba(220,53,69,.12); }
      .chip.abuse{ background:rgba(255,193,7,.18); }
      .flag-fly{ position:fixed; left:0; top:0; transform:translate(-50%,-100%); background:#111; color:#fff; font-size:.75rem; padding:.25rem .5rem; border-radius:.5rem; opacity:0; pointer-events:none; transition:opacity .08s linear; }
      .flag-fly.hate{ background:#b02a37; }
      .flag-fly.abuse{ background:#ad7a00; }
    `;
    document.head.appendChild(st);
  })();

  const statusPill = (s) => {
    if (s === 'SUCCESS') return '<span class="badge bg-success">SUCCESS</span>';
    if (s === 'FAILED') return '<span class="badge bg-danger">FAILED</span>';
    if (s === 'RUNNING') return '<span class="badge bg-secondary">RUNNING</span>';
    return `<span class="badge text-bg-secondary">${escapeHtml(s || 'PENDING')}</span>`;
  };

  const renderTranscript = (meta, payload) => {
    const flags = Array.isArray(payload?.flags) ? payload.flags : null;
    const labels = Array.isArray(payload?.labels)
      ? payload.labels
      : Array.isArray(meta?.labels)
      ? meta.labels
      : null;
    const txt = payload?.transcript_text || '';

    let parts = '';

    if (flags && flags.length) {
      parts = flags
        .map((f) => {
          const lbl = f.label ?? '';
          const isSkip = String(lbl).toLowerCase().includes('skip');
          const cls = isSkip ? 'plain' : 'flagged';
          const dataLbl = isSkip ? '' : `data-label="${escapeHtml(lbl)}" tabindex="0"`;
          const st = f.start_sec ?? f.start ?? '';
          const en = f.end_sec ?? f.end ?? '';
          return `<span class="${cls}" ${dataLbl} data-start="${st}" data-end="${en}">${escapeHtml(
            f.text || ''
          )}</span><span> </span>`;
        })
        .join('');
    } else if (labels && labels.length) {
      parts = labels
        .map((row) => {
          let lbl, text, start, end;
          if (Array.isArray(row)) [lbl, text, start, end] = row;
          else ({ label: lbl, text, start, end } = row);

          const isSkip = String(lbl || '').toLowerCase().includes('skip');
          const cls = isSkip ? 'plain' : 'flagged';
          const dataLbl = isSkip ? '' : `data-label="${escapeHtml(lbl)}" tabindex="0"`;
          return `<span class="${cls}" ${dataLbl} data-start="${start ?? ''}" data-end="${end ?? ''}">${escapeHtml(
            text || ''
          )}</span><span> </span>`;
        })
        .join('');
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
          <span class="chip abuse">Abuse</span>
        </div>
      </div>
      <div class="transcript-wrap" id="transcript-wrap">
        <div class="gutter" id="transcript-gutter" aria-hidden="true"></div>
        <div class="transcript" id="transcript">${parts}</div>
      </div>
    `;
  };

  function enhanceFlagsAndGutter(root) {
    root.querySelectorAll('.flagged').forEach((el) => {
      const label = (el.dataset.label || '').toLowerCase();
      // normalize: legacy "terror" -> "abuse"
      if (label.includes('abuse') || label.includes('terror')) el.classList.add('lbl-abuse');
      else if (label.includes('hate')) el.classList.add('lbl-hate');
      else el.classList.add('lbl-bad');
    });

    let tip = root.querySelector('.flag-fly');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'flag-fly';
      root.appendChild(tip);
    }
    const mmssLocal = (v) => {
      if (v === null || v === undefined || v === '') return '—';
      const s = Number(v);
      if (!isFinite(s) || s < 0) return '—';
      const m = Math.floor(s / 60).toString().padStart(2, '0');
      const sec = Math.floor(s % 60).toString().padStart(2, '0');
      return `${m}:${sec}`;
    };
    const showTip = (el) => {
      const label = el.dataset.label || '—';
      const st = el.dataset.start,
        en = el.dataset.end;
      const lbl =
        label.toLowerCase().includes('abuse') || label.toLowerCase().includes('terror')
          ? 'abuse'
          : label.toLowerCase().includes('hate')
          ? 'hate'
          : 'bad';
      const display = lbl === 'abuse' ? 'Abuse' : lbl === 'hate' ? 'Hate speech' : 'Bad language';
      tip.textContent = `${display} • ${mmssLocal(st)}–${mmssLocal(en)}`;
      tip.className = `flag-fly ${lbl}`;
      tip.style.opacity = '1';
    };
    const hideTip = () => {
      tip.style.opacity = '0';
    };
    root.querySelectorAll('.flagged').forEach((el) => {
      el.addEventListener('mouseenter', () => showTip(el));
      el.addEventListener('mousemove', (e) => {
        const margin = 12,
          w = tip.offsetWidth || 180,
          h = tip.offsetHeight || 28;
        let x = e.clientX,
          y = e.clientY;
        x = Math.max(margin + w / 2, Math.min(window.innerWidth - margin - w / 2, x));
        y = Math.max(margin + h, y - 14);
        tip.style.left = `${x}px`;
        tip.style.top = `${y}px`;
      });
      el.addEventListener('mouseleave', hideTip);
      el.addEventListener('focus', () => showTip(el));
      el.addEventListener('blur', hideTip);
    });

    const wrap = root.querySelector('#transcript-wrap');
    const body = root.querySelector('#transcript');
    const gutter = root.querySelector('#transcript-gutter');
    if (!wrap || !body || !gutter) return;

    const getScrollParent = (node) => {
      let p = node && node.parentElement;
      while (p && p !== document.body) {
        const s = getComputedStyle(p);
        if (/(auto|scroll)/.test(s.overflowY)) return p;
        p = p.parentElement;
      }
      return document.scrollingElement || document.documentElement;
    };
    const scroller = getScrollParent(wrap);

    const buildGutter = () => {
      gutter.innerHTML = '';
      const rows = new Map();
      const wrapRect = wrap.getBoundingClientRect();

      body.querySelectorAll('.plain, .flagged').forEach((el) => {
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

      const lines = Array.from(rows.values()).sort((a, b) => a.top - b.top);
      if (!lines.length) return;

      const step = 5;
      for (let i = 0; i < lines.length; i += step) {
        const row = lines[i];
        const tick = document.createElement('div');
        tick.className = 'tick';
        const baselineY = row.top + row.height * 0.25;
        tick.style.top = `${baselineY}px`;
        tick.textContent = mmss(row.time);
        gutter.appendChild(tick);
      }
    };

    let rafId;
    const schedule = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(buildGutter);
    };

    window.addEventListener('resize', schedule, { passive: true });
    (scroller || document).addEventListener('scroll', schedule, { passive: true });

    const ro = new ResizeObserver(schedule);
    ro.observe(body);

    schedule();
  }

  const renderJobModal = (meta, payload) => {
    const rows = [
      ['Status', statusPill(meta?.status)],
      ['Original file', escapeHtml(meta?.original_name ?? '')],
      ['Stored file', escapeHtml(meta?.stored_name ?? '')],
      ['Uploaded path', `<code>${escapeHtml(meta?.upload_rel ?? meta?.upload_path ?? '')}</code>`],
      ['Size', fmtBytes(meta?.src_size)],
      ['Duration', mmss(meta?.duration_sec)],
    ];

    const errorRow = meta?.error
      ? `<div class="mb-2"><strong class="text-danger">Error:</strong> ${escapeHtml(meta.error)}</div>`
      : '';
    const dl = rows
      .map(
        ([k, v]) => `
      <dt class="col-sm-3">${k}</dt>
      <dd class="col-sm-9">${v || '—'}</dd>
    `
      )
      .join('');

    const transcriptBlock = renderTranscript(meta, payload);

    jobModalBody.innerHTML = `
      <dl class="row mb-3">${dl}</dl>
      ${errorRow}
      ${transcriptBlock}
    `;

    enhanceFlagsAndGutter(jobModalBody);
  };

  async function openJobModal(jobId) {
    // ensure job detail assets (optional)
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

    jobModalBody.innerHTML = `<div class="text-muted">Loading…</div>`;
    jobModalOpenPage.href = `/job/${jobId}/`;
    modal.show();

    try {
      const [meta, payload] = await Promise.all([
        getJob(jobId).catch(() => ({})),
        getJobData(jobId).catch(() => ({})),
      ]);
      renderJobModal(meta || {}, payload || {});
      if (window.__job_detail_loaded__ && typeof window.initializeJobDetail === 'function') {
        window.initializeJobDetail();
      }
    } catch (e) {
      console.error('modal fetch error', e);
      jobModalBody.innerHTML = `<div class="text-danger">Failed to load job details.</div>`;
    }
  }

  UB.modal = { openJobModal };
})();
