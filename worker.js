const JSON_HEADERS = { 'content-type': 'application/json; charset=UTF-8', 'cache-control': 'no-store' };
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
const validToken = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{40,100}$/.test(value);
async function hash(value) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
function random() { const b = crypto.getRandomValues(new Uint8Array(32)); return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
function cookie(request, name) { return request.headers.get('Cookie')?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1] || null; }
function admin(request, env) { const v = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, ''); return Boolean(env.ADMIN_SECRET && v && v === env.ADMIN_SECRET); }
async function body(request) { try { return await request.json(); } catch { return null; } }
function parse(value, fallback) { try { return JSON.parse(value || ''); } catch { return fallback; } }
function validAnswers(answers) { return Array.isArray(answers) && answers.length <= 4 && answers.every((a) => Number.isInteger(a?.questionIndex) && a.questionIndex >= 1 && a.questionIndex <= 4 && ['A', 'B', 'C', 'D'].includes(a.optionLetter)); }
async function rowForToken(env, token) { return validToken(token) ? env.DB.prepare('SELECT * FROM issued_links WHERE token_hash = ?').bind(await hash(token)).first() : null; }
async function deleteIfStale(env, row) { return (await env.DB.prepare("DELETE FROM issued_links WHERE id = ? AND expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP").bind(row.id).run()).meta.changes > 0; }
function stateOf(row) { const result = parse(row.result_json, {}); return { answers: parse(row.answers_json, []), outerColor: result.outerColor || null, innerColor: result.innerColor || null, resultKey: result.resultKey || null, timestamp: Date.now() }; }

async function session(request, env, url) {
  const token = url.searchParams.get('token');
  const link = await rowForToken(env, token);
  if (!link) return json({ valid: false, error: '该专属链接不存在或已过期。' }, 404);
  if (await deleteIfStale(env, link)) return json({ valid: false, error: '该专属链接的五天使用期已结束。' }, 410);
  if (link.status === 'available') {
    await env.DB.prepare("UPDATE issued_links SET status = 'claimed', first_opened_at = CURRENT_TIMESTAMP, expires_at = datetime('now', '+5 days') WHERE id = ? AND status = 'available'").bind(link.id).run();
  }
  return json({ valid: true, state: stateOf(link) });
}
async function save(request, env) {
  const data = await body(request);
  if (!data || !validAnswers(data.state?.answers)) return json({ error: '答题数据不正确。' }, 400);
  const link = await rowForToken(env, data.token);
  if (!link || await deleteIfStale(env, link)) return json({ error: '链接已失效。' }, 404);
  if (link.status === 'completed') return json({ ok: true, locked: true });
  const result = { outerColor: data.state.outerColor || null, innerColor: data.state.innerColor || null, resultKey: data.state.resultKey || null };
  const completed = Boolean(result.resultKey);
  await env.DB.prepare(`UPDATE issued_links SET answers_json = ?, result_json = ?, status = ?, completed_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id = ?`)
    .bind(JSON.stringify(data.state.answers), completed ? JSON.stringify(result) : null, completed ? 'completed' : 'claimed', completed ? 1 : 0, link.id).run();
  return json({ ok: true });
}
async function create(request, env, url) {
  if (!admin(request, env)) return json({ error: '管理员密码不正确。' }, 401);
  const data = await body(request), count = Number(data?.count ?? 1);
  if (!Number.isInteger(count) || count < 1 || count > 100) return json({ error: '一次只能生成 1–100 条链接。' }, 400);
  const links = [];
  for (let i = 0; i < count; i += 1) { const token = random(), id = crypto.randomUUID(), label = count === 1 ? String(data?.customerLabel || '').slice(0, 200) : ''; await env.DB.prepare('INSERT INTO issued_links (id, token_hash, customer_label) VALUES (?, ?, ?)').bind(id, await hash(token), label || null).run(); links.push({ id, url: `${url.origin}/?token=${token}` }); }
  return json({ links }, 201);
}
async function serve(request, env, url) {
  // Keep the public root URL working even though the quiz page has a descriptive filename.
  const assetRequest = url.pathname === '/'
    ? new Request(new URL('/question-example.html', url), request)
    : request;
  const response = await env.ASSETS.fetch(assetRequest);
  if (url.pathname !== '/' || !response.headers.get('content-type')?.includes('text/html')) return response;
  const html = (await response.text())
    .replace('<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">', '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">\n    <script src="access-gate.js"></script>')
    .replace("const STORAGE_KEY = 'personalityColorTest_result';", "const STORAGE_KEY = `personalityColorTest_result_${window.__TEST_ACCESS__?.token || 'invalid'}`;")
    .replace("state.answers.push({ questionIndex: qIndex, optionLetter: letter });\n                }\n\n                //", "state.answers.push({ questionIndex: qIndex, optionLetter: letter });\n                }\n                saveTestResult();\n\n                //")
    .replace("if (saved && saved.resultKey) {\n                    loadSavedResult(saved);\n                    return;\n                }", "if (saved && saved.resultKey) {\n                    loadSavedResult(saved);\n                    return;\n                }\n                if (saved && saved.answers && saved.answers.length) {\n                    state.answers = saved.answers;\n                    const nextQuestion = [1, 2, 3, 4].find((n) => !state.answers.some((a) => a.questionIndex === n)) || 1;\n                    renderQuestion(nextQuestion);\n                    return;\n                }");
  const headers = new Headers(response.headers); headers.set('content-type', 'text/html; charset=UTF-8'); headers.set('cache-control', 'no-store'); return new Response(html, { status: response.status, headers });
}
export default {
  async scheduled(_, env) { await env.DB.prepare("DELETE FROM issued_links WHERE expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP").run(); },
  async fetch(request, env) { const url = new URL(request.url); try { if (request.method === 'GET' && url.pathname === '/api/session') return session(request, env, url); if (request.method === 'POST' && url.pathname === '/api/save') return save(request, env); if (request.method === 'POST' && url.pathname === '/api/admin/links') return create(request, env, url); if (url.pathname.startsWith('/api/')) return json({ error: '接口不存在。' }, 404); return serve(request, env, url); } catch (error) { console.error(error); return json({ error: '服务暂时不可用，请稍后重试。' }, 500); } },
};
