// UB simple cache (localStorage) for sizes keyed by job id
(function () {
  const UB = (window.UB = window.UB || {});
  const KEY = "ub:sizes:v1";

  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
    catch { return {}; }
  };
  const write = (obj) => {
    try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch { /* ignore */ }
  };

  function getSize(id) {
    const m = read();
    const v = m[id];
    return Number.isFinite(v) && v > 0 ? v : null;
  }
  function setSize(id, bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return;
    const m = read();
    if (m[id] === n) return;
    m[id] = n;
    write(m);
  }
  function remove(id) {
    const m = read();
    if (id in m) { delete m[id]; write(m); }
  }
  function clear() { localStorage.removeItem(KEY); }

  UB.cache = { getSize, setSize, remove, clear };
})();
