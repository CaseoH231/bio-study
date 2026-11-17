import { STARTER } from './data.js';
import { PRESETS } from './presets.js';
import { REFS } from './refs.js';
import { DIAGRAMS, DIAGRAM_WORDS, CELLS, diagramSVG, cellSVG } from './diagrams.js';

// ---------- saving ----------
const KEY = 'bio-study-notes-v1';
const PALETTE = ['#16a34a', '#2563eb', '#db2777', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#4d7c0f'];
const clone = (o) => JSON.parse(JSON.stringify(o));

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.topics)) return d;
  } catch { /* first visit or storage blocked */ }
  return clone(STARTER);
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); return true; } catch {
    toast('Could not save – your device storage is full. Try a smaller picture, or download a backup.');
    return false;
  }
}

let db = load();
if (upgradeStarter(db)) save();

// When the starter notes change, update anyone who still has the old ones. Topics people added themselves are kept.
//   starter 1 → the untouched "Cell organelles" topic is swapped for the notebook notes
//   starter 2 → the three notebook topics move inside a "Headstart" topic
function upgradeStarter(d) {
  const from = d.starter || 1;
  if (from >= STARTER.starter) return false;
  const fresh = clone(STARTER).topics;
  if (from < 2) {
    const old = d.topics.find((t) => t.id === 't-organelles');
    if (!old || old.entries.every((e) => e.id.startsWith('e-'))) {
      d.topics = [...fresh, ...d.topics.filter((t) => t.id !== 't-organelles')];
    }
  }
  if (!d.topics.some((t) => t.id === 't-headstart')) {
    const mine = d.topics.filter((t) => ['t-plant', 't-shared', 't-animal'].includes(t.id));
    if (mine.length) {
      d.topics.unshift(fresh.find((t) => t.id === 't-headstart'));
      mine.forEach((t) => { if (!t.parent) t.parent = 't-headstart'; });
    }
  }
  d.starter = STARTER.starter;
  return true;
}
const HOME = '__home';
let current = HOME;
let query = '';
let cellKind = 'animal';
let noteId = null; // the note whose page is open, if any

// ---------- helpers ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const topicOf = (id) => db.topics.find((t) => t.id === id);
const all = () => db.topics.flatMap((t) => t.entries.map((e) => ({ e, t })));
// Topics form a tree: each topic may have a `parent` (another topic's id). No parent = top level.
const kids = (id = null) => db.topics.filter((t) => (t.parent || null) === id);
const below = (id) => kids(id).flatMap((t) => [t, ...below(t.id)]); // every sub-topic, all the way down
const notesIn = (t) => [t, ...below(t.id)].flatMap((x) => x.entries.map((e) => ({ e, t: x })));
const ancestors = (t) => { const out = []; for (let x = topicOf(t.parent); x; x = topicOf(x.parent)) out.unshift(x); return out; };
const pathOf = (t) => [...ancestors(t), t].map((x) => x.name).join(' › ');
const treeOrder = (id = null, depth = 0) => kids(id).flatMap((t) => [{ t, depth }, ...treeOrder(t.id, depth + 1)]);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const OPEN_KEY = 'bio-study-open-folders';
let openFolders = new Set();
try { openFolders = new Set(JSON.parse(localStorage.getItem(OPEN_KEY)) || []); } catch { /* fine – all folders start closed */ }
const saveOpen = () => { try { localStorage.setItem(OPEN_KEY, JSON.stringify([...openFolders])); } catch { /* only a convenience */ } };
const FOLDER = '<svg class="fold" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2.2h8.4A1.5 1.5 0 0 1 21 8.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z"/></svg>';
const find = (id) => all().find((x) => x.e.id === id);
const colorOf = (e, t) => e.color || DIAGRAMS[e.diagram]?.color || t.color;
const checkTag = (e) => (e.filled ? '<span class="chip warn" title="Not in your notebook yet – check it against your notes">Added for you – check it</span>' : '');
const chips = (found) => (found || '').split(',').map((s) => s.trim()).filter(Boolean).map((s) => `<span class="chip">${esc(s)}</span>`).join('');
const dlg = $('#dlg');

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('show'), 3200);
}
function openDialog(html, cls = '') {
  dlg.className = cls; dlg.innerHTML = html;
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
}
dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });

// ---------- main screen ----------
function navTree(id = null, depth = 0) {
  const trail = current === HOME ? [] : [...ancestors(topicOf(current) || {}), topicOf(current)].filter(Boolean).map((t) => t.id);
  return kids(id).map((t) => {
    const ch = kids(t.id).length;
    const open = ch && (openFolders.has(t.id) || trail.includes(t.id));
    return `<div class="node"><button class="topic ${t.id === current && !query ? 'on' : ''}" data-topic="${t.id}" style="--c:${t.color};--d:${depth}">
      <span class="tw" ${ch ? `data-toggle="${t.id}" title="${open ? 'Close' : 'Open'}"` : ''}>${ch ? (open ? '▾' : '▸') : ''}</span>
      <span class="dot"></span><span class="nm">${esc(t.name)}</span><span class="n">${notesIn(t).length}</span></button>
      ${open ? navTree(t.id, depth + 1) : ''}</div>`;
  }).join('');
}

