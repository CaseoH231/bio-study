// The study helper and the "owner only" lock: the Worker side with a fake AI, and the chat in the app with a faked Worker.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const { handleApi } = await import(path.join(__dirname, '..', 'worker', 'api.js'));
  const req = (url, { body, ip = '198.51.100.9', pass } = {}) => new Request(`http://x${url}`, {
    method: body ? 'POST' : 'GET', body: body && JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...(pass ? { 'x-passcode': pass } : {}) },
  });
  let lastInput = null;
  const AI = { run: async (model, input) => { lastInput = input; return { choices: [{ message: { content: JSON.stringify({ reply: 'Sure!', actions: [{ type: 'open', note: 'e-golgi' }] }) } }] }; } };
  const ask = { messages: [{ role: 'user', content: 'What does the Golgi do?' }], notes: '[t-shared] Shared\n  (e-golgi) Golgi body: packages proteins', where: 'the dashboard' };
  const env = { AI, OWNER_IPS: '203.0.113.7, 2001:db8:1:2::/64', APP_PASSCODE: 'pw' };
  const who = async (o) => (await handleApi(req('/api/whoami', o), env)).json();
  const results = [
    (await who({ ip: '203.0.113.7' })).owner,                           // true: owner's IPv4
    (await who({ ip: '2001:db8:1:2:abcd::9' })).owner,                  // true: owner's IPv6 network
    (await who({ ip: '198.51.100.9' })).owner,                          // false: a friend
    (await who({ ip: '198.51.100.9', pass: 'pw' })).owner,              // true: friend's network but with the passcode
    (await handleApi(req('/api/assistant', { body: ask }), env)).status, // 401: friend, passcode exists
    (await handleApi(req('/api/assistant', { body: ask }), { AI, OWNER_IPS: '203.0.113.7' })).status, // 403: no passcode to try
    (await handleApi(req('/api/assistant', { body: ask, ip: '203.0.113.7' }), env)).status,          // 200: owner
  ].join(',');
  const sentNotes = lastInput.messages[0].content.includes('(e-golgi) Golgi body') && lastInput.messages.at(-1).content === 'What does the Golgi do?';
  const open = !!(await (await handleApi(req('/api/assistant', { body: ask }), { AI })).json()).reply; // nothing set: open to all

  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  // A friend: no AI buttons at all.
  await p.route('**/api/whoami', (r) => r.fulfill({ json: { owner: false, ai: true, locked: true, ipLocked: true, hasPasscode: false } }));
  await p.goto('http://localhost:8766/'); await p.waitForTimeout(400);
  const friendSees = [await p.isVisible('#bot-btn'), await p.isVisible('#btn-scan')].join(',');
  // The owner.
  await p.unroute('**/api/whoami');
  await p.route('**/api/whoami', (r) => r.fulfill({ json: { owner: true, ai: true, locked: true, ipLocked: true, hasPasscode: true, ip: '203.0.113.7', suggest: '203.0.113.7' } }));
  const replies = [
    { reply: 'Here’s a new topic and note.', actions: [
      { type: 'add_topic', key: 'new-1', name: 'Cell transport', parent: 't-headstart' },
      { type: 'add_note', topic: 'new-1', title: 'Osmosis', definition: 'Water moving through a partially permeable membrane.', key_points: ['from dilute to concentrated'] },
      { type: 'update_note', note: 'e-lyso', key_points: ['Contain hydrolytic enzymes'] },
      { type: 'delete_note', note: 'does-not-exist' }] },
    { reply: 'Opening the Golgi body.', actions: [{ type: 'open', note: 'e-golgi' }] },
    { reply: 'Let’s quiz!', actions: [{ type: 'quiz', topic: 't-animal' }] },
  ];
  let sent = [];
  await p.route('**/api/assistant', (r) => { sent.push(r.request().postDataJSON()); r.fulfill({ json: replies[sent.length - 1] }); });
  await p.reload(); await p.waitForTimeout(400);
  const ownerSees = [await p.isVisible('#bot-btn'), await p.isVisible('#btn-scan')].join(',');
  await p.click('#bot-btn');
  await p.fill('#bot-input', 'Make a cell transport topic with osmosis'); await p.keyboard.press('Enter');
  await p.waitForSelector('[data-do]');
  const proposal = await p.$$eval('.proposal li', (l) => l.map((x) => x.textContent));
  await p.click('[data-do]'); await p.waitForTimeout(200);
  const data = await p.evaluate(() => JSON.parse(localStorage.getItem('bio-study-notes-v1')));
  const ct = data.topics.find((t) => t.name === 'Cell transport');
  const lyso = data.topics.find((t) => t.id === 't-animal').entries.find((e) => e.id === 'e-lyso');
  await p.fill('#bot-input', 'Show me the Golgi body'); await p.keyboard.press('Enter');
  await p.waitForFunction(() => document.querySelector('.note-page h2')?.textContent === 'Golgi body');
  await p.fill('#bot-input', 'Quiz me on animal cells'); await p.keyboard.press('Enter');
  await p.waitForSelector('.fc'); const quizLeft = await p.textContent('#dlg .where');
  await p.evaluate(() => localStorage.clear());
  console.log('worker', results, '| notes sent', sentNotes, '| open when unlocked', open, '| friend sees', friendSees, '| owner sees', ownerSees,
    '| proposal', proposal.join(' / '), '| topic', ct?.parent, ct?.entries[0]?.title, '| lyso', lyso.notes.at(-1), '| history', sent[1].messages.length, '| quiz', quizLeft, '| errors', errs.length);
  const ok = results === 'true,true,false,true,401,403,200' && sentNotes && open && friendSees === 'false,false' && ownerSees === 'true,true'
    && proposal.length === 3 && ct?.parent === 't-headstart' && ct.entries[0].title === 'Osmosis' && lyso.notes.at(-1) === 'Contain hydrolytic enzymes'
    && sent[1].messages.length === 3 && sent[0].notes.includes('[t-headstart] Headstart') && quizLeft === '2 left' && !errs.length;
  console.log(ok ? 'helper ok' : 'helper FAILED ' + errs.join('; '));
  await b.close();
})();
