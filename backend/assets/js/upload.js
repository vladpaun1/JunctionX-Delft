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
  const rJson      = document.getElementById('r-json');

  // NEW
  const fileInput  = document.getElementById('file');
  const clearBtn   = document.getElementById('clear-file');

  if (!form) return;

  let lastJSON = null;

  form.addEventListener('submit', (e) => e.preventDefault());

  const pretty = (o) => { try { return JSON.stringify(o, null, 2); } catch { return String(o); } };

  // NEW: human-readable sizes
  const fmtBytes = (n) => {
    if (typeof n !== 'number' || !isFinite(n)) return '';
    const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
    let u = 0, v = n;
    while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
    return `${v.toFixed(v < 10 && u > 0 ? 2 : 1)} ${units[u]}`;
  };

  // NEW: make path relative to /media if possible
  const toRelMedia = (p) => {
    if (!p) return '';
    const i = p.indexOf('/media/');
    return (i >= 0) ? p.slice(i) : p;
  };

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
  const showResult = (data) => {
    // Prefer backend-provided relative fields if present
    const up = data.upload_rel || toRelMedia(data.upload_path);
    const nw = data.normalized_rel || toRelMedia(data.normalized_path);

    rUpload.textContent  = up;
    rWav.textContent     = nw;
    rSrcSize.textContent = (data.src_size != null) ? fmtBytes(data.src_size) : '';
    rWavSize.textContent = (data.wav_size != null) ? fmtBytes(data.wav_size) : '';
    rLen.textContent     = (data.length_sec != null) ? `${data.length_sec} s` : '';
    rJson.textContent    = pretty(data.transcript ?? data);
    errorEl.classList.add('d-none');
    resultEl.classList.remove('d-none');
  };

  async function analyze() {
    const file = fileInput.files[0];
    const use_mock = document.getElementById('use_mock').checked;
    if (!file) { showError('Please choose an audio or video file.'); return; }

    const fd = new FormData();
    fd.append('file', file);
    fd.append('use_mock', use_mock ? 'true' : 'false');

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

  // Copy / Download
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

  // NEW: Clear button handler
  clearBtn.addEventListener('click', () => {
    fileInput.value = '';
    lastJSON = null;
    errorEl.classList.add('d-none');
    resultEl.classList.add('d-none');
  });
})();
