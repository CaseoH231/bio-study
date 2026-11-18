// Scanning photos of notes: the Worker's checks (no API key, wrong passcode, bad input) and the app's review-and-add flow,
// with the note reader's answer faked so no real API call is made.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const { organise } = await import(path.join(__dirname, '..', 'worker', 'organise.js'));
  const call = (env, body, headers = {}) => organise(new Request('http://x/api/organise', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }), env);
  const img = { media_type: 'image/jpeg', data: 'AAAA' };
  const fakeAI = (reply) => ({ run: async (model, input) => { fakeAI.last = { model, input }; if (reply instanceof Error) throw reply; return reply; } });
  const freeReply = { choices: [{ message: { content: '```json\n{"summary":"ok","new_topics":[],"notes":[{"topic":"t-animal","title":"Lysosomes","definition":"d","key_points":["p"],"found_in":"","diagram":"lysosome","filled":false,"drawing":null}],"unreadable":[]}\n```' } }] };
  const free = await call({ AI: fakeAI(freeReply) }, { images: [img], tree: [] });
  const freeBody = await free.json();
  const worker = [
    (await call({}, { images: [img] })).status,                                                       // 503 no reader at all
    (await call({ ANTHROPIC_API_KEY: 'k' }, { images: [img] })).status,                               // 503 Claude without a passcode
    (await call({ ANTHROPIC_API_KEY: 'k', APP_PASSCODE: 'pw' }, { images: [img] })).status,           // 401 no passcode sent
    (await call({ ANTHROPIC_API_KEY: 'k', APP_PASSCODE: 'pw' }, { images: [] }, { 'x-passcode': 'pw' })).status, // 400 no images
    (await call({ ANTHROPIC_API_KEY: 'k', APP_PASSCODE: 'pw' }, { images: [{ media_type: 'text/html', data: 'x' }] }, { 'x-passcode': 'pw' })).status, // 400 bad type
    free.status,                                                                                      // 200 free reader, no passcode needed
    (await call({ AI: fakeAI(freeReply), APP_PASSCODE: 'pw' }, { images: [img] })).status,            // 401 free reader with a passcode set
    (await call({ AI: fakeAI(new Error('4006: you have used up your daily free allocation of 10,000 neurons')) }, { images: [img] })).status, // 429
  ].join(',');
  const freeOk = freeBody.reader === 'free' && freeBody.plan.notes[0].title === 'Lysosomes' && fakeAI.last.model.includes('gemma')
    && fakeAI.last.input.messages[1].content.some((c) => c.type === 'image_url' && c.image_url.url.startsWith('data:image/jpeg;base64,'));

  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept('pw'));
  let sent = null, calls = 0;
  await p.route('**/api/organise', async (route) => {
    calls++; sent = route.request().postDataJSON();
    if (route.request().headers()['x-passcode'] !== 'pw') return route.fulfill({ status: 401, json: { error: 'passcode' } });
    return route.fulfill({ json: { plan: {
      summary: 'Found 3 notes.', unreadable: [],
      new_topics: [{ key: 'new-1', name: 'Cell transport', parent: 't-headstart' }, { key: 'new-2', name: 'Diffusion bits', parent: 'new-1' }, { key: 'new-3', name: 'Unused', parent: null }],
      notes: [
        { topic: 'new-2', title: 'Diffusion', definition: 'Particles spreading out.', key_points: ['high to low'], found_in: '', diagram: 'none', filled: false, drawing: { page: 1, x0: 100, y0: 100, x1: 500, y1: 400 } },
        { topic: 't-animal', title: 'lysosomes', definition: 'ignored', key_points: ['from photo'], found_in: '', diagram: 'none', filled: false, drawing: null },
        { topic: 'nonsense', title: 'Stray', definition: 'Somewhere.', key_points: [], found_in: '', diagram: 'none', filled: true, drawing: null },
      ] } } });
  });
  await p.route('**/api/whoami', (route) => route.fulfill({ json: { owner: true, ai: true, locked: false, hasPasscode: false } }));
  await p.goto('http://localhost:8766/');
  await p.click('#btn-scan');
  await p.setInputFiles('#scan-files', path.join(__dirname, '..', 'img', 'er.jpg'));
  await p.click('#scan-go'); await p.waitForSelector('.plan-note');
  const thumbs = await p.locator('.pn-draw').count();
  await p.click('#plan-go');
  await p.waitForFunction(() => document.querySelector('.bar h2')?.textContent.includes('Diffusion bits'));
  const crumbs = (await p.textContent('.crumbs')).replace(/\s+/g, ' ');
  const data = await p.evaluate(() => JSON.parse(localStorage.getItem('bio-study-notes-v1')));
  const byName = (n) => data.topics.find((t) => t.name === n);
  const diffusion = byName('Diffusion bits')?.entries[0];
  const lyso = byName('Animal cells').entries.find((e) => e.title === 'Lysosomes');
  const stray = byName('From my photos')?.entries[0];
  await p.evaluate(() => localStorage.clear());
  console.log('worker', worker, '| free reader', freeOk, '| calls', calls, '| sent pages', sent.images.length, '| tree size', sent.tree.length, '| thumbs', thumbs, '| crumbs', crumbs,
    '| drawing kept', !!diffusion?.image, '| lyso def kept', lyso.definition.startsWith('Release'), '| lyso point', lyso.notes.includes('from photo'),
    '| stray', stray?.title, stray?.filled, '| unused topic made', !!byName('Unused'), '| errors', errs.length);
  const ok = worker === '503,503,401,400,400,200,401,429' && freeOk && calls === 2 && sent.images.length === 1 && sent.tree.length >= 4 && thumbs === 1 &&
    crumbs.includes('Headstart › Cell transport › Diffusion bits') && diffusion?.image.startsWith('data:image/jpeg') &&
    lyso.definition.startsWith('Release') && lyso.notes.includes('from photo') && stray?.title === 'Stray' && stray.filled === true &&
    !byName('Unused') && !errs.length;
  console.log(ok ? 'scan ok' : 'scan FAILED ' + errs.join('; '));
  await b.close();
})();
