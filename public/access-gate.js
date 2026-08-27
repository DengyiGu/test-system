// Synchronize answers and results with the server for five days from first access.
(() => {
  const token = new URLSearchParams(location.search).get('token');
  const storageKey = `onlineTestingResult_${token || 'invalid'}`;
  window.__TEST_ACCESS__ = { token };
  window.__TEST_SYNC_ENABLED__ = false;

  const rawSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    rawSet.call(this, key, value);
    if (window.__TEST_SYNC_ENABLED__ && this === localStorage && key === storageKey) {
      try {
        fetch('/api/save', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token, state: JSON.parse(value) })
        });
      } catch (_) {
        // Local storage still preserves the latest state if a request cannot be sent.
      }
    }
  };

  document.documentElement.classList.add('access-pending');
  document.write('<style>html.access-pending #app{visibility:hidden}#access-gate{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:24px;background:#f6f7fb;color:#1f2937;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:center}#access-gate .box{max-width:380px;padding:30px 26px;background:#fff;border-radius:24px;box-shadow:0 12px 40px rgba(15,23,42,.12);line-height:1.65}#access-gate .icon{font-size:40px;margin-bottom:10px}</style>');

  const show = (message, isError = false) => {
    const node = document.getElementById('access-gate') || document.body.appendChild(document.createElement('div'));
    node.id = 'access-gate';
    node.innerHTML = `<div class="box"><div class="icon">${isError ? '⚠️' : '✨'}</div><div>${message}</div></div>`;
  };

  window.addEventListener('DOMContentLoaded', async () => {
    if (!token) return show('Please open the unique testing link provided by the administrator.', true);
    show('Checking your unique link…');
    try {
      const response = await fetch(`/api/session?token=${encodeURIComponent(token)}`, { cache: 'no-store', credentials: 'same-origin' });
      const data = await response.json();
      if (!response.ok || !data.valid) return show(data.error || 'This unique link cannot be used.', true);

      const hydrated = `testing_hydrated_${token}`;
      if (!sessionStorage.getItem(hydrated)) {
        rawSet.call(localStorage, storageKey, JSON.stringify(data.state));
        sessionStorage.setItem(hydrated, '1');
        location.reload();
        return;
      }

      sessionStorage.removeItem(hydrated);
      window.__TEST_SYNC_ENABLED__ = true;
      document.documentElement.classList.remove('access-pending');
      document.getElementById('access-gate')?.remove();
    } catch {
      show('The server cannot be reached right now. Check your network connection and try again.', true);
    }
  });
})();
