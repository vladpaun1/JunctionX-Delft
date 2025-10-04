// static/js/upload.js (full file)
(function () {
  const form       = document.getElementById('analyze-form');
  const btn        = document.getElementById('analyze-btn');
  const btnSpin    = document.getElementById('btn-spinner');
  const btnText    = btn.querySelector('.btn-text');
  const errorEl    = document.getElementById('error');
  const resultEl   = document.getElementById('result');
  const copyBtn    = document.getElementById('copy-json');
  const dlBtn      = document.getElementById('download-json');
  const overlay    = document.getElementById('overlay');

  const rUpload    = document.getElementById('r-upload');
  const rWav       = document.getElementById('r-wav');
  const rSrcSize   = document.getElementById('r-src-size');
  const rWavSize   = document.getElementById('r-wav-size');
  const rLen       = document.getElementById('r-len');
  const rText      = document.getElementById('r-text');

  const fileInput  = document.getElementById('file');
  const clearBtn   = document.getElementById('clear-file');

  // Modal bits
  const modalEl    = document.getElementById('labelModal');
  const mLabel     = document.getElementById('m-label');
  const mStart     = document.getElementById('m-start');
  const mEnd       = document.getElementById('m-end');
  const mText      = document.getElementById('m-text');
  const bsModal    = modalEl ? new bootstrap.Modal(modalEl) : null;

  if (!form) return;

  let lastJSON = null;

  form.addEventListener('submit', (e) => e.preventDefault());

  // helpers
  const pretty = (o) => { try { return JSON.stringify(o, null, 2); } catch { return String(o); } };

  const fmtBytes = (n) => {
    if (typeof n !== 'number' || !isFinite(n)) return '';
    const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
    let u = 0, v = n;
    while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
    return `${v.toFixed(v < 10 && u > 0 ? 2 : 1)} ${units[u]}`;
  };

  const toRelMedia = (p) => {
    if (!p) return '';
    const i = p.indexOf('/media/');
    return (i >= 0) ? p.slice(i) : p;
  };

  const escapeHtml = (s) => String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

  const escapeAttr = (s) => String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

  const isOkLabel = (lbl) => /^skip$/i.test(lbl || '');


  const setLoading = (v) => {
    btn.disabled = v;
    btnSpin.classList.toggle('d-none', !v);
    btnText.textContent = v ? 'Analyzing…' : 'Analyze via API';
    overlay.style.display = v ? 'flex' : 'none';
  };

  const showError = (msg) => {
    errorEl.textContent = msg;
    errorEl.classList.remove('d-none');
    resultEl.classList.add('d-none');
  };

  const labelClass = (lbl = '') => {
    const k = lbl.toLowerCase();
    if (k === 'terrorism support') return 'lbl-terror';
    if (k === 'bad language')      return 'lbl-bad';
    if (k === 'hate speech')       return 'lbl-hate';
    return 'lbl-unknown';
  };


  const renderSpans = (fullText, spans) => {
    // We’ll render by concatenating the sentence-level spans in order.
    // Each item is [label, text, start, end].
    if (Array.isArray(spans) && spans.length) {
      const html = spans.map((it) => {
        const [label, text, start, end] = it;
        const safeText  = escapeHtml(text || '');
        const safeLabel = escapeAttr(label || '');
        const s = (start ?? '');
        const e = (end ?? '');
        if (isOkLabel(label)) {
          return `<span class="ok-seg">${safeText}</span>`;
        }
        const cls = labelClass(label);
        return `<mark class="flagged ${cls}" data-label="${safeLabel}" data-start="${s}" data-end="${e}" data-text="${escapeAttr(text || '')}" tabindex="0">${safeText}</mark>`;
      }).join(' ');
      rText.innerHTML = html;
    } else {
      // Fallback: just dump the text
      rText.textContent = fullText || '';
    }

    // Attach click handlers for modal
    rText.querySelectorAll('.flagged').forEach(el => {
      el.addEventListener('click', () => {
        if (!bsModal) return;
        mLabel.textContent = el.getAttribute('data-label') || '';
        mStart.textContent = el.getAttribute('data-start') || '';
        mEnd.textContent   = el.getAttribute('data-end') || '';
        mText.textContent  = el.getAttribute('data-text') || '';
        bsModal.show();
      });
      el.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          el.click();
        }
      });
    });
  };

  const showResult = (data) => {
    const up = data.upload_rel || toRelMedia(data.upload_path);
    const nw = data.normalized_rel || toRelMedia(data.normalized_path);

    rUpload.textContent  = up;
    rWav.textContent     = nw;
    rSrcSize.textContent = (data.src_size != null) ? fmtBytes(data.src_size) : '';
    rWavSize.textContent = (data.wav_size != null) ? fmtBytes(data.wav_size) : '';
    rLen.textContent     = (data.length_sec != null) ? `${data.length_sec} s` : '';

    // NEW: highlighted text
    renderSpans(data.full_text || '', data.labels || []);

    errorEl.classList.add('d-none');
    resultEl.classList.remove('d-none');
  };

  async function analyze() {
    const file = fileInput.files[0];
    if (!file) { showError('Please choose an audio or video file.'); return; }

    const fd = new FormData();
    fd.append('file', file);

    setLoading(true);
    try {
      const res = await fetch('/api/analyze/', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRFToken': (window.getCSRFToken && window.getCSRFToken()) || '' },
        body: fd
      });

      const ct = res.headers.get('content-type') || '';
      const payload = ct.includes('application/json') ? await res.json()
                    : { detail: (await res.text()).slice(0, 2000) };

      if (!res.ok) throw new Error(payload?.detail || `HTTP ${res.status}`);

      lastJSON = payload;
      showResult(payload);
    } catch (err) {
      console.error('[analyze] error', err);
      showError(err?.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  btn.addEventListener('click', analyze);
  window.handleAnalyze = analyze;

  // Copy / Download the raw response (still useful for dev)
  copyBtn.addEventListener('click', async () => {
    if (!lastJSON) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(lastJSON, null, 2));
      const prev = copyBtn.textContent; copyBtn.textContent = 'Copied!';
      setTimeout(() => copyBtn.textContent = prev, 900);
    } catch {
      const prev = copyBtn.textContent; copyBtn.textContent = 'Copy failed';
      setTimeout(() => copyBtn.textContent = prev, 1200);
    }
  });

  dlBtn.addEventListener('click', () => {
    if (!lastJSON) return;
    const blob = new Blob([JSON.stringify(lastJSON, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'analyze_response.json';
    document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); a.remove();
  });

  // Clear button
  clearBtn.addEventListener('click', () => {
    fileInput.value = '';
    lastJSON = null;
    errorEl.classList.add('d-none');
    resultEl.classList.add('d-none');
    rText.textContent = '';
  });
})();
