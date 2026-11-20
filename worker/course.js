// The course documents: the study design (what's learnt across the year) and the work plan (when).
// Same file in bio-study, Specialist-Study and Methods-study. Saved in the repo under course/ with the GITHUB_TOKEN secret.
//   GET  /api/course          – the list: { design: [file…], plan: [file…], updatedAt }   (anyone)
//   POST /api/course          – {action:'add', kind, name, type, data(base64)} or {action:'remove', kind, id}  (APP_PASSCODE)
//   GET  /course/<file>       – a saved document (anyone)
// file = { id, name, file, type, size, added }
const KINDS = ['design', 'plan'];
const TYPES = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const INDEX = 'course/index.json';
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const cache = () => (typeof caches !== 'undefined' && caches.default) || null;

function gh(env, repo) {
  const api = `https://api.github.com/repos/${repo}/contents/`;
  const headers = (extra = {}) => ({ authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json',
    'user-agent': 'study-app', 'x-github-api-version': '2022-11-28', ...extra });
  const fail = (res) => { const e = new Error(`github ${res.status}`); e.status = res.status; throw e; };
  return {
    async meta(path) { const r = await fetch(api + path + '?ref=main', { headers: headers() }); if (r.status === 404) return null; if (!r.ok) fail(r); return r.json(); },
    async raw(path) { const r = await fetch(api + path + '?ref=main', { headers: headers({ accept: 'application/vnd.github.raw+json' }) }); if (r.status === 404) return null; if (!r.ok) fail(r); return r; },
    async put(path, content, message, sha) {
      const r = await fetch(api + path, { method: 'PUT', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ message, content, branch: 'main', ...(sha ? { sha } : {}) }) });
      if (!r.ok) fail(r); return r.json();
    },
    async del(path, message, sha) {
      const r = await fetch(api + path, { method: 'DELETE', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ message, sha, branch: 'main' }) });
      if (!r.ok && r.status !== 404) fail(r);
    },
  };
}
const b64text = (text) => { const b = new TextEncoder().encode(text); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const empty = () => ({ design: [], plan: [], updatedAt: null });

async function readIndex(g) {
  const meta = await g.meta(INDEX);
  if (!meta) return { sha: undefined, index: empty() };
  const text = await (await g.raw(INDEX)).text();
  return { sha: meta.sha, index: { ...empty(), ...JSON.parse(text) } };
}

export async function course(request, env, repo) {
  const path = new URL(request.url).pathname;
  const key = `https://study-app.cache/${repo}/`;
  if (path.startsWith('/course/')) {
    const name = path.slice('/course/'.length);
    if (!/^(design|plan)-[a-z0-9]{6,30}\.(pdf|jpg|png|webp)$/.test(name)) return new Response('Not found', { status: 404 });
    const hit = await cache()?.match(key + name); if (hit) return hit;
    if (!env.GITHUB_TOKEN) return new Response('Not found', { status: 404 });
    try {
      const r = await gh(env, repo).raw(`course/${name}`);
      if (!r) return new Response('Not found', { status: 404 });
      const ext = name.split('.').pop();
      const type = Object.keys(TYPES).find((t) => TYPES[t] === ext);
      const out = new Response(await r.arrayBuffer(), { headers: { 'content-type': type, 'cache-control': 'public, max-age=31536000, immutable', 'content-disposition': 'inline' } });
      await cache()?.put(key + name, out.clone());
      return out;
    } catch { return new Response('Not available', { status: 502 }); }
  }
  // /api/course
  if (!env.GITHUB_TOKEN) return request.method === 'GET' ? json(empty()) : json({ error: 'not-set-up' }, 503);
  const g = gh(env, repo);
  if (request.method === 'GET') {
    const hit = await cache()?.match(key + 'index'); if (hit) return hit;
    try {
      const { index } = await readIndex(g);
      const out = new Response(JSON.stringify(index), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=20' } });
      await cache()?.put(key + 'index', out.clone());
      return out;
    } catch (e) { return json({ error: 'github', status: e.status }, 502); }
  }
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  if (!env.APP_PASSCODE) return json({ error: 'not-set-up' }, 503);
  if (request.headers.get('x-passcode') !== env.APP_PASSCODE) return json({ error: 'passcode' }, 401);
  if (Number(request.headers.get('content-length') || 0) > 30e6) return json({ error: 'too-big' }, 413);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad-request' }, 400); }
  const kind = body?.kind;
  if (!KINDS.includes(kind)) return json({ error: 'bad-request' }, 400);
  try {
    let file = null, gone = null;
    if (body.action === 'add') {
      const ext = TYPES[body.type], data = String(body.data || '');
      if (!ext || !data) return json({ error: 'bad-request' }, 400);
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      file = { id, name: String(body.name || 'Document').replace(/\s+/g, ' ').trim().slice(0, 120), file: `${kind}-${id}.${ext}`,
        type: body.type, size: Math.round(data.length * 0.75), added: new Date().toISOString().slice(0, 10) };
      await g.put(`course/${file.file}`, data, `App: add ${kind === 'design' ? 'study design' : 'work plan'} “${file.name}”`);
    } else if (body.action !== 'remove') return json({ error: 'bad-request' }, 400);
    // Update the list (retrying if something else saved at the same moment).
    for (let tries = 0; ; tries++) {
      const { sha, index } = await readIndex(g);
      if (file) index[kind].push(file);
      else {
        gone = index[kind].find((f) => f.id === body.id);
        if (!gone) return json({ ok: true, course: index });
        index[kind] = index[kind].filter((f) => f !== gone);
      }
      index.updatedAt = new Date().toISOString();
      try {
        await g.put(INDEX, b64text(JSON.stringify(index, null, 1)), `App: ${file ? 'add' : 'remove'} course document`, sha);
        await cache()?.delete(key + 'index');
        if (gone) { const m = await g.meta(`course/${gone.file}`); if (m) await g.del(`course/${gone.file}`, `App: remove “${gone.name}”`, m.sha); }
        return json({ ok: true, course: index });
      } catch (e) { if ((e.status === 409 || e.status === 422) && tries < 3) continue; throw e; }
    }
  } catch (e) {
    return json({ error: e.status === 401 || e.status === 403 ? 'bad-token' : 'github', status: e.status }, 502);
  }
}
