// 答案与结果通过本接口同步到服务器；从首次打开起保留 5 天。
(() => {
  const token = new URLSearchParams(location.search).get('token');
  const storageKey = `personalityColorTest_result_${token || 'invalid'}`;
  window.__TEST_ACCESS__ = { token };
  window.__PCT_SYNC_ENABLED = false;
  const rawSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    rawSet.call(this, key, value);
    if (window.__PCT_SYNC_ENABLED && this === localStorage && key === storageKey) {
      try { fetch('/api/save', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, state: JSON.parse(value) }) }); } catch (_) {}
    }
  };
  document.documentElement.classList.add('access-pending');
  document.write('<style>html.access-pending #app{visibility:hidden}#access-gate{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:24px;background:#fdf6f0;color:#3d302b;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;text-align:center}#access-gate .box{max-width:360px;padding:28px 24px;background:#fff;border-radius:24px;box-shadow:0 4px 24px rgba(60,40,30,.1);line-height:1.7}#access-gate .icon{font-size:40px;margin-bottom:10px}</style>');
  const show = (message, bad = false) => { const node = document.getElementById('access-gate') || document.body.appendChild(document.createElement('div')); node.id = 'access-gate'; node.innerHTML = `<div class="box"><div class="icon">${bad ? '⚠️' : '✨'}</div><div>${message}</div></div>`; };
  window.addEventListener('DOMContentLoaded', async () => {
    if (!token) return show('请使用商家发送给你的专属测试链接进入。', true);
    show('正在验证你的专属链接…');
    try {
      const response = await fetch(`/api/session?token=${encodeURIComponent(token)}`, { cache: 'no-store', credentials: 'same-origin' });
      const data = await response.json();
      if (!response.ok || !data.valid) return show(data.error || '该专属链接无法使用。', true);
      const hydrated = `pct_hydrated_${token}`;
      if (!sessionStorage.getItem(hydrated)) { rawSet.call(localStorage, storageKey, JSON.stringify(data.state)); sessionStorage.setItem(hydrated, '1'); location.reload(); return; }
      sessionStorage.removeItem(hydrated); window.__PCT_SYNC_ENABLED = true; document.documentElement.classList.remove('access-pending'); document.getElementById('access-gate')?.remove();
    } catch { show('暂时无法连接服务器，请检查网络后重试。', true); }
  });
})();
