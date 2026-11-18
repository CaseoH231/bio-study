import { STARTER } from './data.js';
import { PRESETS } from './presets.js';
import { REFS } from './refs.js';
import { DIAGRAMS, DIAGRAM_WORDS, CELLS, diagramSVG, cellSVG } from './diagrams.js';

// ---------- saving ----------
const KEY = 'bio-study-notes-v1';
const PALETTE = ['#16a34a', '#2563eb', '#db2777', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#4d7c0f'];
const clone = (o) => JSON.parse(JSON.stringify(o));

let firstVisit = true; // nothing saved on this device yet – new visitors get the latest published notes
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.topics)) { firstVisit = false; return d; }
  } catch { /* first visit or storage blocked */ }
  return clone(STARTER);
}
function save() {
  firstVisit = false;
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
  // The cell explorer lives with the whole-cell notes (your "Cells" topic) – it follows the notes, not the topic's name.
  const hasCells = t.entries.some((e) => ['animalcell', 'plantcell'].includes(e.diagram));
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
      <div class="row"><button class="primary ai-only" data-act="scan">📷 Scan a photo of my notes</button>${notes.length ? '<button data-act="cards">Start flashcards</button>' : ''}</div></div>
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
    cellKind = own.some((e) => e.diagram === 'animalcell') ? 'animal' : own.some((e) => ['wall', 'chloroplast', 'vacuole', 'plasmodesmata', 'plantcell'].includes(e.diagram)) ? 'plant' : 'animal';
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
  if (act === 'scan') openScan();
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

// ---------- scan a photo of your notes ----------
// The photos go to this site's Worker (/api/organise), which asks Claude to read them and plan where each note goes.
// Nothing is saved until you've checked the plan.
const PASS_KEY = 'bio-study-passcode';
const passcode = () => { try { return localStorage.getItem(PASS_KEY) || ''; } catch { return ''; } };
const setPasscode = (v) => { try { localStorage.setItem(PASS_KEY, v); } catch { /* asked again next time */ } };

// POST to one of the Worker's /api/ endpoints. Asks for the passcode if the Worker wants one (and remembers it).
async function callApi(path, body) {
  let res = null, data = {};
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-passcode': passcode() }, body: JSON.stringify(body) });
      data = await res.json().catch(() => ({}));
    } catch { res = null; }
    if (res?.status !== 401) break;
    const p = prompt(attempt ? 'That passcode didn’t work. Try again:' : 'Enter the passcode for the AI features:');
    if (!p) return { res, data, cancelled: true };
    setPasscode(p.trim());
  }
  return { res, data, cancelled: false };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('unreadable'));
    img.src = URL.createObjectURL(file);
  });
}
// Draw (part of) a photo onto a canvas no bigger than `max` pixels along its long side.
function drawScaled(img, max, sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight, filter = '') {
  const k = Math.min(1, max / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw * k)); c.height = Math.max(1, Math.round(sh * k));
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  if (filter) g.filter = filter;
  g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}
// A hand-drawn diagram cut out of the page (box is in thousandths of the page), cleaned up to black and white.
function cropDrawing(img, b) {
  const W = img.naturalWidth, H = img.naturalHeight;
  let x0 = Math.min(b.x0, b.x1) / 1000, x1 = Math.max(b.x0, b.x1) / 1000, y0 = Math.min(b.y0, b.y1) / 1000, y1 = Math.max(b.y0, b.y1) / 1000;
  if (x1 - x0 < 0.05 || y1 - y0 < 0.05) return '';
  const pad = 0.03;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(1, x1 + pad); y1 = Math.min(1, y1 + pad);
  return drawScaled(img, 1000, x0 * W, y0 * H, (x1 - x0) * W, (y1 - y0) * H, 'grayscale(1) contrast(1.35) brightness(1.08)').toDataURL('image/jpeg', 0.8);
}

