// Needs window.getCSRFToken() from static/js/csrf.js,
// which is already loaded in base/_foot.html.

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

  if (!form) return; // not on this page

  let lastJSON = null;

  form.addEventListener('submit', (e) => e.preventDefault());

  const pretty = (o) => { try { return JSON.stringify(o, null, 2); } catch { return String(o); } };
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
    rUpload.textContent  = data.upload_path ?? '';
    rWav.textContent     = data.normalized_path ?? '';
    rSrcSize.textContent = (data.src_size != null) ? `${data.src_size} bytes` : '';
    rWavSize.textContent = (data.wav_size != null) ? `${data.wav_size} bytes` : '';
    rLen.textContent     = (data.length_sec != null) ? `${data.length_sec} s` : '';
    rJson.textContent    = pretty(data.transcript ?? data);
    errorEl.classList.add('d-none');
    resultEl.classList.remove('d-none');
  };

  async function analyze() {
    const file = document.getElementById('file').files[0];
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
})();
