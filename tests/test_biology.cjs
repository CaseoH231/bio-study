// Smoke test for Bio Study Notes: every card opens with its diagram (and notebook photo), the cell explorer works,
// pasted notes and presets are sorted, and old starter notes are swapped for the notebook notes.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.accept('Test topic'));
  await p.goto('http://localhost:8766/');
  await p.click('.topic >> text=Headstart');                     // a folder: opens to show its sub-topics
  const tiles = await p.$$eval('.tcard h3', (h) => h.map((x) => x.textContent.trim()).join('|'));
  const topics = await p.$$eval('#topics .topic[data-topic^="t-"] .nm', (t) => t.map((x) => x.textContent));
  let cards = 0, figs = 0, photos = 0, broken = 0;
  for (const name of topics) {
    await p.click(`.topic >> text=${name}`);
    const ids = await p.$$eval('.card', (cs) => cs.map((c) => c.dataset.entry));
    cards += ids.length;
    for (const id of ids) {
      await p.click(`.card[data-entry="${id}"]`);
      figs += await p.locator('#dlg svg.dg').count();
      const img = p.locator('#dlg .myimg img');
      if (await img.count()) {
        photos++;
        await img.evaluate((el) => el.complete || new Promise((r) => { el.onload = el.onerror = r; }));
        if (!(await img.evaluate((el) => el.naturalWidth > 0))) broken++;
      }
      await p.keyboard.press('Escape');
    }
  }

  await p.click('.topic >> text=Plant-only organelles');
  await p.click('.part[data-k=plasmodesmata] rect >> nth=0');
  const opened = await p.textContent('#dlg h2'); await p.keyboard.press('Escape');

  await p.click('#btn-paste');
  await p.fill('#paste-text', 'Golgi apparatus: packages proteins\n- makes vesicles\nEnzyme - a biological catalyst\n\nActive site\nWhere the substrate binds');
  await p.selectOption('#paste-topic', '__new'); await p.click('#paste-go');
  const pasted = await p.$$eval('.card h3', (h) => h.map((x) => x.textContent));
  await p.click('#add-topic'); await p.click('.preset >> text=Enzymes');
  const preset = await p.$$eval('.card', (c) => c.length);
  await p.click('#add-topic'); await p.click('.preset >> text=Enzymes'); // adding again must not duplicate
  const preset2 = await p.$$eval('.card', (c) => c.length);

  // Make a sub-topic inside a topic, then check the breadcrumb trail.
  await p.click('.topic >> text=Animal cells'); await p.click('[data-act=sub-topic]');
  await p.fill('#blank-topic input', 'Cell division'); await p.click('#blank-topic button');
  const crumbs = await p.textContent('.crumbs');

  const roots = async () => p.$$eval('#topics > .node > .topic .nm', (t) => t.map((x) => x.textContent).join('|'));
  // Someone with the very first starter notes (plus a topic of their own) gets the notebook notes inside Headstart.
  await p.evaluate(() => localStorage.setItem('bio-study-notes-v1', JSON.stringify({ version: 1, topics: [
    { id: 't-organelles', name: 'Cell organelles', color: '#16a34a', entries: [{ id: 'e-nucleus', title: 'Nucleus', definition: 'x', notes: [] }] },
    { id: 'mine', name: 'My topic', color: '#2563eb', entries: [] }] })));
  await p.reload();
  const upgraded = await roots();
  // Someone with last version's three notebook topics gets them moved inside Headstart.
  await p.evaluate(() => localStorage.setItem('bio-study-notes-v1', JSON.stringify({ version: 1, starter: 2, topics: [
    { id: 't-plant', name: 'Plant-only organelles', color: '#16a34a', entries: [] }, { id: 't-shared', name: 'Shared', color: '#2563eb', entries: [] },
    { id: 't-animal', name: 'Animal cells', color: '#be123c', entries: [] }, { id: 'mine', name: 'My topic', color: '#2563eb', entries: [] }] })));
  await p.reload();
  const upgraded2 = await roots();
  await p.evaluate(() => localStorage.clear());

  console.log('tiles', tiles, 'crumbs', crumbs.replace(/\s+/g, ' '), 'upgraded2', upgraded2, 'topics', topics.join('|'), 'cards', cards, 'diagrams', figs, 'photos', photos, 'broken', broken, 'explorer', opened,
    'pasted', pasted.join('|'), 'preset', preset, preset2, 'upgraded', upgraded, 'errors', errs.length);
  const ok = tiles === 'Plant-only organelles|Shared eukaryotic organelles|Animal cells' && topics.length === 4 &&
    crumbs.replace(/\s+/g, ' ').includes('Headstart › Animal cells › Cell division') && upgraded2 === 'Headstart|My topic' && cards === 14 && figs === 14 && photos === 6 && !broken && opened === 'Plasmodesmata' &&
    pasted.length === 3 && pasted.includes('Active site') && preset === 6 && preset2 === 6 &&
    upgraded === 'Headstart|My topic' && !errs.length;
  console.log(ok ? 'biology ok' : 'biology FAILED ' + errs.join('; '));
  await b.close();
})();
