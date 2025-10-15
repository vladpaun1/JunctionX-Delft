// frontend/src/lib/utils.ts
export const pretty = (obj: unknown) => JSON.stringify(obj, null, 2);

export async function copyToClipboard(s: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(s); return true; }
  catch {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = s; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); return true; }
    catch { return false; }
    finally { document.body.removeChild(ta); }
  }
}

export const fmtBytes = (n?: number | null) => {
  const x = Number(n ?? 0);
  if (!isFinite(x) || x <= 0) return '—';
  const u = ['bytes','KB','MB','GB','TB']; let i = 0, v = x;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 2 : 1)} ${u[i]}`;
};
