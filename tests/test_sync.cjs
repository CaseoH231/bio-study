// Bringing the owner's published notes into a friend's notes: merge rules and the separate sections.
const path = require('path');
(async () => {
  const S = await import(path.join(__dirname, '..', 'sync.js'));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const note = (id, title, extra = {}) => ({ id, title, definition: `${title} def`, notes: [], ...extra });
  const v1 = { publishedAt: '1', topics: [
    { id: 'h', name: 'Headstart', color: '#1', entries: [] },
    { id: 'o', parent: 'h', name: 'Organelles', color: '#2', entries: [note('n1', 'Nucleus'), note('n2', 'Mitochondria'), note('n3', 'Golgi body'), note('n4', 'Ribosomes')] },
    { id: 'old', parent: 'h', name: 'Old topic', color: '#3', entries: [note('n9', 'Gone soon')] },
  ] };
  const checks = [];
  const check = (name, ok) => checks.push(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  const all = (d) => d.topics.flatMap((t) => t.entries.map((e) => ({ ...e, topic: t.id })));
  const get = (d, id) => all(d).find((e) => e.id === id);

  // A friend who already had an older copy (no record yet) plus their own work.
  const d = { version: 1, topics: [
    { id: 'h', name: 'Headstart', color: '#1', entries: [] },
    { id: 'o', parent: 'h', name: 'Organelles', color: '#2', entries: [note('n1', 'Nucleus')] },
    { id: 'mine', name: 'My stuff', color: '#9', entries: [note('m1', 'My note')] },
    { id: 'myorg', parent: 'h', name: 'organelles ', color: '#9', entries: [] }, // same name & place as a published topic
  ] };
  let st = S.mergeImport(d, v1);
  check('first import adds the missing notes', ['n2', 'n3', 'n4', 'n9'].every((id) => get(d, id)) && st.added === 4);
  check('their own topic and note are kept', get(d, 'm1')?.topic === 'mine');
  check('their same-name topic is folded in, not duplicated', d.topics.filter((t) => lower(t.name) === 'organelles').length === 1 && st.folded === 1);
  check('a record of what came in is kept', d.sync.mode === 'merge' && Object.keys(d.sync.notes).length === 5);

  // They edit one note, delete another, and add a note to a published topic.
  get(d, 'n2'); d.topics.find((t) => t.id === 'o').entries.find((e) => e.id === 'n2').definition = 'MY OWN WORDS';
  const org = d.topics.find((t) => t.id === 'o'); org.entries = org.entries.filter((e) => e.id !== 'n3');
  org.entries.push(note('m2', 'My extra'));

  // The owner publishes v2: updates n1 and n2, deletes n9 (and its topic), moves n4, adds n5, re-titles nothing else.
  const v2 = clone(v1); v2.publishedAt = '2';
  const o2 = v2.topics.find((t) => t.id === 'o');
  o2.entries.find((e) => e.id === 'n1').definition = 'Nucleus NEW';
  o2.entries.find((e) => e.id === 'n2').definition = 'Mito NEW';
  o2.entries.find((e) => e.id === 'n2').notes = ['new point'];
  const n4 = o2.entries.splice(o2.entries.findIndex((e) => e.id === 'n4'), 1)[0];
  v2.topics = v2.topics.filter((t) => t.id !== 'old');
  v2.topics.push({ id: 'cells', parent: 'h', name: 'Cells', color: '#4', entries: [n4, note('n5', 'Animal cell')] });
  st = S.mergeImport(d, v2);
  check('an untouched note is updated', get(d, 'n1').definition === 'Nucleus NEW');
  check('a note they edited keeps their words', get(d, 'n2').definition === 'MY OWN WORDS' && st.kept === 1);
  check('a note they deleted stays deleted', !get(d, 'n3'));
  check('a note the owner moved moves too', get(d, 'n4')?.topic === 'cells');
  check('a new note arrives', get(d, 'n5')?.topic === 'cells');
  check('a note the owner deleted goes (they hadn’t touched it)', !get(d, 'n9') && !d.topics.some((t) => t.id === 'old'));
  check('their extra note in a published topic stays', get(d, 'm2')?.topic === 'o');
  check('their own topic still stays', get(d, 'm1')?.topic === 'mine');

  // Separate sections.
  const s = clone(d);
  const c = S.separateImport(s, v2);
  const roots = s.topics.filter((t) => !t.parent).map((t) => t.name).join('|');
  check('separate: two sections', roots === "Personal|Donut-Man's notes");
  check('separate: Personal holds only their own and edited notes', !get(s, 'n1') && get(s, 'n2') && get(s, 'm1') && get(s, 'm2'));
  check('separate: their topics are inside Personal, untouched', s.topics.find((t) => t.id === 'mine').parent === 'personal' && get(s, 'n2').definition === 'MY OWN WORDS');
  check('separate: owner’s notes are their own copies', get(s, 'dm-n2').definition === 'Mito NEW' && get(s, 'dm-n2').topic === 'dm-o' && c.notes === 5
    && s.topics.find((t) => t.id === 'dm-h').parent === 'owner-notes');
  const v3 = clone(v2); v3.publishedAt = '3'; v3.topics.find((t) => t.id === 'cells').entries.push(note('n6', 'Plant cell'));
  S.separateImport(s, v3);
  check('separate: next update replaces the owner’s section only', get(s, 'dm-n6') && all(s).filter((e) => e.id.startsWith('dm-')).length === 6 && get(s, 'm1'));
  S.unseparate(s);
  check('back to merged: Personal’s topics return to the top', !s.topics.some((t) => t.id.startsWith('dm-') || t.id === 'owner-notes' || t.id === 'personal') && s.topics.find((t) => t.id === 'h') && !s.topics.find((t) => t.id === 'h').parent);

  function lower(x) { return String(x).trim().toLowerCase(); }
  console.log(checks.join('\n'));
  console.log(checks.every((c2) => c2.startsWith('ok')) ? 'sync ok' : 'sync FAILED');
})();
