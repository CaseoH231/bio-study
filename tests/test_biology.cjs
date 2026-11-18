// Smoke test for Bio Study Notes: every card opens with its diagram (and notebook photo), the cell explorer works,
// pasted notes and presets are sorted, and old starter notes are swapped for the notebook notes.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const { STARTER } = await import(path.join(__dirname, '..', 'data.js'));
  const every = STARTER.topics.flatMap((t) => t.entries);
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.accept('Test topic'));
  await p.goto('http://localhost:8766/');
  // Opening a topic changes the address; wait until its page is showing.
  const openT = async (name) => {
    await p.click(`#topics .topic >> text=${name}`);
    await p.waitForFunction((n) => document.querySelector('.bar h2')?.textContent.includes(n), name);
  };
  await openT('Headstart');                                        // a folder: opens to show its sub-topics
  const tiles = await p.$$eval('.tcard h3', (h) => h.map((x) => x.textContent.trim()).join('|'));
  const topics = STARTER.topics.map((t) => t.name);
  let cards = 0, figs = 0, photos = 0, broken = 0;
  for (const t of STARTER.topics) {                                 // visit every topic by its address
    await p.goto(`http://localhost:8766/#/topic/${t.id}`);
    await p.waitForFunction((n) => document.querySelector('.bar h2')?.textContent.includes(n), t.name);
    const ids = await p.$$eval('.card', (cs) => cs.map((c) => c.dataset.entry));
    cards += ids.length;
    for (const id of ids) {
      await p.click(`.card[data-entry="${id}"]`);                // opens the note's own page
      await p.waitForSelector('.note-page');
      figs += await p.locator('.note-page figure.ref img, .note-page svg.dg').count();
      const img = p.locator('.note-page .myimg img');
      if (await img.count()) {
        photos++;
        await img.evaluate((el) => el.complete || new Promise((r) => { el.onload = el.onerror = r; }));
        if (!(await img.evaluate((el) => el.naturalWidth > 0))) broken++;
      }
      await p.goBack(); await p.waitForSelector('.card');         // Back returns to the topic
    }
  }
  await p.goto('http://localhost:8766/#/topic/t-euk'); await p.waitForSelector('.card');
  const href = await p.getAttribute('.card', 'href');              // a real link, so Ctrl-click opens a new tab
  const tab = await b.newPage(); await tab.goto('http://localhost:8766/' + href);
  const tabTitle = await tab.textContent('.note-page h2'); await tab.close();

  // The cell explorer is only on the topic with the whole-cell notes ("Cells").
  const explorerOn = [];
  for (const t of STARTER.topics) {
    await p.goto(`http://localhost:8766/#/topic/${t.id}`);
    await p.waitForFunction((n) => document.querySelector('.bar h2')?.textContent.includes(n), t.name);
    if (await p.locator('details.explorer').count()) explorerOn.push(t.name);
  }
  await p.goto('http://localhost:8766/#/topic/t-animal'); await p.waitForSelector('details.explorer');
  await p.click('[data-cell=plant]');
  await p.click('.part[data-k=plasmodesmata] rect >> nth=0');
  const opened = await p.textContent('.note-page h2');
  const crumbNote = (await p.textContent('.crumbs')).replace(/\s+/g, ' ');
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('.note-page')); const backTo = await p.textContent('.bar h2');

  await p.click('#btn-paste');
  await p.fill('#paste-text', 'Golgi apparatus: packages proteins\n- makes vesicles\nEnzyme - a biological catalyst\n\nActive site\nWhere the substrate binds');
  await p.selectOption('#paste-topic', '__new'); await p.click('#paste-go'); await p.waitForFunction((n) => document.querySelector('.bar h2')?.textContent.includes(n), 'Test topic');
  const pasted = await p.$$eval('.card h3', (h) => h.map((x) => x.textContent));
  await p.click('#add-topic'); await p.click('.preset >> text=Enzymes'); await p.waitForFunction((n) => document.querySelector('.bar h2')?.textContent.includes(n), 'Enzymes');
  const preset = await p.$$eval('.card', (c) => c.length);
  await p.click('#add-topic'); await p.click('.preset >> text=Enzymes'); // adding again must not duplicate
  const preset2 = await p.$$eval('.card', (c) => c.length);

  // Make a sub-topic inside a topic, then check the breadcrumb trail.
  await p.goto('http://localhost:8766/#/topic/t-animal'); await p.waitForFunction(() => document.querySelector('.bar h2')?.textContent.includes('Cells'));
  await p.click('[data-act=sub-topic]');
  await p.fill('#blank-topic input', 'Cell division'); await p.click('#blank-topic button'); await p.waitForFunction((n) => document.querySelector('.bar h2')?.textContent.includes(n), 'Cell division');
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
  // Someone on starter 4 gets slide 19 added to their Nucleus note (and nothing else changes).
  await p.evaluate(() => localStorage.setItem('bio-study-notes-v1', JSON.stringify({ version: 1, starter: 4, topics: [
    { id: 't-headstart', name: 'Headstart', color: '#7c3aed', entries: [] },
    { id: 't-shared', parent: 't-headstart', name: 'Organelles', color: '#2563eb', entries: [{ id: 'e-nucleus', title: 'Nucleus', definition: 'Mine', notes: ['my point'], diagram: 'nucleus', image: '' }] }] })));
  await p.goto('http://localhost:8766/#/note/e-nucleus'); await p.reload(); await p.waitForSelector('.note-page');
  const slide = [await p.getAttribute('.note-page .myimg img', 'src'), await p.textContent('.note-page .myimg figcaption'), await p.textContent('.note-page .def')].join(' | ');
  const split = (await p.textContent('.crumbs')).replace(/\s+/g, ' ');           // and Organelles is split into Eukaryotic / Prokaryotic
  const organelleKids = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('bio-study-notes-v1'));
    return d.topics.filter((t) => t.parent === 't-shared').map((t) => `${t.name}:${t.entries.length}`).join('|'); });
  await p.evaluate(() => localStorage.clear());

  const wantFigs = every.filter((e) => e.diagram).length, wantPhotos = every.filter((e) => e.image).length;
  console.log('split', split, organelleKids, 'slide', slide, 'explorer on', explorerOn.join('|'), 'figs', figs, '/', wantFigs, 'photos', photos, '/', wantPhotos, 'href', href, 'tab', tabTitle, 'crumbNote', crumbNote, 'esc', backTo, 'tiles', tiles, 'crumbs', crumbs.replace(/\s+/g, ' '), 'upgraded2', upgraded2, 'topics', topics.join('|'), 'cards', cards, 'diagrams', figs, 'photos', photos, 'broken', broken, 'explorer', opened,
    'pasted', pasted.join('|'), 'preset', preset, preset2, 'upgraded', upgraded, 'errors', errs.length);
  const ok = href.startsWith('#/note/') && tabTitle && crumbNote.includes('Headstart › Organelles › Eukaryotic › Plant-Only Organelles › Plasmodesmata') &&
    backTo.includes('Plant-Only Organelles') && tiles === 'Organelles|Cells' && explorerOn.join('|') === 'Cells' &&
    crumbs.replace(/\s+/g, ' ').includes('Headstart › Cells › Cell division') && upgraded2 === 'Headstart|My topic' && slide === 'img/slides/nucleus-slide19.jpg | From the lesson slides (slide 19) | Mine' && split.includes('Organelles › Eukaryotic › Nucleus') && organelleKids === 'Eukaryotic:1|Prokaryotic:0' && cards === every.length &&
    figs === wantFigs && photos === wantPhotos && !broken && opened === 'Plasmodesmata' &&
    pasted.length === 3 && pasted.includes('Active site') && preset === 6 && preset2 === 6 &&
    upgraded === 'Headstart|My topic' && !errs.length;
  console.log(ok ? 'biology ok' : 'biology FAILED ' + errs.join('; '));
  await b.close();
})();
