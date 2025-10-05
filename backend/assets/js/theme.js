(function () {
  const KEY = 'color-mode';
  const root = document.documentElement; // <html>

  // set initial: saved -> system
  const saved = localStorage.getItem(KEY);
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = saved || (systemPrefersDark ? 'dark' : 'light');
  apply(initial);

  // reflect system changes if user hasn't chosen explicitly
  if (!saved) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      apply(e.matches ? 'dark' : 'light');
    });
  }

  function apply(mode) {
    root.setAttribute('data-bs-theme', mode);     // Bootstrap 5.3 hook
    // optional mirror for your own selectors if you prefer:
    root.setAttribute('data-theme', mode);

    // swap icon
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.querySelector('[data-light]')?.style && (btn.querySelector('[data-light]').style.display = (mode === 'light') ? '' : 'none');
      btn.querySelector('[data-dark]')?.style && (btn.querySelector('[data-dark]').style.display = (mode === 'dark') ? '' : 'none');
      btn.classList.toggle('btn-outline-light', mode === 'light');
      btn.classList.toggle('btn-outline-secondary', mode === 'dark');
    }
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('#theme-toggle');
    if (!t) return;
    const next = (root.getAttribute('data-bs-theme') === 'dark') ? 'light' : 'dark';
    localStorage.setItem(KEY, next);
    apply(next);
  });
})();