function openScan() {
  let files = [];
  openDialog(`
    <div class="dlg-head"><h2 class="grow">Scan your notes</h2><button data-close aria-label="Close">✕</button></div>
    <div class="dlg-body form">
      <p class="hint">Take a photo of each page (or pick them from your photos). I'll read your handwriting, make a note for each thing you wrote about,
        put each one in the right topic – making new topics or sub-topics only when nothing fits – and cut out any diagrams you drew.
        You'll get to check everything before it's added.</p>
      <label class="scan-pick"><input type="file" id="scan-files" accept="image/*" multiple><span>📷 Choose photos</span></label>
      <div class="scan-thumbs" id="scan-thumbs"></div>
    </div>
    <div class="dlg-foot"><span class="grow where" id="scan-count"></span><button data-close>Cancel</button><button class="primary" id="scan-go" disabled>Read my notes</button></div>`, 'small');
  const show = () => {
    $('#scan-thumbs').innerHTML = files.map((f, i) => `<figure><img src="${URL.createObjectURL(f)}" alt="Page ${i + 1}"><button type="button" class="link danger" data-rm="${i}">Remove</button></figure>`).join('');
    $('#scan-count').textContent = files.length ? `${plural(files.length, 'page')}` : '';
    $('#scan-go').disabled = !files.length;
  };
  $('#scan-files').onchange = (ev) => { files = [...files, ...ev.target.files].slice(0, 8); ev.target.value = ''; show(); };
  $('#scan-thumbs').onclick = (ev) => { const b = ev.target.closest('[data-rm]'); if (b) { files.splice(+b.dataset.rm, 1); show(); } };
  $('#scan-go').onclick = () => readNotes(files);
}

async function readNotes(files) {
  const busy = (msg) => openDialog(`<div class="dlg-head"><h2 class="grow">Reading your notes…</h2></div>
    <div class="dlg-body scan-busy"><div class="spinner"></div><p>${msg}</p></div>`, 'small');
  busy('Getting your photos ready…');
  let pages;
  try { pages = await Promise.all(files.map(loadImage)); } catch {
    openScan(); return toast('One of those photos couldn’t be opened – try a JPG or PNG.');
  }
  const images = pages.map((img) => ({ media_type: 'image/jpeg', data: drawScaled(img, 1568).toDataURL('image/jpeg', 0.85).split(',')[1] }));
  const tree = treeOrder().map(({ t }) => ({ id: t.id, name: t.name, parent: t.parent || null, notes: t.entries.map((e) => e.title) }));
  busy(`Reading ${plural(pages.length, 'page')} of handwriting and sorting it into topics. This usually takes under a minute.`);

  const { res, data, cancelled } = await callApi('api/organise', { images, tree });
  if (cancelled) { dlg.close(); return; }
  if (res?.ok && data.plan) return reviewPlan(data.plan, pages, data.reader);
  const why = {
    'not-set-up': 'Scanning isn’t switched on for this site yet (see the README).',
    'daily-limit': 'You’ve used today’s free scanning allowance (about 50 pages). It resets tomorrow.',
    'bad-key': 'The Anthropic API key saved in Cloudflare isn’t working – check it there.',
    busy: 'The note reader is busy right now. Try again in a minute.',
    refused: 'The note reader couldn’t process these photos.',
    'no-plan': 'The note reader couldn’t make sense of those photos. Try a clearer, closer photo of one page.',
    'too-long': 'That was too much to read in one go – try fewer pages at a time.',
    'too-big': 'Those photos are too big together – try fewer pages at a time.',
    passcode: 'Wrong passcode.',
    'not-owner': 'The AI features only work on the owner’s laptop.',
  }[data.error] || (res && res.status !== 404 && res.status !== 405 ? 'Something went wrong reading the notes. Try again.'
    : 'Scanning only works on the online site (bio-study.adrian11jonker.workers.dev), with an internet connection.');
  openDialog(`<div class="dlg-head"><h2 class="grow">Couldn’t read the notes</h2><button data-close aria-label="Close">✕</button></div>
    <div class="dlg-body"><p>${esc(why)}</p></div><div class="dlg-foot"><span class="grow"></span><button data-close>Close</button></div>`, 'small');
}

// Note names written slightly differently should still match: "Golgi bodies / complex" = "Golgi body",
// "Ribosome" = "Ribosomes", "ER" = "Endoplasmic reticulum (ER)", "Cyto skeleton" = "Cytoskeleton".
const single = (w) => w.replace(/ies$/, 'y').replace(/(ch|sh|x|ss)es$/, '$1').replace(/([^s])s$/, '$1');
function nameKeys(title) {
  const t = title.toLowerCase();
  const parts = [t.split(/[/(]/)[0], ...[...t.matchAll(/\(([^)]+)\)/g)].map((m) => m[1])];
  return new Set(parts.map((x) => x.split(/[^a-z]+/).filter(Boolean).map(single).join('')).filter(Boolean));
}
const sameNote = (a, b) => [...nameKeys(a)].some((k) => nameKeys(b).has(k));