function render() {
  if (current !== HOME && !topicOf(current)) current = HOME;
  const notes = all();
  $('#sub').textContent = `${plural(notes.length, 'note')} · ${plural(db.topics.length, 'topic')}`;
  $('#topics').innerHTML = `<button class="topic home ${current === HOME && !query ? 'on' : ''}" data-topic="${HOME}"><span class="ico">⌂</span><span class="nm">Dashboard</span></button>
    <div class="nav-label">Topics</div>${navTree()}<button class="topic add" id="add-topic">+ New topic</button>`;

  const main = $('#main');
  if (query) {
    const q = query.toLowerCase();
    const hits = all().filter(({ e }) => [e.title, e.definition, e.found, ...(e.notes || [])].join(' ').toLowerCase().includes(q));
    main.innerHTML = `<div class="bar"><h2>Search</h2></div><p class="lead">${plural(hits.length, 'note')} matching “${esc(query)}”</p>` +
      (hits.length ? `<div class="grid">${hits.map(({ e, t }) => card(e, t, true)).join('')}</div>` : '<p class="empty">Nothing found.</p>');
    return;
  }
  if (noteId && find(noteId)) { main.innerHTML = notePage(); return bindNote(); }
  if (current === HOME) { main.innerHTML = dashboard(); return; }
  const t = topicOf(current);
  const subs = kids(t.id);
  const hasCells = notesIn(t).some(({ e }) => ['nucleus', 'membrane', 'chloroplast', 'mitochondria', 'plasmid', 'wall', 'plasmodesmata'].includes(e.diagram));
  const total = notesIn(t).length;
  main.innerHTML = `
    <nav class="crumbs" aria-label="You are here"><a href="#/">Dashboard</a>${ancestors(t).map((a) =>
      ` <span>›</span> <a href="${hrefTopic(a.id)}">${esc(a.name)}</a>`).join('')} <span>›</span> <b>${esc(t.name)}</b></nav>
    <div class="bar" style="--c:${t.color}"><h2><span class="tdot"></span>${esc(t.name)}</h2><div class="tools">
      <details class="more topic-menu"><summary aria-label="Topic options">⋯</summary><div class="menu">
        <button data-act="rename-topic">Rename</button><button data-act="colour-topic">Change colour</button>
        <button data-act="move-topic">Move into another topic…</button><button class="danger" data-act="delete-topic">Delete topic…</button></div></details>
      <button data-act="sub-topic">+ Sub-topic</button><button class="primary" data-act="add">+ Add note</button></div></div>
    <p class="lead">${subs.length ? `${plural(subs.length, 'sub-topic')} · ` : ''}${plural(total, 'note')}${subs.length && t.entries.length ? ` (${t.entries.length} here)` : ''}</p>
    ${subs.length ? `<h3 class="sect-h">Sub-topics</h3><div class="tgrid">${subs.map(folderCard).join('')}</div>` : ''}
    ${t.entries.length ? `${subs.length ? '<h3 class="sect-h">Notes</h3>' : ''}<div class="grid">${t.entries.map((e) => card(e, t)).join('')}</div>`
      : subs.length ? '' : `<div class="empty"><p>Nothing in this topic yet.</p><button class="primary" data-act="add">+ Add a note</button><button data-act="sub-topic">+ Sub-topic</button><button data-act="paste">Paste notes</button></div>`}
    ${hasCells ? explorer() : ''}`;
}

// A topic shown as a folder tile, like a chapter.
function folderCard(t) {
  const subs = kids(t.id), n = notesIn(t);
  const inside = subs.length ? subs.map((x) => x.name) : t.entries.map((e) => e.title);
  return `<a class="tcard" href="${hrefTopic(t.id)}" style="--c:${t.color}">
    <h3>${FOLDER}${esc(t.name)}</h3><span class="tn">${subs.length ? `${plural(subs.length, 'sub-topic')} · ` : ''}${plural(n.length, 'note')}</span>
    <div class="chips">${inside.slice(0, 5).map((x) => `<span class="chip">${esc(x)}</span>`).join('')}${inside.length > 5 ? `<span class="chip">+${inside.length - 5} more</span>` : ''}</div></a>`;
}

const stat = (v, l) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;

function dashboard() {
  const notes = all();
  const hr = new Date().getHours();
  const figs = notes.filter(({ e }) => DIAGRAMS[e.diagram] || e.image).length;
  const points = notes.reduce((n, { e }) => n + (e.notes?.length || 0), 0);
  const recent = [...notes].reverse().slice(0, 6);
  const toCheck = notes.filter(({ e }) => e.filled);
  return `<div class="bar"><h2>Dashboard</h2><div class="tools"><button data-act="new-topic">+ New topic</button><button class="primary" data-act="add">+ Add note</button></div></div>
    <section class="hero"><div class="hello"><h2>${hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'}</h2>
      <p>${notes.length ? `You have ${notes.length} notes across ${db.topics.length} topic${db.topics.length === 1 ? '' : 's'}. Ready for a quick quiz?` : 'Add your first notes, or pick a ready-made topic.'}</p>
      <div class="row">${notes.length ? '<button class="primary" data-act="cards">Start flashcards</button>' : ''}<button data-act="paste">Paste my notes</button></div></div>
      <div class="hero-art">${cellSVG('plant')}<small>Click a part of the cell</small></div></section>
    <div class="stats">${stat(notes.length, 'notes')}${stat(db.topics.length, 'topics')}${stat(figs, 'with a diagram')}${stat(points, 'key points')}${stat(db.rounds || 0, 'flashcard rounds done')}</div>
    <h3 class="sect-h">Topics</h3>
    ${db.topics.length ? `<div class="tgrid">${kids().map(folderCard).join('')}
      <button class="tcard add" data-act="new-topic"><h3>+ New topic</h3><span class="tn">Ready-made or blank</span></button></div>`
    : '<div class="empty"><p>You have no topics yet.</p><button class="primary" data-act="new-topic">+ New topic</button></div>'}
    ${toCheck.length ? `<h3 class="sect-h">Check these against your notes <small class="where">(${toCheck.length})</small></h3>
      <p class="lead">I filled in these definitions for you. Open one and press Edit to put it in your own words – the yellow tag goes away when you save.</p>
      <div class="card-list"><ul class="list">${toCheck.map(({ e, t }) =>
      `<li><a class="lrow" href="${hrefNote(e.id)}"><b style="color:${colorOf(e, t)}">${esc(e.title)}</b><span>${esc(e.definition)}</span><small>${esc(pathOf(t))}</small></a></li>`).join('')}</ul></div>` : ''}
    ${recent.length ? `<h3 class="sect-h">Latest notes</h3><div class="card-list"><ul class="list">${recent.map(({ e, t }) =>
      `<li><a class="lrow" href="${hrefNote(e.id)}"><b style="color:${colorOf(e, t)}">${esc(e.title)}</b><span>${esc(e.definition)}</span><small>${esc(pathOf(t))}</small></a></li>`).join('')}</ul></div>` : ''}`;
}

