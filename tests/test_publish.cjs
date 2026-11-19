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
  const newVisitor = await p.$$eval('#topics .topic:not([data-course]) .nm', (x) => x.map((e) => e.textContent).join('|'));
  await p.click('.more:not(.topic-menu) summary'); await p.click('#btn-publish'); await p.click('#pub-go');
  await p.waitForSelector('text=Published ✓');
  const published = sent?.notes?.topics?.[0]?.name === 'Enzymes – é ✓';
  // Someone who already has notes keeps them on reload.
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('bio-study-notes-v1') || 'null') || { version: 1, starter: 3, topics: [] };
    d.topics = [{ id: 'mine', name: 'My own', color: '#000', entries: [] }]; localStorage.setItem('bio-study-notes-v1', JSON.stringify(d)); });
  await p.reload(); await p.waitForTimeout(500);
  const keeps = await p.$$eval('#topics .topic:not([data-course]) .nm', (x) => x.map((e) => e.textContent).join('|'));
  await p.evaluate(() => localStorage.clear());

  // A friend (never published, no passcode) with their own notes, opening the app after the owner publishes.
  const f = await (await b.newContext()).newPage(); f.on('pageerror', (e) => errs.push(e.message));
  let pubNow = { version: 1, starter: 7, publishedAt: 'v1', topics: [
    { id: 'h', name: 'Headstart', color: '#7c3aed', entries: [] },
    { id: 'o', parent: 'h', name: 'Organelles', color: '#2563eb', entries: [{ id: 'n1', title: 'Nucleus', definition: 'Controls the cell', notes: [] }] }] };
  await f.route('**/api/published', (r) => r.fulfill({ json: pubNow }));
  await f.goto('http://localhost:8766/'); await f.waitForFunction(() => document.querySelector('#topics')?.textContent.includes('Headstart'));
  await f.evaluate(() => { const d = JSON.parse(localStorage.getItem('bio-study-notes-v1'));
    d.topics.push({ id: 'mine', name: 'My own', color: '#000', entries: [{ id: 'm1', title: 'My note', definition: 'mine', notes: [] }] });
    d.topics.find((t) => t.id === 'o').entries[0].definition = 'MY VERSION';
    localStorage.setItem('bio-study-notes-v1', JSON.stringify(d)); });
  pubNow = { ...pubNow, publishedAt: 'v2', topics: [pubNow.topics[0], { ...pubNow.topics[1], entries: [...pubNow.topics[1].entries, { id: 'n2', title: 'Ribosomes', definition: 'Make proteins', notes: [] }] }] };
  await f.reload(); await f.waitForSelector('#toast.show');
  const toastText = await f.textContent('#toast');
  const fd = () => f.evaluate(() => JSON.parse(localStorage.getItem('bio-study-notes-v1')));
  let d1 = await fd();
  const ent = (d, id) => d.topics.flatMap((t) => t.entries).find((e) => e.id === id);
  const merged = !!ent(d1, 'n2') && ent(d1, 'n1').definition === 'MY VERSION' && !!ent(d1, 'm1');
  // Settings → keep separate.
  await f.click('.more:not(.topic-menu) summary'); await f.click('#btn-settings'); await f.check('#set-separate'); await f.click('#set-save');
  await f.waitForFunction(() => document.querySelector('#topics')?.textContent.includes('Personal'));
  const rootsSep = await f.$$eval('#topics > .node > .topic .nm', (x) => x.map((e) => e.textContent).join('|'));
  d1 = await fd();
  const sepOk = ent(d1, 'dm-n1')?.definition === 'Controls the cell' && ent(d1, 'n1').definition === 'MY VERSION' && !!ent(d1, 'm1');
  // …and back to merged.
  await f.click('.more:not(.topic-menu) summary'); await f.click('#btn-settings'); await f.uncheck('#set-separate'); await f.click('#set-save');
  await f.waitForFunction(() => !document.querySelector('#topics')?.textContent.includes('Personal'));
  const rootsBack = await f.$$eval('#topics > .node > .topic .nm', (x) => x.map((e) => e.textContent).join('|'));
  console.log('friend toast', toastText, '| merged', merged, '| separate', rootsSep, sepOk, '| back', rootsBack);
  const friendOk = merged && /1 new/.test(toastText) && /kept your version of 1/.test(toastText) && rootsSep === "Personal|Donut-Man's notes" && sepOk && rootsBack === 'Headstart|My own';

  console.log('worker', codes, worker, '| new visitor', newVisitor, '| published', published, '| existing keeps', keeps, '| errors', errs.length);
  const ok = friendOk && worker && newVisitor === 'Dashboard|Enzymes – é ✓' && published && keeps === 'Dashboard|My own' && !errs.length;
  console.log(ok ? 'publish ok' : 'publish FAILED ' + errs.join('; '));
  await b.close();
})();