// Drag a box over the page photo to choose (or fix) the drawing for a note. Calls done(drawing or null), or nothing on cancel.
function pickDrawing(pages, note, done) {
  let page = Math.min(pages.length, Math.max(1, note.drawing?.page || 1)) - 1;
  let box = note.drawing ? { ...note.drawing } : null;
  const ov = document.createElement('div');
  ov.className = 'crop-ov';
  ov.innerHTML = `<div class="crop-panel"><div class="crop-head"><b>Drag a box around the drawing for “${esc(note.title)}”</b>
      ${pages.length > 1 ? `<div class="tabs">${pages.map((_, k) => `<button type="button" data-page="${k}">Page ${k + 1}</button>`).join('')}</div>` : ''}</div>
    <div class="crop-stage"><img alt="Page photo"><div class="crop-sel" hidden></div></div>
    <div class="row"><button type="button" class="danger" data-c="none">No drawing</button><span class="grow"></span>
      <button type="button" data-c="cancel">Cancel</button><button type="button" class="primary" data-c="ok">Use this</button></div></div>`;
  dlg.appendChild(ov);
  const img = $('.crop-stage img', ov), sel = $('.crop-sel', ov);
  const show = () => {
    img.src = pages[page].src;
    $$('[data-page]', ov).forEach((b) => b.classList.toggle('on', +b.dataset.page === page));
    const b = box && box.page === page + 1 ? box : null;
    sel.hidden = !b;
    if (b) Object.assign(sel.style, { left: `${b.x0 / 10}%`, top: `${b.y0 / 10}%`, width: `${(b.x1 - b.x0) / 10}%`, height: `${(b.y1 - b.y0) / 10}%` });
  };
  const at = (ev) => {
    const r = img.getBoundingClientRect();
    return [Math.round(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)) * 1000), Math.round(Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)) * 1000)];
  };
  let start = null;
  const stage = $('.crop-stage', ov);
  stage.addEventListener('pointerdown', (ev) => { ev.preventDefault(); start = at(ev); stage.setPointerCapture(ev.pointerId); });
  stage.addEventListener('pointermove', (ev) => {
    if (!start) return;
    const [x, y] = at(ev);
    box = { page: page + 1, x0: Math.min(start[0], x), y0: Math.min(start[1], y), x1: Math.max(start[0], x), y1: Math.max(start[1], y) };
    show();
  });
  stage.addEventListener('pointerup', () => { start = null; });
  ov.addEventListener('click', (ev) => {
    const pg = ev.target.closest('[data-page]');
    if (pg) { page = +pg.dataset.page; return show(); }
    const c = ev.target.closest('[data-c]')?.dataset.c;
    if (!c) return;
    ov.remove();
    if (c === 'none') done(null);
    if (c === 'ok') done(box && box.x1 - box.x0 > 20 && box.y1 - box.y0 > 20 ? box : note.drawing || null);
  });
  show();
}