// ---------- pages have addresses, so Back works and Ctrl-click opens a real new tab ----------
//   #/  dashboard      #/topic/<id>  a topic (folder)      #/note/<id>  one note
const hrefTopic = (id) => (id === HOME || !id ? '#/' : `#/topic/${encodeURIComponent(id)}`);
const hrefNote = (id) => `#/note/${encodeURIComponent(id)}`;
function go(hash) { if (location.hash === hash || (hash === '#/' && !location.hash)) route(); else location.hash = hash; }
function route() {
  const [, kind, raw] = location.hash.match(/^#\/(topic|note)\/(.+)$/) || [];
  const id = raw && decodeURIComponent(raw);
  query = ''; $('#search').value = ''; noteId = null;
  if (kind === 'note' && find(id)) { noteId = id; current = find(id).t.id; }
  else if (kind === 'topic' && topicOf(id)) enterTopic(id);
  else current = HOME;
  if (dlg.open) dlg.close();
  render(); window.scrollTo({ top: 0 });
}
window.addEventListener('hashchange', route);

const openTopic = (id) => go(hrefTopic(id));
const openDetail = (id) => go(hrefNote(id));
const crumbsFor = (t) => `<a href="#/">Dashboard</a>${[...ancestors(t), t].map((a) => ` <span>›</span> <a href="${hrefTopic(a.id)}">${esc(a.name)}</a>`).join('')}`;

function enterTopic(id) {
  current = id;
  const t = topicOf(id);
  if (t) {
    if (kids(t.id).length) { openFolders.add(t.id); saveOpen(); }
    const own = t.entries.length ? t.entries : notesIn(t).map((x) => x.e);
    cellKind = own.some((e) => ['wall', 'chloroplast', 'vacuole', 'plasmodesmata', 'plantcell'].includes(e.diagram)) ? 'plant' : 'animal';
  }
}

// A textbook diagram from Wikimedia Commons, with its credit line.
const refFigure = (ref, alt) => `<figure class="ref"><img src="${ref.src}" alt="${esc(alt)}" loading="lazy">
  <figcaption>Diagram: <a href="${ref.page}" target="_blank" rel="noopener">${esc(ref.title)}</a> by ${esc(ref.by)} ·
  ${ref.licenseUrl ? `<a href="${ref.licenseUrl}" target="_blank" rel="noopener">${ref.license}</a>` : ref.license}, via Wikimedia Commons${ref.edited ? ` (${esc(ref.edited)})` : ''}</figcaption></figure>`;

function card(e, t, showTopic = false) {
  const ref = REFS[e.diagram];
  // A textbook diagram shared by several notes (e.g. the whole plant cell) would make their cards look the same,
  // so those cards use the note's own simple outline instead.
  const shared = ref && t.entries.filter((x) => REFS[x.diagram] === ref).length > 1;
  const thumb = ref && !(shared && DIAGRAMS[e.diagram]) ? `<img src="${ref.src}" alt="" loading="lazy">`
    : e.diagram && DIAGRAMS[e.diagram] ? diagramSVG(e.diagram, { labels: false })
    : e.image ? `<img src="${e.image}" alt="">` : `<span class="initial">${esc(e.title[0] || '?')}</span>`;
  return `<a class="card" href="${hrefNote(e.id)}" data-entry="${e.id}" style="--c:${colorOf(e, t)}">
    <div class="thumb">${thumb}</div>
    <div class="body"><h3>${esc(e.title)}</h3><p>${esc(e.definition)}</p>
    ${showTopic ? `<div class="where">${esc(pathOf(t))}</div>` : ''}<div class="chips">${checkTag(e)}${chips(e.found)}</div></div></a>`;
}

function explorer() {
  let shut = false;
  try { shut = localStorage.getItem('bio-study-explorer') === 'shut'; } catch { /* default open */ }
  return `<details class="explorer" ${shut ? '' : 'open'}><summary><h3>Cell explorer</h3><p>Click any part of a cell to open its notes.</p></summary>
    <div class="tabs">${Object.entries(CELLS).map(([k, c]) => `<button data-cell="${k}" class="${k === cellKind ? 'on' : ''}">${c.name}</button>`).join('')}</div>
    <div class="ex-svg">${cellSVG(cellKind)}</div><p class="ex-tip" id="ex-tip">&nbsp;</p></details>`;
}

function openPart(key, name) {
  const inTopic = topicOf(current) && notesIn(topicOf(current)).find((x) => x.e.diagram === key)?.e;
  const hit = inTopic || all().find((x) => x.e.diagram === key)?.e;
  if (hit) return openDetail(hit.id);
  toast(`No notes for “${name}” yet – add some!`);
  openEdit(null, { title: name, diagram: DIAGRAMS[key] ? key : '' });
}

$('#topics').addEventListener('click', (ev) => {
  const b = ev.target.closest('button');
  if (!b) return;
  if (b.id === 'add-topic') return openTopicPicker();
  const tog = ev.target.closest('[data-toggle]');
  if (tog) {
    const id = tog.dataset.toggle;
    const wasOpen = tog.textContent.trim() === '▾';
    if (wasOpen) openFolders.delete(id); else openFolders.add(id);
    saveOpen();
    if (wasOpen && (noteId || current !== id) && topicOf(current) && [...ancestors(topicOf(current)), topicOf(current)].some((a) => a.id === id) && current !== id) return openTopic(id); // don't hide where you are
    return render();
  }
  openTopic(b.dataset.topic);
});

$('#main').addEventListener('click', (ev) => {
  if (ev.target.closest('a[href^="#"]')) return; // links to topics and notes just change the address
  const tp = ev.target.closest('[data-topic]');
  if (tp) return openTopic(tp.dataset.topic);
  const tab = ev.target.closest('[data-cell]');
  if (tab) { cellKind = tab.dataset.cell; return render(); }
  const p = ev.target.closest('.part');
  if (p) return openPart(p.dataset.k, $('title', p).textContent);
  const act = ev.target.closest('[data-act]')?.dataset.act;
  const t = topicOf(current);
  ev.target.closest('details.topic-menu')?.removeAttribute('open');
  if (act === 'add') openEdit(null, { topic: current === HOME ? (all()[0]?.t.id || db.topics[0]?.id) : current });
  if (act === 'sub-topic') openTopicPicker(t.id);
  if (act === 'edit-note') openEdit(noteId);
  if (act === 'move-topic') openMove(t);
  if (act === 'paste') openPaste();
  if (act === 'cards') openCards();
  if (act === 'new-topic') openTopicPicker();
  if (act === 'rename-topic') {
    const n = prompt('New name for this topic:', t.name);
    if (n && n.trim()) { t.name = n.trim(); save(); render(); }
  }
  if (act === 'colour-topic') {
    t.color = PALETTE[(PALETTE.indexOf(t.color) + 1) % PALETTE.length]; save(); render();
  }
  if (act === 'delete-topic') {
    const gone = [t, ...below(t.id)], n = notesIn(t).length;
    const what = [gone.length > 1 && plural(gone.length - 1, 'sub-topic'), plural(n, 'note')].filter(Boolean).join(' and ');
    if (confirm(`Delete “${t.name}” and the ${what} inside it?`)) {
      db.topics = db.topics.filter((x) => !gone.includes(x)); save(); openTopic(t.parent || HOME);
    }
  }
});
$('#main').addEventListener('toggle', (ev) => {
  if (ev.target.matches?.('details.explorer')) try { localStorage.setItem('bio-study-explorer', ev.target.open ? 'open' : 'shut'); } catch { /* fine */ }
}, true);
$('#main').addEventListener('keydown', (ev) => {
  const p = ev.target.closest('.part');
  if (p && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openPart(p.dataset.k, $('title', p).textContent); }
});
$('#main').addEventListener('mouseover', (ev) => {
  const tip = $('#ex-tip') || $('.hero-art small');
  if (!tip) return;
  const p = ev.target.closest('.part');
  tip.textContent = p ? `${$('title', p).textContent} – click to open` : tip.closest('.hero-art') ? 'Click a part of the cell' : ' ';
});

function newTopic(name, parent = null) {
  if (!name || !name.trim()) return null;
  const t = { id: uid(), name: name.trim(), color: PALETTE[db.topics.length % PALETTE.length], entries: [] };
  if (parent) t.parent = parent;
  db.topics.push(t); save();
  return t;
}

// Move a topic (and everything inside it) into another topic, or to the top level.
function openMove(t) {
  const banned = new Set([t.id, ...below(t.id).map((x) => x.id)]);
  const opts = treeOrder().filter(({ t: x }) => !banned.has(x.id));
  openDialog(`
    <div class="dlg-head"><h2 class="grow">Move “${esc(t.name)}”</h2><button data-close aria-label="Close">✕</button></div>
    <div class="dlg-body form"><label>Put it inside <select id="move-to"><option value="">Top level (no parent)</option>
      ${opts.map(({ t: x, depth }) => `<option value="${x.id}" ${x.id === t.parent ? 'selected' : ''}>${'&nbsp;&nbsp;&nbsp;'.repeat(depth)}${esc(x.name)}</option>`).join('')}</select></label>
      <p class="where">Its sub-topics and notes move with it.</p></div>
    <div class="dlg-foot"><span class="grow"></span><button data-close>Cancel</button><button class="primary" id="move-go">Move</button></div>`, 'small');
  $('#move-go').onclick = () => {
    const to = $('#move-to').value;
    if (to) { t.parent = to; openFolders.add(to); saveOpen(); } else delete t.parent;
    save(); dlg.close(); render();
  };
}

// Pick a ready-made topic (with starter notes) or make a blank one.
function openTopicPicker(parent = null) {
  const has = (name) => kids(parent).find((t) => t.name.toLowerCase() === name.toLowerCase());
  const into = topicOf(parent);
  openDialog(`
    <div class="dlg-head"><h2 class="grow">${into ? `Add a sub-topic to “${esc(into.name)}”` : 'Add a topic'}</h2><button data-close aria-label="Close">✕</button></div>
    <div class="dlg-body">
      <h4 class="sect">Ready-made topics <small>– each comes with starter definitions you can edit</small></h4>
      <div class="presets">${PRESETS.map((p, i) => `<button class="preset" data-p="${i}" style="--c:${p.color}">
        <b>${esc(p.name)}</b><span>${esc(p.blurb)}</span>
        <small>${has(p.name) ? '✓ Added – click to fill in any missing notes' : `${p.entries.length} notes`}</small></button>`).join('')}</div>
      <h4 class="sect">Or start a blank topic</h4>
      <form id="blank-topic" class="blank-row"><input type="text" name="name" required placeholder="e.g. Ecology"><button class="primary">Create</button></form>
    </div>`, 'small');
  $$('.preset', dlg).forEach((b) => { b.onclick = () => addPreset(PRESETS[b.dataset.p], parent); });
  $('#blank-topic').onsubmit = (ev) => {
    ev.preventDefault();
    const t = newTopic(ev.target.name.value, parent);
    if (!t) return;
    dlg.close(); openTopic(t.id);
  };
}

function addPreset(p, parent = null) {
  let t = kids(parent).find((x) => x.name.toLowerCase() === p.name.toLowerCase());
  if (!t) { t = { id: uid(), name: p.name, color: p.color, entries: [] }; if (parent) t.parent = parent; db.topics.push(t); }
  let added = 0;
  for (const e of p.entries) {
    if (t.entries.some((x) => x.title.toLowerCase() === e.title.toLowerCase())) continue;
    t.entries.push({ id: uid(), ...e, notes: [...e.notes], diagram: '', image: '' });
    added++;
  }
  save(); dlg.close(); openTopic(t.id);
  toast(added ? `${p.name}: added ${added} note${added === 1 ? '' : 's'}` : `${p.name} already has all its notes`);
}

// ---------- one note, on its own page ----------
function notePage() {
  const { e, t } = find(noteId);
  const d = DIAGRAMS[e.diagram];
  const sib = t.entries, i = sib.indexOf(e);
  const prev = sib[i - 1], next = sib[i + 1];
  const ref = REFS[e.diagram];
  const hasFig = ref || d || e.image;
  return `<nav class="crumbs" aria-label="You are here">${crumbsFor(t)} <span>›</span> <b>${esc(e.title)}</b></nav>
    <article class="note-page" style="--c:${colorOf(e, t)}">
      <div class="bar"><h2>${esc(e.title)}</h2><div class="tools">
        <a class="btn" href="${hrefTopic(t.id)}">← ${esc(t.name)}</a><button class="primary" data-act="edit-note">Edit</button></div></div>
      <div class="chips">${checkTag(e)}${chips(e.found)}</div>
      <div class="d-body ${hasFig ? '' : 'textonly'}">
        <div class="d-text">
          <p class="def">${esc(e.definition) || '<i>No definition yet – press Edit to add one.</i>'}</p>
          ${e.notes?.length ? `<h4>Key points</h4><ul>${e.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
          ${d ? `<h4>Parts to know</h4><ol class="legend">${d.labels.map((l, j) => `<li data-i="${j}" style="--lc:${l[1]}"><b>${l[0]}</b> <span>– ${l[6]}</span></li>`).join('')}</ol>
            <label class="quiz-toggle"><input type="checkbox" id="hide-labels"> Test yourself: hide the part names (click one to reveal it)</label>` : ''}
        </div>
        ${hasFig ? `<div class="d-fig">
          ${ref ? refFigure(ref, `Diagram of ${e.title}`) : d ? `<div class="fig">${diagramSVG(e.diagram)}</div>` : ''}
          ${e.image ? `<figure class="myimg"><img src="${e.image}" alt="My diagram of ${esc(e.title)}"><figcaption>My own diagram</figcaption></figure>` : ''}
        </div>` : ''}
      </div>
      <div class="note-nav">
        ${prev ? `<a class="btn" data-go="prev" href="${hrefNote(prev.id)}">← ${esc(prev.title)}</a>` : '<span></span>'}
        <span class="where">${i + 1} of ${sib.length} in ${esc(t.name)}</span>
        ${next ? `<a class="btn" data-go="next" href="${hrefNote(next.id)}">${esc(next.title)} →</a>` : '<span></span>'}
      </div>
    </article>`;
}

// Hovering a label highlights it on the diagram; "hide the labels" turns it into a quiz.
function bindNote() {
  const page = $('.note-page'), svg = $('svg.dg', page);
  const hl = (j) => {
    if (!svg) return;
    svg.classList.toggle('hl', j != null);
    $$('.lb', svg).forEach((g) => g.classList.toggle('on', g.dataset.i === String(j)));
    $$('.legend li', page).forEach((li) => li.classList.toggle('hover', li.dataset.i === String(j)));
  };
  $$('.legend li', page).forEach((li) => {
    li.addEventListener('mouseenter', () => hl(li.dataset.i));
    li.addEventListener('mouseleave', () => hl(null));
    li.addEventListener('click', () => {
      li.classList.toggle('show');
      if (svg) $(`.lb[data-i="${li.dataset.i}"]`, svg)?.classList.toggle('show', li.classList.contains('show'));
    });
  });
  svg && $$('.lb', svg).forEach((g) => {
    g.addEventListener('mouseenter', () => hl(g.dataset.i));
    g.addEventListener('mouseleave', () => hl(null));
  });
  $('#hide-labels', page)?.addEventListener('change', (ev) => {
    page.classList.toggle('quiz', ev.target.checked);
    $$('.show', page).forEach((x) => x.classList.remove('show'));
  });
}

document.addEventListener('keydown', (ev) => {
  const typing = ev.target.matches('input, textarea, select');
  if (ev.key === '/' && !typing && !dlg.open) { ev.preventDefault(); $('#search').focus(); }
  if (ev.key === 'Escape' && ev.target.id === 'search' && query) { ev.target.value = ''; query = ''; render(); }
});
$('#search').placeholder = 'Search your notes…  ( / )';

// On a note page: ← → for the previous / next note, Esc to go back to its topic.
document.addEventListener('keydown', (ev) => {
  if (!noteId || dlg.open || query || ev.target.matches('input, textarea, select')) return;
  if (ev.key === 'ArrowLeft') $('[data-go=prev]')?.click();
  if (ev.key === 'ArrowRight') $('[data-go=next]')?.click();
  if (ev.key === 'Escape') openTopic(find(noteId)?.t.id);
});

// ---------- add / edit a note ----------
function topicOptions(selected) {
  return treeOrder().map(({ t, depth }) => `<option value="${t.id}" ${t.id === selected ? 'selected' : ''}>${'&nbsp;&nbsp;&nbsp;'.repeat(depth)}${esc(t.name)}</option>`).join('') +
    '<option value="__new">+ New topic…</option>';
}

function openEdit(id, preset = {}) {
  const hit = id ? find(id) : null;
  const e = hit ? hit.e : { title: '', definition: '', notes: [], found: '', diagram: '', image: '', ...preset };
  let image = e.image || '';
  const topicId = hit ? hit.t.id : preset.topic || current;
  openDialog(`
    <div class="dlg-head"><h2 class="grow">${hit ? 'Edit note' : 'Add a note'}</h2><button data-close aria-label="Close">✕</button></div>
    <form class="dlg-body form" id="edit-form">
      <div class="row2">
        <label>Name <input type="text" name="title" required value="${esc(e.title)}" placeholder="e.g. Mitochondria"></label>
        <label>Topic <select name="topic">${topicOptions(topicId)}</select></label>
      </div>
      <label>Definition <textarea name="definition" rows="3" placeholder="What it is / what it does">${esc(e.definition)}</textarea></label>
      <label>Key points <small>one per line</small><textarea name="notes" rows="4" placeholder="Has a double membrane&#10;Found in muscle cells">${esc((e.notes || []).join('\n'))}</textarea></label>
      <label>Found in <small>separate with commas</small><input type="text" name="found" value="${esc(e.found)}" placeholder="Animal, Plant"></label>
      <div class="row2">
        <label>Labelled diagram <select name="diagram"><option value="">None</option>
          ${Object.entries(DIAGRAMS).map(([k, d]) => `<option value="${k}" ${k === e.diagram ? 'selected' : ''}>${d.name}</option>`).join('')}</select></label>
        <label>Card colour <small>leave as is to use the diagram's colour</small>
          <input type="color" name="color" value="${e.color || DIAGRAMS[e.diagram]?.color || topicOf(topicId)?.color || '#16a34a'}"></label>
      </div>
      <div class="preview" id="dg-preview">${e.diagram ? diagramSVG(e.diagram) : ''}</div>
      <label>Your own picture <small>e.g. a photo of a diagram you drew</small>
        <div class="imgrow"><input type="file" accept="image/*" id="img-in"><span id="img-show">${image ? `<img src="${image}" alt="">` : ''}</span>
        <button type="button" class="link danger" id="img-rm" ${image ? '' : 'hidden'}>Remove picture</button></div></label>
    </form>
    <div class="dlg-foot">
      ${hit ? '<button class="danger" id="del">Delete note</button>' : ''}<span class="grow"></span>
      <button data-close>Cancel</button><button class="primary" id="save" form="edit-form">Save</button>
    </div>`, 'small');

  const f = $('#edit-form');
  const startColor = f.color.value;
  let colorTouched = !!e.color;
  f.color.addEventListener('input', () => { colorTouched = true; });
  f.diagram.addEventListener('change', () => {
    $('#dg-preview').innerHTML = f.diagram.value ? diagramSVG(f.diagram.value) : '';
    if (!colorTouched && DIAGRAMS[f.diagram.value]) f.color.value = DIAGRAMS[f.diagram.value].color;
  });
  f.title.addEventListener('change', () => {
    if (f.diagram.value) return;
    const m = DIAGRAM_WORDS.find(([re]) => re.test(f.title.value));
    if (m) { f.diagram.value = m[1]; f.diagram.dispatchEvent(new Event('change')); }
  });
  $('#img-in').addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    try { image = await shrinkImage(file); } catch { return toast('Sorry, that picture could not be opened.'); }
    $('#img-show').innerHTML = `<img src="${image}" alt="">`; $('#img-rm').hidden = false;
  });
  $('#img-rm').onclick = () => { image = ''; $('#img-show').innerHTML = ''; $('#img-rm').hidden = true; $('#img-in').value = ''; };
  if (hit) $('#del').onclick = () => {
    if (!confirm(`Delete “${e.title}”?`)) return;
    hit.t.entries = hit.t.entries.filter((x) => x !== e); save(); openTopic(hit.t.id);
  };
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const t = f.topic.value === '__new' ? newTopic(prompt('Name of the new topic:') ?? '') : topicOf(f.topic.value);
    if (!t) return toast('Pick a topic for this note.');
    const data = {
      title: f.title.value.trim(), definition: f.definition.value.trim(), found: f.found.value.trim(),
      notes: f.notes.value.split('\n').map((s) => s.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean),
      diagram: f.diagram.value, image,
      color: colorTouched && f.color.value !== startColor || e.color ? f.color.value : '',
    };
    let entry = e;
    if (hit) {
      Object.assign(e, data);
      delete e.filled; // once you've edited it, it's yours
      if (hit.t !== t) { hit.t.entries = hit.t.entries.filter((x) => x !== e); t.entries.push(e); }
    } else {
      entry = { id: uid(), ...data };
      t.entries.push(entry);
    }
    if (!save()) return;
    openDetail(entry.id);
    toast('Saved');
  });
  setTimeout(() => (hit ? null : f.title.focus()), 50);
}

// Make pictures small enough to keep in the browser's storage.
function shrinkImage(file, max = 1000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// ---------- paste a page of notes ----------
// Understands lines like "Nucleus: controls the cell" or "Nucleus - controls the cell",
// a name on its own line with the definition underneath, and bullet points ("- ...") as key points.
export function parseNotes(text) {
  const out = [];
  let cur = null, gap = true;
  const bullet = /^([-•*–]|\d+[.)])\s+/;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { gap = true; continue; }
    const isBullet = bullet.test(line);
    const m = !isBullet && line.match(/^([^:=]{1,50}?)\s*(?:[:=]|\s[-–—]\s)\s*(.+)$/);
    if (m) { cur = { title: m[1].trim(), definition: m[2].trim(), notes: [] }; out.push(cur); }
    else if (isBullet && cur) cur.notes.push(line.replace(bullet, ''));
    else if (gap || !cur) { cur = { title: line.replace(/[:\-–]\s*$/, '').replace(bullet, '').trim(), definition: '', notes: [] }; out.push(cur); }
    else if (!cur.definition) cur.definition = line;
    else cur.definition += ' ' + line;
    gap = false;
  }
  return out.filter((n) => n.title);
}

function openPaste() {
  openDialog(`
    <div class="dlg-head"><h2 class="grow">Paste your notes</h2><button data-close aria-label="Close">✕</button></div>
    <div class="dlg-body form">
      <p class="hint">Type or paste what you wrote down. Put each thing on its own line, like this:
        <code>Nucleus: contains DNA that controls the cell
- surrounded by a nuclear envelope
Ribosomes - where proteins are made</code>
        Lines starting with “-” become key points. If a name matches an organelle, its diagram is added for you.</p>
      <label>Add to topic <select id="paste-topic">${topicOptions(current)}</select></label>
      <label>Your notes <textarea id="paste-text" rows="10" placeholder="Mitochondria: where aerobic respiration happens"></textarea></label>
      <p id="paste-count" class="where">&nbsp;</p>
    </div>
    <div class="dlg-foot"><span class="grow"></span><button data-close>Cancel</button><button class="primary" id="paste-go">Add notes</button></div>`, 'small');
  const ta = $('#paste-text');
  ta.addEventListener('input', () => {
    const n = parseNotes(ta.value);
    $('#paste-count').textContent = n.length ? `Found ${n.length} note${n.length === 1 ? '' : 's'}: ${n.map((x) => x.title).join(', ')}` : ' ';
  });
  $('#paste-go').onclick = () => {
    const notes = parseNotes(ta.value);
    if (!notes.length) return toast('Nothing to add yet – type some notes first.');
    const sel = $('#paste-topic').value;
    const t = sel === '__new' ? newTopic(prompt('Name of the new topic:') ?? '') : topicOf(sel);
    if (!t) return;
    let added = 0, updated = 0;
    for (const n of notes) {
      const old = t.entries.find((x) => x.title.toLowerCase() === n.title.toLowerCase());
      if (old) {
        if (n.definition) old.definition = n.definition;
        old.notes = [...(old.notes || []), ...n.notes.filter((s) => !(old.notes || []).includes(s))];
        updated++;
      } else {
        const m = DIAGRAM_WORDS.find(([re]) => re.test(n.title));
        t.entries.push({ id: uid(), ...n, found: '', diagram: m ? m[1] : '', image: '' });
        added++;
      }
    }
    save(); openTopic(t.id);
    toast(`Added ${added} note${added === 1 ? '' : 's'}${updated ? `, updated ${updated}` : ''}`);
  };
  ta.focus();
}

// ---------- flashcards ----------
function openCards() {
  const withDef = all().filter(({ e }) => e.definition);
  if (!withDef.length) return toast('Add some notes with definitions first.');
  openDialog(`
    <div class="dlg-head"><h2 class="grow">Flashcards</h2><button data-close aria-label="Close">✕</button></div>
    <div class="dlg-body form">
      <label>Topic <small>– includes its sub-topics</small><select id="fc-topic"><option value="">All topics</option>${treeOrder().map(({ t, depth }) => `<option value="${t.id}" ${t.id === current ? 'selected' : ''}>${'&nbsp;&nbsp;&nbsp;'.repeat(depth)}${esc(t.name)}</option>`).join('')}</select></label>
      <label>Mode <select id="fc-mode">
        <option value="def">Read the definition → name it</option>
        <option value="name">Read the name → say the definition</option>
        <option value="diagram">See the diagram → name it</option></select></label>
    </div>
    <div class="dlg-foot"><span class="grow"></span><button class="primary" id="fc-start">Start</button></div>`, 'small');
  $('#fc-start').onclick = () => {
    const tid = $('#fc-topic').value, mode = $('#fc-mode').value;
    const pool = tid ? notesIn(topicOf(tid)) : all();
    let deck = pool.filter(({ e }) => (mode === 'diagram' ? DIAGRAMS[e.diagram] || e.image : e.definition));
    if (!deck.length) return toast(mode === 'diagram' ? 'No notes with diagrams in that topic.' : 'No notes with definitions in that topic.');
    deck = deck.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    runCards(deck, mode);
  };
}

function runCards(deck, mode) {
  const total = deck.length;
  let right = 0;
  const queue = [...deck];
  const show = (revealed) => {
    if (!queue.length) {
      db.rounds = (db.rounds || 0) + 1; save();
      openDialog(`<div class="dlg-head"><h2 class="grow">All done!</h2><button data-close aria-label="Close">✕</button></div>
        <div class="dlg-body" style="text-align:center"><p class="score">${right} / ${total}</p><p>You got ${right} right first go out of ${total} cards.</p></div>
        <div class="dlg-foot"><span class="grow"></span><button id="fc-again" class="primary">Go again</button></div>`, 'small');
      $('#fc-again').onclick = openCards;
      return;
    }
    const { e, t } = queue[0];
    const ref = REFS[e.diagram];
    const refOnlyHere = ref && all().filter((x) => REFS[x.e.diagram] === ref).length === 1;
    // An unlabelled outline gives nothing away; labelled pictures are the fallback.
    const fig = DIAGRAMS[e.diagram] ? `<div class="fig">${diagramSVG(e.diagram, { labels: false })}</div>`
      : refOnlyHere ? `<figure class="ref"><img src="${ref.src}" alt=""></figure>`
      : e.image ? `<figure class="myimg"><img src="${e.image}" alt=""></figure>` : '';
    const q = mode === 'def' ? esc(e.definition) : mode === 'name' ? `<b>${esc(e.title)}</b>` : `<p>Which organelle is this?</p>${fig}`;
    const a = mode === 'name' ? esc(e.definition) : esc(e.title);
    openDialog(`
      <div class="dlg-head"><h2 class="grow">Flashcards</h2><span class="where">${queue.length} left</span><button data-close aria-label="Close">✕</button></div>
      <div class="dlg-body"><div class="fc-bar"><div style="width:${((total - queue.length) / total) * 100}%"></div></div>
        <div class="fc" style="--c:${colorOf(e, t)}"><div><div class="q">${q}</div>${revealed ? `<div class="a">${a}</div>` : ''}</div></div></div>
      <div class="dlg-foot"><span class="grow"></span>
        ${revealed ? '<button id="fc-no">✗ Not yet</button><button class="primary" id="fc-yes">✓ Got it</button>' : '<button class="primary" id="fc-show">Show answer</button>'}</div>`, 'small');
    if (!revealed) return ($('#fc-show').onclick = () => show(true));
    $('#fc-yes').onclick = () => { if (!queue[0].missed) right++; queue.shift(); show(false); };
    $('#fc-no').onclick = () => { const c = queue.shift(); c.missed = true; queue.push(c); show(false); };
  };
  deck.forEach((c) => delete c.missed);
  show(false);
}

// ---------- header buttons ----------
$('#btn-paste').onclick = openPaste;
$('#btn-cards').onclick = openCards;
$('#search').addEventListener('input', (ev) => { query = ev.target.value.trim(); render(); });
$('#btn-export').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }));
  a.download = `bio-notes-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click(); URL.revokeObjectURL(a.href);
  $('.more').open = false;
};
$('#btn-import').onclick = () => $('#file-import').click();
$('#file-import').onchange = async (ev) => {
  const file = ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (!Array.isArray(d.topics)) throw new Error('bad');
    if (!confirm('Replace all your current notes with this backup?')) return;
    db = d; save(); go('#/'); toast('Backup loaded');
  } catch { toast('That file is not a Bio Study Notes backup.'); }
  $('.more').open = false;
};
$('#btn-reset').onclick = () => {
  if (!confirm('Throw away all your notes and go back to the notes from your notebook?')) return;
  db = clone(STARTER); save(); go('#/'); $('.more').open = false;
};
document.addEventListener('click', (ev) => { $$('details.more[open]').forEach((m) => { if (!m.contains(ev.target)) m.open = false; }); });

// ---------- install as an app ----------
let installEvent = null;
window.addEventListener('beforeinstallprompt', (ev) => { ev.preventDefault(); installEvent = ev; $('#btn-install').hidden = false; });
$('#btn-install').onclick = async () => {
  if (!installEvent) return;
  installEvent.prompt(); await installEvent.userChoice;
  installEvent = null; $('#btn-install').hidden = true;
};
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

route();
