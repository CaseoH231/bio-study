// Bringing the owner's published notes into someone else's notes. Pure functions on the notes data – no screen code.
//
// Merge (the default): everything they have is kept, and the published notes are folded in.
//   • A published note they haven't touched since it last came in is updated (or moved, or removed if it was deleted).
//   • A published note they've edited keeps their version.
//   • A published note they deleted stays deleted.
//   • Their own topic with the same name, in the same place, as a published topic is folded into it.
//   To tell "they edited it" from "the owner updated it", d.sync remembers a fingerprint of each published note and
//   topic as it was when it last came in.
// Separate: two sections – "Personal" (their own notes, never touched) and the owner's notes (replaced each time).

export const OWNER_NAME = 'Donut-Man';
export const PERSONAL = 'personal';
export const OWNERS = 'owner-notes';
const PREFIX = 'dm-'; // ids of the owner's notes in the separate section, so they never clash with their own copies

const clone = (o) => JSON.parse(JSON.stringify(o));
// A short fingerprint of a note or topic (FNV-1a over its JSON).
export function fingerprint(o) {
  const s = JSON.stringify(o);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}
const topicPrint = (t) => fingerprint({ name: t.name, parent: t.parent || null, color: t.color });
const lower = (s) => String(s || '').trim().toLowerCase();

// Topics with parents before children.
function treeOrdered(topics) {
  const out = [], seen = new Set();
  const visit = (parent) => topics.filter((t) => (t.parent || null) === parent).forEach((t) => {
    if (seen.has(t.id)) return; seen.add(t.id); out.push(t); visit(t.id);
  });
  visit(null);
  topics.forEach((t) => { if (!seen.has(t.id)) out.push(t); }); // anything whose parent is missing
  return out;
}

// sameNote(a, b) decides whether two note titles mean the same thing (passed in from the app).
export function mergeImport(d, published, sameNote = (a, b) => lower(a) === lower(b)) {
  const pub = clone(published);
  const base = d.sync && d.sync.mode === 'merge' ? d.sync : { notes: {}, topics: {} };
  const stats = { added: 0, updated: 0, kept: 0, removed: 0, folded: 0 };
  const T = (id) => d.topics.find((t) => t.id === id);
  const findNote = (id) => {
    for (const t of d.topics) { const i = t.entries.findIndex((e) => e.id === id); if (i >= 0) return { t, i, e: t.entries[i] }; }
    return null;
  };
  const pubTopicIds = new Set(pub.topics.map((t) => t.id));

  // 1. Topics
  for (const pt of treeOrdered(pub.topics)) {
    let t = T(pt.id);
    if (!t) {
      // A topic of their own with the same name in the same place: it becomes this topic (their notes stay inside).
      const twin = d.topics.find((x) => !pubTopicIds.has(x.id) && (x.parent || null) === (pt.parent || null) && lower(x.name) === lower(pt.name));
      if (twin) {
        const old = twin.id;
        twin.id = pt.id;
        d.topics.forEach((x) => { if (x.parent === old) x.parent = pt.id; });
        stats.folded++;
        t = twin;
      } else {
        t = { id: pt.id, name: pt.name, color: pt.color, entries: [] };
        if (pt.parent) t.parent = pt.parent;
        d.topics.push(t);
        continue;
      }
    }
    if (base.topics[pt.id] && base.topics[pt.id] === topicPrint(t)) { // untouched since it last came in
      t.name = pt.name; t.color = pt.color;
      if (pt.parent) t.parent = pt.parent; else delete t.parent;
    }
  }

  // Their own topics with the same name and place as a published topic are folded into it (notes and sub-topics move in).
  for (const pt of treeOrdered(pub.topics)) {
    for (const twin of d.topics.filter((x) => !pubTopicIds.has(x.id) && (x.parent || null) === (pt.parent || null) && lower(x.name) === lower(pt.name))) {
      const home = T(pt.id);
      home.entries.push(...twin.entries);
      d.topics.forEach((x) => { if (x.parent === twin.id) x.parent = pt.id; });
      d.topics.splice(d.topics.indexOf(twin), 1);
      stats.folded++;
    }
  }

  // 2. Notes
  const pubNoteIds = new Set();
  for (const pt of pub.topics) {
    for (const pe of pt.entries) {
      pubNoteIds.add(pe.id);
      const have = findNote(pe.id);
      if (have) {
        if (base.notes[pe.id] && base.notes[pe.id] === fingerprint(have.e)) {
          if (fingerprint(have.e) !== fingerprint(pe) || have.t.id !== pt.id) stats.updated++;
          have.t.entries.splice(have.i, 1);
          T(pt.id).entries.push(pe);
        } else if (fingerprint(have.e) !== fingerprint(pe)) stats.kept++; // they've changed it – theirs stays
      } else if (base.notes[pe.id]) {
        // They deleted it after it came in – leave it deleted.
      } else {
        const home = T(pt.id);
        const twin = home.entries.find((x) => sameNote(x.title, pe.title));
        if (twin) { // their own note on the same thing: keep theirs, add the owner's extra points
          const extra = (pe.notes || []).filter((k) => !(twin.notes || []).includes(k));
          if (extra.length) { twin.notes = [...(twin.notes || []), ...extra]; stats.updated++; }
          if (!twin.definition && pe.definition) twin.definition = pe.definition;
          if (!twin.image && pe.image) { twin.image = pe.image; if (pe.imageCaption) twin.imageCaption = pe.imageCaption; }
        } else { home.entries.push(pe); stats.added++; }
      }
    }
  }

  // 3. Removed by the owner: notes they hadn't touched go too; topics too, if untouched and now empty.
  for (const id of Object.keys(base.notes)) {
    if (pubNoteIds.has(id)) continue;
    const have = findNote(id);
    if (have && base.notes[id] === fingerprint(have.e)) { have.t.entries.splice(have.i, 1); stats.removed++; }
  }
  let again = true;
  while (again) {
    again = false;
    for (const t of [...d.topics]) {
      if (pubTopicIds.has(t.id) || !base.topics[t.id] || base.topics[t.id] !== topicPrint(t)) continue;
      if (t.entries.length || d.topics.some((x) => x.parent === t.id)) continue;
      d.topics.splice(d.topics.indexOf(t), 1); again = true;
    }
  }

  // 4. Order: published topics in the owner's order, their own topics after them among their siblings.
  const order = pub.topics.map((t) => t.id);
  const rank = (t) => (order.includes(t.id) ? order.indexOf(t.id) : order.length + d.topics.indexOf(t));
  d.topics.sort((a, b) => rank(a) - rank(b));

  d.sync = {
    mode: 'merge', publishedAt: published.publishedAt || null,
    notes: Object.fromEntries(pub.topics.flatMap((t) => t.entries).map((e) => [e.id, fingerprint(e)])),
    topics: Object.fromEntries(pub.topics.map((t) => [t.id, topicPrint(t)])),
  };
  return stats;
}

