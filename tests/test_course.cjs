// The Course page (study design & work plan): the Worker with a fake GitHub, then the app as the owner and as a friend.
// Same file in bio-study and Specialist-Study.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
const SPEC = fs.existsSync(path.join(ROOT, 'lib.js'));
const BASE = `http://localhost:${SPEC ? 8767 : 8766}/`;
(async () => {
  const { handleApi } = await import(path.join(ROOT, 'worker', 'api.js'));
  // A fake GitHub contents API (any repo), remembering files; never the real one.
  const files = new Map(); let n = 0; const log = [];
  const ghFetch = async (url, opts = {}) => {
    const u = new URL(String(url)), m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+\/contents\/(.+)$/);
    if (u.host !== 'api.github.com' || !m) throw new Error('unexpected fetch ' + url);
    if (opts.headers?.authorization !== 'Bearer ghp_test') return new Response('{}', { status: 401 });
    const p = decodeURIComponent(m[1]), have = files.get(p);
    if (opts.method === 'PUT' || opts.method === 'DELETE') {
      const b = JSON.parse(opts.body); log.push(`${opts.method} ${p}`);
      if (have && b.sha !== have.sha) return new Response('{}', { status: 409 });
      if (opts.method === 'DELETE') { if (!have) return new Response('{}', { status: 404 }); files.delete(p); return Response.json({}); }
      files.set(p, { sha: `sha${++n}`, b64: b.content }); return Response.json({ commit: {} });
    }
    if (!have) return new Response('{}', { status: 404 });
    if (opts.headers?.accept === 'application/vnd.github.raw+json') return new Response(Buffer.from(have.b64, 'base64'));
    return Response.json({ sha: have.sha });
  };
  const nodeFetch = globalThis.fetch; globalThis.fetch = ghFetch;
  const env = { GITHUB_TOKEN: 'ghp_test', APP_PASSCODE: 'pw' };
  const checks = []; const check = (name, ok) => checks.push(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  const api = (body, pass) => handleApi(new Request('http://x/api/course', { method: body ? 'POST' : 'GET', body: body && JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...(pass ? { 'x-passcode': pass } : {}) } }), env);
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF').toString('base64');

  check('empty to start', JSON.stringify(await (await api()).json()).includes('"design":[]'));
  check('uploading needs the passcode', (await api({ action: 'add', kind: 'design', name: 'SD', type: 'application/pdf', data: pdf })).status === 401);
  check('only PDFs and pictures, and only the two kinds', (await api({ action: 'add', kind: 'design', name: 'x', type: 'text/html', data: 'PGI+' }, 'pw')).status === 400
    && (await api({ action: 'add', kind: 'secret', name: 'x', type: 'application/pdf', data: pdf }, 'pw')).status === 400);
  let r = await (await api({ action: 'add', kind: 'design', name: 'Study design 2027', type: 'application/pdf', data: pdf }, 'pw')).json();
  const f = r.course.design[0];
  check('a study design is saved under course/', f?.name === 'Study design 2027' && files.has(`course/${f.file}`) && files.has('course/index.json'));
  const served = await handleApi(new Request(`http://x/course/${f.file}`), env);
  check('and served back', served.status === 200 && served.headers.get('content-type') === 'application/pdf' && (await served.text()).startsWith('%PDF'));
  check('odd file names are refused', (await handleApi(new Request('http://x/course/../index.json'), env)).status === 404);
  await api({ action: 'add', kind: 'plan', name: 'Term 1 plan', type: 'image/png', data: 'iVBORw0KGgo=' }, 'pw');
  r = await (await api({ action: 'remove', kind: 'plan', id: (await (await api()).json()).plan[0].id }, 'pw')).json();
  check('removing takes it off the list and deletes the file', r.course.plan.length === 0 && ![...files.keys()].some((k) => k.startsWith('course/plan-')) && r.course.design.length === 1);

  // The app.
  const b = await chromium.launch(); const errs = [];
  async function page(owner) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'pw' : undefined));
    await p.route(/\/(api|course|photo)\//, async (route) => {
      const q = route.request();
      if (!/\/api\/course|\/course\//.test(q.url())) return route.fulfill({ status: 404, body: '{}' });
      const res = await handleApi(new Request(q.url(), { method: q.method(), headers: q.headers(), body: q.method() === 'POST' ? q.postData() : undefined }), env);
      route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
    });
    await p.route(/fonts\.g/, (x) => x.abort());
    await p.goto(BASE);
    if (owner) { await p.evaluate((spec) => localStorage.setItem(spec ? 'specialist-study-pass' : 'bio-study-passcode', spec ? '"pw"' : 'pw'), SPEC); await p.reload(); }
    return p;
  }
  const o = await page(true);
  await o.waitForSelector('a.c-link'); await o.click('a.c-link'); await o.waitForSelector('.c-tabs');
  check('owner: the Course page shows the study design', (await o.textContent('.c-file')).includes('Study design 2027') && !!(await o.$('iframe.c-doc')));
  await o.click('[data-ctab="plan"]');
  const tmp = path.join(require('os').tmpdir(), 'Work plan T1.pdf'); fs.writeFileSync(tmp, Buffer.from(pdf, 'base64'));
  await o.setInputFiles('#c-file', tmp);
  await o.waitForFunction(() => document.querySelector('.c-file')?.textContent.includes('Work plan T1'));
  const idx = JSON.parse(Buffer.from(files.get('course/index.json').b64, 'base64').toString());
  check('owner: uploading a work plan saves it', idx.plan.length === 1 && idx.plan[0].name === 'Work plan T1');
  check('owner: Course is in the sidebar with a count', (await o.textContent('#topics [data-course]')).includes('2'));
  const fr = await page(false);
  await fr.goto(BASE + '#/course'); await fr.waitForSelector('.c-file');
  check('friend: sees the documents but can’t upload or remove', !(await fr.$('#c-file')) && !(await fr.$('[data-cdel]')) && (await fr.textContent('.c-file')).includes('Study design 2027'));
  await b.close(); globalThis.fetch = nodeFetch;
  console.log(checks.join('\n')); console.log('errors:', errs);
  console.log(checks.every((c) => c.startsWith('ok')) && !errs.length ? 'course ok' : 'course FAILED');
})();
