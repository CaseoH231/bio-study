// Rearranging saved notes when the layout of the starting notes changes. These only move topics and notes
// (found by their ids) and rename topics – they never change what a note says. Notes or topics someone added
// themselves stay where they are. Used by app.js on existing copies, and to build data.js.

// Starter 7: Headstart organised in lesson order – Cell types, Organelles, Plasma membrane.
export function organiseHeadstart(d) {
  const T = (id) => d.topics.find((t) => t.id === id);
  // Only for copies that have the owner's notes (the Plasma membrane topic), and only once.
  if (!T('t-headstart') || !T('mwlfuym70tjyw') || T('t-celltypes')) return false;
  const topic = (id, name, parent, color) => {
    let t = T(id);
    if (!t) { t = { id, name, color, entries: [] }; d.topics.push(t); }
    t.name = name;
    if (parent) t.parent = parent; else delete t.parent;
    return t;
  };
  topic('t-celltypes', 'Cell types', 't-headstart', '#be123c');
  topic('t-animal', 'Eukaryotic cells', 't-celltypes', '#be123c');
  topic('t-prok', 'Prokaryotic cells', 't-celltypes', '#b45309');
  topic('t-shared', 'Organelles', 't-headstart', '#2563eb');
  topic('t-euk', 'In all eukaryotic cells', 't-shared', '#0891b2');
  topic('t-plant', 'Plant cells only', 't-shared', '#16a34a');
  topic('mwlg3xh6vd9tx', 'Animal cells only', 't-shared', '#e11d48');
  topic('mwlfuym70tjyw', 'Plasma membrane', 't-headstart', '#7c3aed');
  topic('t-membrane', 'Membrane structure', 'mwlfuym70tjyw', '#7c3aed');
  topic('t-water', 'Hydrophilic & hydrophobic', 'mwlfuym70tjyw', '#0e7490');

  const move = (noteIds, to) => {
    for (const id of noteIds) {
      for (const t of d.topics) {
        const i = t.entries.findIndex((e) => e.id === id);
        if (i >= 0) { T(to).entries.push(t.entries.splice(i, 1)[0]); break; }
      }
    }
  };
  move(['e-animalcell', 'e-plantcell'], 't-animal');
  move(['e-nucleus', 'e-mito', 'e-er', 'e-golgi', 'e-ribo', 'e-perox', 'e-cytoskel'], 't-euk');
  move(['e-wall', 'e-chloro', 'e-vacuole', 'e-plasmo'], 't-plant');
  move(['e-lyso'], 'mwlg3xh6vd9tx');
  move(['mwlfuym7vx7dm', 'mwlfuym8ph1nr', 'mwlfuym8nla8s', 'mwlfuym8qccqj', 'mwlfuym8cnhp8', 'mwlfuym8egiy6'], 't-membrane');
  move(['mwlfuym8olj2y', 'mwlfuym8mqmuc', 'mwlfuym8u12b5', 'mwlfuym82b5vq'], 't-water');

  // Sibling order follows the order of the topics list.
  const order = ['t-headstart', 't-celltypes', 't-animal', 't-prok', 't-shared', 't-euk', 't-plant', 'mwlg3xh6vd9tx',
    'mwlfuym70tjyw', 't-membrane', 't-water'];
  const rank = (t) => (order.includes(t.id) ? order.indexOf(t.id) : order.length + d.topics.indexOf(t));
  d.topics.sort((a, b) => rank(a) - rank(b));
  return true;
}
