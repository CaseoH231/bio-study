// Publishing: the owner's notes, saved to GitHub as published/notes.json.
//   POST /api/publish   – needs the APP_PASSCODE (always – an address match isn't enough, because this changes
//                         what everyone sees). Commits the notes with the GITHUB_TOKEN secret.
//   GET  /api/published – the latest published notes (anyone): new visitors start with these.
// GITHUB_TOKEN: a fine-grained GitHub token with "Contents: Read and write" on this repository only.
import { json } from './organise.js';

const REPO = 'CaseoH231/bio-study';
const FILE = 'published/notes.json';
const API = `https://api.github.com/repos/${REPO}/contents/${FILE}`;
const gh = (env, extra = {}) => ({
  ...extra,
  headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'bio-study-notes', 'x-github-api-version': '2022-11-28', ...extra.headers },
});
// Base64 of UTF-8 text, in chunks (the notes can be a few MB with drawings in them).
function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
const cache = () => (typeof caches !== 'undefined' && caches.default) || null;
const CACHE_KEY = 'https://bio-study.cache/published-notes';

export async function publish(request, env) {
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  if (!env.GITHUB_TOKEN || !env.APP_PASSCODE) return json({ error: 'not-set-up' }, 503);
  if (request.headers.get('x-passcode') !== env.APP_PASSCODE) return json({ error: 'passcode' }, 401);
  if (Number(request.headers.get('content-length') || 0) > 20e6) return json({ error: 'too-big' }, 413);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad-request' }, 400); }
  const notes = body?.notes;
  if (!notes || !Array.isArray(notes.topics)) return json({ error: 'bad-request' }, 400);
  const count = notes.topics.reduce((n, t) => n + (Array.isArray(t.entries) ? t.entries.length : 0), 0);

  // The file's current version is needed to replace it.
  const now = await fetch(API, gh(env));
  if (now.status === 401 || now.status === 403) return json({ error: 'bad-token' }, 502);
  const sha = now.ok ? (await now.json()).sha : undefined;
  const put = await fetch(API, gh(env, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: `Publish notes from the app (${count} notes, ${notes.topics.length} topics)`,
      content: toBase64(JSON.stringify({ ...notes, publishedAt: new Date().toISOString() }, null, 1)),
      branch: 'main',
      ...(sha ? { sha } : {}),
    }),
  }));
  if (put.status === 401 || put.status === 403) return json({ error: 'bad-token' }, 502);
  if (!put.ok) return json({ error: 'github', status: put.status }, 502);
  const done = await put.json();
  await cache()?.delete(CACHE_KEY);
  return json({ ok: true, commit: done.commit?.html_url || '', count });
}

export async function published(request, env) {
  if (!env.GITHUB_TOKEN) return json({ error: 'none' }, 404);
  const hit = await cache()?.match(CACHE_KEY);
  if (hit) return hit;
  const res = await fetch(API, gh(env, { headers: { accept: 'application/vnd.github.raw+json' } }));
  if (!res.ok) return json({ error: 'none' }, 404);
  const text = await res.text();
  const out = new Response(text, { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=120' } });
  await cache()?.put(CACHE_KEY, out.clone());
  return out;
}