// Show what was found, let you untick or rename things, then add it all.
function reviewPlan(plan, pages, reader) {
  const known = new Set(db.topics.map((t) => t.id));
  const fresh = (plan.new_topics || []).filter((nt) => nt.key && nt.name && !known.has(nt.key));
  const keys = new Set(fresh.map((nt) => nt.key));
  const valid = (id) => known.has(id) || keys.has(id);
  fresh.forEach((nt) => { if (!valid(nt.parent) || nt.parent === nt.key) nt.parent = null; });
  const notes = (plan.notes || []).filter((n) => n.title?.trim());
  if (notes.some((n) => !valid(n.topic))) {
    fresh.push({ key: 'new-photos', name: 'From my photos', parent: null }); keys.add('new-photos');
    notes.forEach((n) => { if (!valid(n.topic)) n.topic = 'new-photos'; });
  }
  const drawings = notes.map((n) => (n.drawing && pages[n.drawing.page - 1] ? cropDrawing(pages[n.drawing.page - 1], n.drawing) : ''));
  const thumb = (i) => `${drawings[i] ? `<img class="pn-draw" src="${drawings[i]}" alt="Your drawing">` : ''}
    <button type="button" class="link" data-crop="${i}">${drawings[i] ? 'Adjust drawing' : '+ Add a drawing'}</button>`;
  const newByKey = Object.fromEntries(fresh.map((nt) => [nt.key, nt]));
  const pathTo = (id, seen = new Set()) => {
    if (known.has(id)) return pathOf(topicOf(id));
    const nt = newByKey[id];
    if (!nt || seen.has(id)) return '';
    seen.add(id);
    return (nt.parent ? pathTo(nt.parent, seen) + ' › ' : '') + nt.name;
  };
  const existingNote = (n) => known.has(n.topic) && topicOf(n.topic).entries.find((e) => sameNote(e.title, n.title));

  openDialog(`
    <div class="dlg-head"><h2 class="grow">Check before adding</h2><button data-close aria-label="Close">✕</button></div>
    <div class="dlg-body form">
      <p class="hint">${esc(plan.summary || '')}${reader === 'free' ? '<br><small>Read by the free reader – check the spelling and wording as you go.</small>' : ''}</p>
      ${plan.unreadable?.length ? `<p class="hint warnbox"><b>Couldn’t read for sure:</b> ${plan.unreadable.map(esc).join(' · ')}</p>` : ''}
      ${fresh.length ? `<h4 class="sect">New topics <small>– rename them if you like</small></h4>
        <div class="plan-topics">${fresh.map((nt) => `<label><span class="chip new">New</span>
          <input type="text" data-key="${esc(nt.key)}" value="${esc(nt.name)}"><small>${nt.parent ? `inside ${esc(pathTo(nt.parent))}` : 'top level'}</small></label>`).join('')}</div>` : ''}
      <h4 class="sect">Notes <small>– untick any you don’t want</small></h4>
      <div class="plan-list">${notes.map((n, i) => {
        const old = existingNote(n);
        return `<label class="plan-note"><input type="checkbox" data-i="${i}" checked>
          <div class="pn-body"><div class="pn-top"><b>${esc(n.title)}</b>
            ${old ? '<span class="chip">adds to your existing note</span>' : ''}${n.filled ? '<span class="chip warn">definition added for you</span>' : ''}</div>
            <div class="where">→ ${esc(pathTo(n.topic))}</div>
            ${n.definition && !old?.definition ? `<p>${esc(n.definition)}</p>` : ''}
            ${n.key_points?.length ? `<ul>${n.key_points.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}</div>
          <div class="pn-side" data-thumb="${i}">${thumb(i)}</div></label>`;
      }).join('')}</div>
    </div>
    <div class="dlg-foot"><span class="grow"></span><button data-close>Cancel</button><button class="primary" id="plan-go">Add ${plural(notes.length, 'note')}</button></div>`, 'small plan-dlg');

  const ticked = () => $$('.plan-note input:checked', dlg).map((x) => +x.dataset.i);
  $('.plan-list', dlg).addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-crop]');
    if (!b) return;
    ev.preventDefault();
    const i = +b.dataset.crop;
    pickDrawing(pages, notes[i], (drawing) => {
      notes[i].drawing = drawing;
      drawings[i] = drawing ? cropDrawing(pages[drawing.page - 1], drawing) : '';
      $(`[data-thumb="${i}"]`, dlg).innerHTML = thumb(i);
    });
  });
  $('.plan-list', dlg).addEventListener('change', () => { const k = ticked().length; $('#plan-go').textContent = `Add ${plural(k, 'note')}`; $('#plan-go').disabled = !k; });
  $('#plan-go').onclick = () => {
    const chosen = ticked();
    const names = Object.fromEntries($$('[data-key]', dlg).map((x) => [x.dataset.key, x.value.trim()]));
    // Make only the new topics that end up holding something, parents first.
    const need = new Set();
    const mark = (id) => { while (newByKey[id] && !need.has(id)) { need.add(id); id = newByKey[id].parent; } };
    chosen.forEach((i) => mark(notes[i].topic));
    const idFor = {};
    const resolve = (id) => (known.has(id) ? id : idFor[id]);
    const make = (key, seen = new Set()) => {
      if (idFor[key] || seen.has(key)) return idFor[key];
      seen.add(key);
      const nt = newByKey[key];
      const parent = nt.parent ? (known.has(nt.parent) ? nt.parent : make(nt.parent, seen)) : null;
      const name = names[key] || nt.name;
      const same = kids(parent || null).find((t) => t.name.toLowerCase() === name.toLowerCase());
      idFor[key] = (same || newTopic(name, parent)).id;
      return idFor[key];
    };
    need.forEach((k) => make(k));
    let added = 0, updated = 0, first = null;
    for (const i of chosen) {
      const n = notes[i], t = topicOf(resolve(n.topic));
      if (!t) continue;
      first = first || t.id;
      const points = (n.key_points || []).map((k) => k.trim()).filter(Boolean);
      const diagram = n.diagram && n.diagram !== 'none' ? n.diagram : '';
      const old = t.entries.find((e) => sameNote(e.title, n.title));
      if (old) {
        if (!old.definition && n.definition) { old.definition = n.definition; if (n.filled) old.filled = true; }
        old.notes = [...(old.notes || []), ...points.filter((k) => !(old.notes || []).includes(k))];
        if (!old.found && n.found_in) old.found = n.found_in;
        if (!old.diagram && diagram) old.diagram = diagram;
        if (!old.image && drawings[i]) old.image = drawings[i];
        updated++;
      } else {
        t.entries.push({ id: uid(), title: n.title.trim(), definition: n.definition || '', notes: points, found: n.found_in || '',
          diagram, image: drawings[i] || '', ...(n.filled ? { filled: true } : {}) });
        added++;
      }
    }
    if (!save()) return;
    dlg.close(); openTopic(first || current);
    toast(`Added ${plural(added, 'new note')}${updated ? `, updated ${updated}` : ''}`);
  };
}

// ---------- the study helper (chat) ----------
// Answers questions and suggests changes; changes only happen when you press "Do it".
const chat = [];   // this visit's conversation: { role, content, actions?, done? }
let chatBusy = false;

// Everything the helper needs to know about your notes, as compact text.
function notesForHelper() {
  const clip = (t, n) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
  return treeOrder().map(({ t, depth }) => {
    const pad = '  '.repeat(depth);
    return [`${pad}[${t.id}] ${t.name}`, ...t.entries.map((e) =>
      `${pad}  (${e.id}) ${e.title}: ${clip(e.definition || '', 160)}${e.notes?.length ? ` | points: ${clip(e.notes.join('; '), 220)}` : ''}`)].join('\n');
  }).join('\n');
}
function whereNow() {
  if (noteId && find(noteId)) return `the note (${noteId}) "${find(noteId).e.title}" in [${find(noteId).t.id}]`;
  if (current !== HOME && topicOf(current)) return `the topic [${current}] "${topicOf(current).name}"`;
  return 'the dashboard';
}

// Turn the helper's suggested actions into something readable, dropping any that point at things that don't exist.
function describeActions(actions) {
  for (const a of actions) if (['add_note', 'move_note', 'quiz', 'open'].includes(a.type) && !a.topic && a.parent) a.topic = a.parent;
  const keys = {};
  const topicName = (id) => topicOf(id)?.name || keys[id] || null;
  const out = [];
  for (const a of actions) {
    const note = a.note && find(a.note);
    let text = null;
    if (a.type === 'add_topic' && a.name && a.key) {
      keys[a.key] = a.name;
      text = `New topic “${a.name}”${a.parent && topicName(a.parent) ? ` inside ${topicName(a.parent)}` : ''}`;
    } else if (a.type === 'add_note' && a.title && topicName(a.topic)) text = `New note “${a.title}” in ${topicName(a.topic)}`;
    else if (a.type === 'update_note' && note) text = `Update “${note.e.title}”${a.definition ? ' (new definition)' : ''}${a.key_points?.length ? ` (+${plural(a.key_points.length, 'key point')})` : ''}`;
    else if (a.type === 'move_note' && note && topicName(a.topic)) text = `Move “${note.e.title}” to ${topicName(a.topic)}`;
    else if (a.type === 'delete_note' && note) text = `Delete the note “${note.e.title}”`;
    else if (a.type === 'rename_topic' && topicOf(a.topic) && a.name) text = `Rename “${topicOf(a.topic).name}” to “${a.name}”`;
    else if (a.type === 'move_topic' && topicOf(a.topic)) text = `Move “${topicOf(a.topic).name}” ${a.parent && topicName(a.parent) ? `inside ${topicName(a.parent)}` : 'to the top level'}`;
    else if (a.type === 'delete_topic' && topicOf(a.topic)) text = `Delete the topic “${topicOf(a.topic).name}” and everything in it`;
    if (text) out.push({ a, text });
  }
  return out;
}

function applyActions(actions) {
  const keyToId = {};
  const tid = (x) => (topicOf(x) ? x : keyToId[x]);
  let n = 0;
  for (const a of actions) {
    const note = a.note && find(a.note);
    if (a.type === 'add_topic') { const t = newTopic(a.name, tid(a.parent) || null); if (t) { keyToId[a.key] = t.id; n++; } }
    else if (a.type === 'add_note' && topicOf(tid(a.topic))) {
      const t = topicOf(tid(a.topic));
      const old = t.entries.find((e) => sameNote(e.title, a.title));
      const points = (a.key_points || []).filter(Boolean);
      if (old) { old.notes = [...(old.notes || []), ...points.filter((k) => !(old.notes || []).includes(k))]; if (!old.definition) old.definition = a.definition || ''; }
      else {
        const m = DIAGRAM_WORDS.find(([re]) => re.test(a.title));
        t.entries.push({ id: uid(), title: a.title, definition: a.definition || '', notes: points, found: /^[te]-/.test(a.found_in || '') ? '' : a.found_in || '', diagram: m ? m[1] : '', image: '' });
      }
      n++;
    } else if (a.type === 'update_note' && note) {
      if (a.title) note.e.title = a.title;
      if (a.definition) { note.e.definition = a.definition; delete note.e.filled; }
      if (a.key_points?.length) note.e.notes = [...(note.e.notes || []), ...a.key_points.filter((k) => k && !(note.e.notes || []).includes(k))];
      n++;
    } else if (a.type === 'move_note' && note && topicOf(tid(a.topic))) {
      note.t.entries = note.t.entries.filter((x) => x !== note.e); topicOf(tid(a.topic)).entries.push(note.e); n++;
    } else if (a.type === 'delete_note' && note) { note.t.entries = note.t.entries.filter((x) => x !== note.e); n++; }
    else if (a.type === 'rename_topic' && topicOf(a.topic) && a.name) { topicOf(a.topic).name = a.name; n++; }
    else if (a.type === 'move_topic' && topicOf(a.topic)) {
      const t = topicOf(a.topic), to = tid(a.parent);
      if (to && (to === t.id || below(t.id).some((x) => x.id === to))) continue; // can't go inside itself
      if (to) t.parent = to; else delete t.parent;
      n++;
    } else if (a.type === 'delete_topic' && topicOf(a.topic)) {
      const gone = [topicOf(a.topic), ...below(a.topic)];
      db.topics = db.topics.filter((x) => !gone.includes(x)); n++;
    }
  }
  save(); render();
  return n;
}

function renderChat() {
  const box = $('#bot-msgs');
  if (!box) return;
  box.innerHTML = chat.length ? chat.map((m, i) => {
    const changes = m.role === 'assistant' && m.actions ? describeActions(m.actions) : [];
    return `<div class="msg ${m.role}"><div class="bubble">${esc(m.content).replace(/\n/g, '<br>')}</div>
      ${changes.length ? `<div class="proposal ${m.done ? 'done' : ''}"><b>${m.done ? (m.done === 'yes' ? '✓ Done' : 'Skipped') : 'Suggested changes'}</b>
        <ul>${changes.map((c) => `<li>${esc(c.text)}</li>`).join('')}</ul>
        ${m.done ? '' : `<div class="row"><button class="primary" data-do="${i}">Do it</button><button data-skip="${i}">No thanks</button></div>`}</div>` : ''}</div>`;
  }).join('') : `<div class="bot-hello"><p>Hi! Ask me about your notes, or ask me to change them.</p>
      <div class="chips">${['Quiz me on Headstart', 'What does the Golgi body do?', 'Add a note on osmosis to a new Cell transport topic', 'Which of my notes have no definition?']
        .map((q) => `<button class="chip ask" data-ask="${esc(q)}">${esc(q)}</button>`).join('')}</div></div>`;
  if (chatBusy) box.insertAdjacentHTML('beforeend', '<div class="msg assistant"><div class="bubble typing"><span></span><span></span><span></span></div></div>');
  box.scrollTop = box.scrollHeight;
}

async function askHelper(text) {
  text = text.trim();
  if (!text || chatBusy) return;
  chat.push({ role: 'user', content: text });
  chatBusy = true; renderChat();
  const { res, data, cancelled } = await callApi('api/assistant', {
    messages: chat.map((m) => ({ role: m.role, content: m.content })), notes: notesForHelper(), where: whereNow(),
  });
  chatBusy = false;
  if (cancelled) { chat.pop(); return renderChat(); }
  if (!res?.ok || typeof data.reply !== 'string') {
    const why = { 'daily-limit': 'I’ve used up today’s free allowance – try again tomorrow.', 'not-owner': 'The study helper only works on the owner’s laptop.',
      passcode: 'Wrong passcode.' }[data.error] || (res ? 'Sorry, something went wrong – try asking again.' : 'I can only help on the online site, with an internet connection.');
    chat.push({ role: 'assistant', content: why });
    return renderChat();
  }
  const actions = Array.isArray(data.actions) ? data.actions : [];
  // Opening a page or starting flashcards happens straight away; changes wait for "Do it".
  for (const a of actions) {
    if (a.type === 'open' && a.note && find(a.note)) openDetail(a.note);
    else if (a.type === 'open' && a.topic && topicOf(a.topic)) openTopic(a.topic);
  }
  const quiz = actions.find((a) => a.type === 'quiz');
  const changes = actions.filter((a) => !['open', 'quiz'].includes(a.type));
  chat.push({ role: 'assistant', content: data.reply, actions: describeActions(changes).length ? changes : null });
  renderChat();
  if (quiz) startQuiz(quiz.topic && topicOf(quiz.topic) ? quiz.topic : '');
}

function toggleHelper(open = !document.body.classList.contains('bot-open')) {
  document.body.classList.toggle('bot-open', open);
  $('#bot').hidden = !open;
  if (open) { renderChat(); setTimeout(() => $('#bot-input').focus(), 50); }
}
$('#bot-btn').onclick = () => toggleHelper();
$('#bot-close').onclick = () => toggleHelper(false);
$('#bot-form').onsubmit = (ev) => { ev.preventDefault(); const i = $('#bot-input'); askHelper(i.value); i.value = ''; };
$('#bot-input').addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); $('#bot-form').requestSubmit(); } });
$('#bot-msgs').addEventListener('click', (ev) => {
  const ask = ev.target.closest('[data-ask]');
  if (ask) return askHelper(ask.dataset.ask);
  const go = ev.target.closest('[data-do]'), skip = ev.target.closest('[data-skip]');
  const m = chat[(go || skip)?.dataset.do ?? (go || skip)?.dataset.skip];
  if (!m) return;
  if (go) { const n = applyActions(m.actions); m.done = 'yes'; toast(n ? `Done – ${plural(n, 'change')} made` : 'Nothing to change'); } else m.done = 'no';
  renderChat();
});

// ---------- who may use the AI features (scanning, the study helper) ----------
// The Worker decides (OWNER_IPS / APP_PASSCODE). Friends with the link just don't see these buttons.
let aiInfo = null;
async function checkAI() {
  try {
    const res = await fetch('api/whoami', { headers: { 'x-passcode': passcode() } });
    aiInfo = res.ok ? await res.json() : null;
  } catch { aiInfo = null; }
  const show = !!aiInfo?.ai && (aiInfo.owner || aiInfo.hasPasscode);
  document.body.classList.toggle('no-ai', !show);
}
function openDeviceInfo() {
  const a = aiInfo;
  openDialog(`<div class="dlg-head"><h2 class="grow">This device &amp; the AI features</h2><button data-close aria-label="Close">✕</button></div>
    <div class="dlg-body form">
      <p>Your notes are saved only on this device. Nothing you write is sent anywhere, so other people using the link have their own separate notes.</p>
      ${a ? `<p class="hint">Scanning and the study helper ${a.owner ? '<b>work on this device</b>' : '<b>are locked on this device</b>'}.
        ${a.locked ? '' : 'Right now they’re open to anyone with the link.'}</p>
      <p>This device’s internet address: <code>${esc(a.ip || 'unknown')}</code></p>
      <p class="where">To lock the AI features to this laptop: Cloudflare → Workers &amp; Pages → bio-study → Settings → Variables and Secrets → Add →
        type <b>Secret</b>, name <code>OWNER_IPS</code>, value <code>${esc(a.suggest || a.ip || '')}</code>. Add a secret <code>APP_PASSCODE</code> too, so you can still use them
        at school or when your home address changes.</p>` : '<p class="hint">The AI features only work on the online site.</p>'}
    </div>
    <div class="dlg-foot"><span class="grow"></span>${passcode() ? '<button id="forget-pass">Forget the passcode on this device</button>' : ''}<button data-close>Close</button></div>`, 'small');
  const f = $('#forget-pass');
  if (f) f.onclick = () => { try { localStorage.removeItem(PASS_KEY); } catch { /* fine */ } dlg.close(); checkAI(); toast('Passcode forgotten'); };
}
$('#btn-device').onclick = () => { $('.more').open = false; openDeviceInfo(); };

// ---------- flashcards ----------
function startQuiz(topicId) {
  openCards();
  if (topicId) $('#fc-topic').value = topicId;
  $('#fc-start').click();
}

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
$('#btn-scan').onclick = openScan;
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
// ---------- publishing: your notes saved to GitHub, and the starting notes for anyone new ----------
const fetchPublished = async () => {
  try {
    const res = await fetch('api/published', { cache: 'no-store' });
    const d = res.ok ? await res.json() : null;
    return d && Array.isArray(d.topics) ? d : null;
  } catch { return null; }
};
async function useLatestForNewVisitor() {
  if (!firstVisit) return;
  const d = await fetchPublished();
  if (!d || !firstVisit) return; // they started making notes meanwhile – keep theirs
  delete d.publishedAt;
  db = d; upgradeStarter(db); route();
}
$('#btn-publish').onclick = () => {
  $('.more').open = false;
  const count = all().length;
  openDialog(`<div class="dlg-head"><h2 class="grow">Publish my notes</h2><button data-close aria-label="Close">✕</button></div>
    <div class="dlg-body"><p>This saves the notes on this device (${plural(count, 'note')} in ${plural(db.topics.length, 'topic')}) to GitHub. That means:</p>
      <ul><li>they're backed up, with a history of every version,</li><li>Claude can see them when you ask for changes,</li>
      <li>anyone opening the app for the first time starts with them.</li></ul>
      <p class="hint">It needs your passcode. People who already use the app keep their own notes.</p></div>
    <div class="dlg-foot"><span class="grow"></span><button data-close>Cancel</button><button class="primary" id="pub-go">Publish</button></div>`, 'small');
  $('#pub-go').onclick = async () => {
    $('#pub-go').disabled = true; $('#pub-go').textContent = 'Publishing…';
    const { res, data, cancelled } = await callApi('api/publish', { notes: db });
    if (cancelled) return dlg.close();
    if (res?.ok && data.ok) {
      openDialog(`<div class="dlg-head"><h2 class="grow">Published ✓</h2><button data-close aria-label="Close">✕</button></div>
        <div class="dlg-body"><p>${plural(data.count, 'note')} saved to GitHub.${data.commit ? ` <a href="${esc(data.commit)}" target="_blank" rel="noopener">See it on GitHub</a>.` : ''}</p></div>
        <div class="dlg-foot"><span class="grow"></span><button data-close>Close</button></div>`, 'small');
      return;
    }
    const why = { 'not-set-up': 'Publishing isn’t set up yet: the Worker needs a GITHUB_TOKEN and an APP_PASSCODE secret (see the README).',
      'bad-token': 'GitHub didn’t accept the GITHUB_TOKEN – it may have expired or not have write access to the repository.',
      passcode: 'Wrong passcode.', 'too-big': 'Your notes are too big to publish in one go.' }[data.error]
      || (res ? 'Publishing failed – try again in a minute.' : 'Publishing only works on the online site, with an internet connection.');
    openDialog(`<div class="dlg-head"><h2 class="grow">Couldn’t publish</h2><button data-close aria-label="Close">✕</button></div>
      <div class="dlg-body"><p>${esc(why)}</p></div><div class="dlg-foot"><span class="grow"></span><button data-close>Close</button></div>`, 'small');
  };
};
$('#btn-latest').onclick = async () => {
  $('.more').open = false;
  const d = await fetchPublished();
  if (!d) return toast('There are no published notes yet (or you’re offline).');
  if (!confirm(`Replace the notes on this device with the latest published notes${d.publishedAt ? ` (from ${new Date(d.publishedAt).toLocaleDateString()})` : ''}? Download a backup first if you want to keep yours.`)) return;
  delete d.publishedAt;
  db = d; upgradeStarter(db); save(); go('#/'); toast('Loaded the latest published notes');
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
checkAI();
useLatestForNewVisitor();
