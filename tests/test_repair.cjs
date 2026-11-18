// The "Personal inside Donut-Man's notes inside…" bug: the owner's device got wrapped in sections and that was published.
// Checks the clean-up (sync.js normalise), that imports and publishing clean what they handle, and the app's start-up repair.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const S = await import(path.join(__dirname, '..', 'sync.js'));
  const broken = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'broken-published.json'), 'utf8'));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const notesOf = (d) => d.topics.flatMap((t) => t.entries);
  const roots = (d) => d.topics.filter((t) => !t.parent).map((t) => t.name).join('|');
  const checks = [];
  const check = (name, ok) => checks.push(`${ok ? 'ok  ' : 'FAIL'} ${name}`);

  const fixed = clone(broken);
  check('clean-up reports it changed something', S.normalise(fixed) === true);
  check('no section topics or dm- ids are left', !fixed.topics.some((t) => /^(dm-|personal$|owner-notes$)/.test(t.id) || (t.parent || '').startsWith('dm-'))
    && !notesOf(fixed).some((e) => e.id.startsWith('dm-')));
  check('every note is kept', notesOf(fixed).length === notesOf(broken).length);
  check('top level is Headstart and the test topic', roots(fixed) === 'Headstart|test');
  check('the original ids come back', !!notesOf(fixed).find((e) => e.id === 'e-nucleus') && fixed.topics.find((t) => t.id === 'mwlqyunxqisqo')?.parent === 'mwlqwluax4xpu');
  check('every parent exists', fixed.topics.every((t) => !t.parent || fixed.topics.some((x) => x.id === t.parent)));
  check('cleaning clean notes changes nothing', S.normalise(clone(fixed)) === false);

  // A friend importing the broken published notes gets the clean version, in both modes.
  const friend = { version: 1, topics: [{ id: 'mine', name: 'My own', color: '#000', entries: [{ id: 'm1', title: 'Mine', definition: 'x', notes: [] }] }] };
  S.mergeImport(friend, broken);
  check('merge import of broken notes comes in clean', roots(friend) === 'Headstart|test|My own' && !friend.topics.some((t) => t.id.startsWith('dm-') || t.id === 'personal'));
  const sep = { version: 1, topics: [{ id: 'mine', name: 'My own', color: '#000', entries: [] }] };
  S.separateImport(sep, broken); S.separateImport(sep, broken); // twice, like pressing "Get latest" again
  check('separate import never nests', roots(sep) === "Personal|Donut-Man's notes" && !sep.topics.some((t) => t.id.startsWith('dm-dm-') || t.id === 'dm-personal')
    && notesOf(sep).filter((e) => e.id.startsWith('dm-')).length === notesOf(broken).length);

  // The app: the owner's device holding the broken layout is repaired on start-up; "Get latest" and "separate" are off there;
  // publishing sends clean notes.
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept('pw'));
  let sent = null;
  await p.route('**/api/published', (r) => r.fulfill({ json: broken }));
  await p.route('**/api/publish', (r) => { sent = r.request().postDataJSON(); r.fulfill({ json: { ok: true, count: 26 } }); });
  await p.goto('http://localhost:8766/');
  await p.evaluate((d) => { localStorage.setItem('bio-study-notes-v1', JSON.stringify({ ...d, owner: true, settings: { separate: true, autoUpdate: true } }));
    localStorage.setItem('bio-study-passcode', 'pw'); }, broken);
  await p.reload(); await p.waitForTimeout(600);
  const sidebar = await p.$$eval('#topics > .node > .topic .nm', (x) => x.map((e) => e.textContent).join('|'));
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('bio-study-notes-v1')));
  await p.click('.more:not(.topic-menu) summary'); await p.click('#btn-latest'); await p.waitForSelector('#toast.show');
  const latestMsg = await p.textContent('#toast');
  const afterLatest = await p.$$eval('#topics > .node > .topic .nm', (x) => x.map((e) => e.textContent).join('|'));
  await p.click('.more:not(.topic-menu) summary'); await p.click('#btn-settings');
  const sepLocked = await p.isDisabled('#set-separate'); await p.keyboard.press('Escape');
  await p.click('.more:not(.topic-menu) summary'); await p.click('#btn-publish'); await p.click('#pub-go'); await p.waitForSelector('text=Published ✓');
  await p.evaluate(() => localStorage.clear());
  check('app: owner device repaired on start-up', sidebar === 'Headstart|test' && notesOf(stored).length === notesOf(broken).length && stored.settings.separate === false);
  check('app: "Get latest" does nothing on the owner device', /your own device/.test(latestMsg) && afterLatest === 'Headstart|test');
  check('app: "keep separate" is off on the owner device', sepLocked);
  check('app: publishing sends clean notes only', roots(sent.notes) === 'Headstart|test' && !('sync' in sent.notes) && !('settings' in sent.notes) && !('owner' in sent.notes));
  check('app: no errors', !errs.length);
  await b.close();
  console.log(checks.join('\n'));
  console.log(checks.every((c) => c.startsWith('ok')) ? 'repair ok' : 'repair FAILED ' + errs.join('; '));
})();
