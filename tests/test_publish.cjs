// Publishing notes to GitHub: the Worker with a fake GitHub, and the app with a faked Worker.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const { handleApi } = await import(path.join(__dirname, '..', 'worker', 'api.js'));
  // A fake GitHub contents API that remembers one file.
  let file = null, puts = [];
  globalThis.fetch = async (url, opts = {}) => {
    if (!String(url).startsWith('https://api.github.com/repos/CaseoH231/bio-study/contents/published/notes.json')) throw new Error('unexpected ' + url);
    if (opts.headers?.authorization !== 'Bearer ghp_test') return new Response('{}', { status: 401 });
    if (opts.method === 'PUT') {
      const b = JSON.parse(opts.body); puts.push(b);
      if (file && b.sha !== file.sha) return new Response('{}', { status: 409 });
      file = { sha: `sha${puts.length}`, text: Buffer.from(b.content, 'base64').toString('utf8') };
      return Response.json({ commit: { html_url: 'https://github.com/x/commit/1' } });
    }
    if (!file) return new Response('{}', { status: 404 });
    return opts.headers?.accept === 'application/vnd.github.raw+json' ? new Response(file.text) : Response.json({ sha: file.sha });
  };
  const env = { GITHUB_TOKEN: 'ghp_test', APP_PASSCODE: 'pw', OWNER_IPS: '203.0.113.7' };
  const notes = { version: 1, starter: 3, topics: [{ id: 't-x', name: 'Enzymes – é ✓', color: '#000', entries: [{ id: 'e1', title: 'Enzyme', definition: 'A biological catalyst', notes: [] }] }] };
  const post = (body, pass, e = env, ip = '203.0.113.7') => handleApi(new Request('http://x/api/publish', { method: 'POST', body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...(pass ? { 'x-passcode': pass } : {}) } }), e);
  const codes = [
    (await handleApi(new Request('http://x/api/published'), env)).status,     // 404: nothing yet
    (await post({ notes }, 'pw', { APP_PASSCODE: 'pw' })).status,             // 503: no token
    (await post({ notes })).status,                                           // 401: owner's address alone isn't enough
    (await post({ notes }, 'nope')).status,                                   // 401: wrong passcode
    (await post({ nope: 1 }, 'pw')).status,                                   // 400: not notes
    (await post({ notes }, 'pw')).status,                                     // 200: first publish
    (await post({ notes }, 'pw')).status,                                     // 200: second publish replaces it (needs the sha)
    (await post({ notes }, 'pw', { ...env, GITHUB_TOKEN: 'wrong' })).status,  // 502: bad token
  ].join(',');
  const back = await (await handleApi(new Request('http://x/api/published'), env)).json();
  const worker = codes === '404,503,401,401,400,200,200,502' && puts.length === 2 && puts[1].sha === 'sha1' && puts[0].branch === 'main'
    && puts[0].message.includes('1 notes') && back.topics[0].name === 'Enzymes – é ✓' && !!back.publishedAt;

  // The app.
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept('pw'));
  const pub = { ...notes, publishedAt: '2026-11-18T00:00:00Z' };
  let sent = null;
  await p.route('**/api/published', (r) => r.fulfill({ json: pub }));
  await p.route('**/api/publish', (r) => {
    if (r.request().headers()['x-passcode'] !== 'pw') return r.fulfill({ status: 401, json: { error: 'passcode' } });
    sent = r.request().postDataJSON(); r.fulfill({ json: { ok: true, count: 1, commit: 'https://github.com/x/commit/1' } });
  });
  await p.goto('http://localhost:8766/');
  await p.waitForFunction(() => document.querySelector('#topics')?.textContent.includes('Enzymes'));
  const newVisitor = await p.$$eval('#topics .topic .nm', (x) => x.map((e) => e.textContent).join('|'));
  await p.click('.more:not(.topic-menu) summary'); await p.click('#btn-publish'); await p.click('#pub-go');
  await p.waitForSelector('text=Published ✓');
  const published = sent?.notes?.topics?.[0]?.name === 'Enzymes – é ✓';
  // Someone who already has notes keeps them on reload.
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('bio-study-notes-v1') || 'null') || { version: 1, starter: 3, topics: [] };
    d.topics = [{ id: 'mine', name: 'My own', color: '#000', entries: [] }]; localStorage.setItem('bio-study-notes-v1', JSON.stringify(d)); });
  await p.reload(); await p.waitForTimeout(500);
  const keeps = await p.$$eval('#topics .topic .nm', (x) => x.map((e) => e.textContent).join('|'));
  await p.evaluate(() => localStorage.clear());
  console.log('worker', codes, worker, '| new visitor', newVisitor, '| published', published, '| existing keeps', keeps, '| errors', errs.length);
  const ok = worker && newVisitor === 'Dashboard|Enzymes – é ✓' && published && keeps === 'Dashboard|My own' && !errs.length;
  console.log(ok ? 'publish ok' : 'publish FAILED ' + errs.join('; '));
  await b.close();
})();