// Separate: their notes go in "Personal"; the owner's published notes are (re)placed in their own section.
export function separateImport(d, published) {
  // Personal keeps only what's really theirs: copies of the owner's notes they never edited are dropped (they're in
  // the owner's section anyway), and so are topics that came from the owner and are now empty.
  const base = d.sync && d.sync.mode === 'merge' ? d.sync : null;
  if (base) {
    for (const t of d.topics) t.entries = t.entries.filter((e) => base.notes[e.id] !== fingerprint(e));
    let again = true;
    while (again) {
      again = false;
      for (const t of [...d.topics]) {
        if (!base.topics[t.id] || t.entries.length || d.topics.some((x) => x.parent === t.id)) continue;
        d.topics.splice(d.topics.indexOf(t), 1); again = true;
      }
    }
  }
  if (!d.topics.some((t) => t.id === PERSONAL)) d.topics.unshift({ id: PERSONAL, name: 'Personal', color: '#0f766e', entries: [] });
  for (const t of d.topics) if (!t.parent && t.id !== PERSONAL && t.id !== OWNERS) t.parent = PERSONAL;
  d.topics = d.topics.filter((t) => !t.id.startsWith(PREFIX) && t.id !== OWNERS);
  d.topics.push({ id: OWNERS, name: `${OWNER_NAME}'s notes`, color: '#7c3aed', entries: [] });
  const count = { notes: 0 };
  for (const pt of clone(published.topics)) {
    d.topics.push({
      ...pt, id: PREFIX + pt.id, parent: pt.parent ? PREFIX + pt.parent : OWNERS,
      entries: pt.entries.map((e) => { count.notes++; return { ...e, id: PREFIX + e.id }; }),
    });
  }
  d.sync = { mode: 'separate', publishedAt: published.publishedAt || null };
  return count;
}

// Back from separate to one set of notes: the owner's section goes, Personal's topics move back to the top.
// (The app then merges the latest published notes in.)
export function unseparate(d) {
  d.topics = d.topics.filter((t) => !t.id.startsWith(PREFIX) && t.id !== OWNERS);
  const personal = d.topics.find((t) => t.id === PERSONAL);
  if (personal) {
    for (const t of d.topics) if (t.parent === PERSONAL) delete t.parent;
    if (!personal.entries.length) d.topics = d.topics.filter((t) => t !== personal);
    else delete personal.parent;
  }
  delete d.sync;
}
