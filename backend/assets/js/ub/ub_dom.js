// UB DOM + utilities (no network here)
(function () {
  const UB = (window.UB = window.UB || {});

  // ----- Toast area -----
  function ensureToastArea() {
    let toastArea = document.getElementById('toast-area');
    if (!toastArea) {
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
    return toastArea;
  }

  const toastArea = ensureToastArea();

  const escapeHtml = (s) =>
    String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

  const flash = (msg, kind = 'danger', ms = 4000) => {
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    el.innerHTML = `<span>${escapeHtml(msg)}</span><button aria-label="Dismiss">✕</button>`;
    el.style.pointerEvents = 'auto';
    const close = () => el.remove();
    el.querySelector('button').addEventListener('click', close);
    toastArea.appendChild(el);
    setTimeout(close, ms);
  };

  const getCookie = (n) => {
    const v = `; ${document.cookie}`;
    const p = v.split(`; ${n}=`);
    return p.length === 2 ? p.pop().split(';').shift() : '';
  };

  const getCSRF = () =>
    (window.getCSRFToken && window.getCSRFToken()) || getCookie('csrftoken') || '';

  const fmtBytes = (n) => {
    const x = Number(n || 0);
    if (!isFinite(x) || x <= 0) return '—';
    const u = ['bytes', 'KB', 'MB', 'GB', 'TB'];
    let i = 0,
      v = x;
    while (v >= 1024 && i < u.length - 1) {
      v /= 1024;
      i++;
    }
    return `${v.toFixed(v < 10 && i > 0 ? 2 : 1)} ${u[i]}`;
  };

  const mmss = (v) => {
    if (v === null || v === undefined || v === '') return '—';
    const s = Number(v);
    if (!isFinite(s) || s < 0) return '—';
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const pretty = (obj) => JSON.stringify(obj, null, 2);

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }
  };

  const downloadBlob = (filename, dataStr) => {
    const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const isoStamp = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(
      d.getHours()
    )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  };

  UB.dom = {
    escapeHtml,
    flash,
    getCSRF,
    fmtBytes,
    mmss,
    pretty,
    copyToClipboard,
    downloadBlob,
    isoStamp,
  };
})();
