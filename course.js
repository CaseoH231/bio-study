// The Course page (#/course): the study design (what's learnt across the year) and the work plan (when).
// Same file in bio-study and Specialist-Study. The owner uploads PDFs or photos; everyone can view them.
// The app passes in what it needs: isOwner(), callApi(path, body) and toast(msg).
const SAVED = 'study-course-cache';
const KINDS = { design: { name: 'Study design', what: 'What you’ll learn across the year' }, plan: { name: 'Work plan', what: 'When each part is taught' } };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let course = (() => { try { return JSON.parse(localStorage.getItem(SAVED)) || null; } catch { return null; } })() || { design: [], plan: [] };
let tab = 'design', shown = null, busy = false;

export async function loadCourse() {
  try {
    const r = await fetch('api/course', { cache: 'no-store' });
    if (r.ok) { course = { design: [], plan: [], ...(await r.json()) }; try { localStorage.setItem(SAVED, JSON.stringify(course)); } catch { /* full */ } }
  } catch { /* offline: keep the saved list */ }
  return course;
}
export const courseCount = () => course.design.length + course.plan.length;

const size = (n) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);
const day = (iso) => { const d = new Date(`${iso}T00:00:00`); return isNaN(d) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); };
const view = (f) => (f.type === 'application/pdf'
  ? `<iframe class="c-doc" src="course/${esc(f.file)}#view=FitH" title="${esc(f.name)}"></iframe>
     <a class="c-open" href="course/${esc(f.file)}" target="_blank" rel="noopener"><span>📄</span>Tap to open “${esc(f.name)}”<small>Opens in your phone’s PDF viewer</small></a>`
  : `<img class="c-doc" src="course/${esc(f.file)}" alt="${esc(f.name)}">`);

export function courseHtml(owner) {
  const files = course[tab] || [];
  if (!files.some((f) => f.id === shown)) shown = files[0]?.id || null;
  const cur = files.find((f) => f.id === shown);
  return `<nav class="crumbs" aria-label="You are here"><a href="#/">Home</a> <span>›</span> <b>Course</b></nav>
    <div class="bar"><h2>Course</h2><div class="tools">${owner ? `<label class="btn primary-btn c-up">⤒ Upload ${KINDS[tab].name.toLowerCase()}
      <input type="file" id="c-file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple hidden></label>` : ''}</div></div>
    <div class="tabs c-tabs">${Object.entries(KINDS).map(([k, v]) => `<button data-ctab="${k}" class="${k === tab ? 'on' : ''}">${v.name}<span class="count">${course[k].length}</span></button>`).join('')}</div>
    <p class="lead">${KINDS[tab].what}.${owner ? ' PDFs or photos – everyone with the link can see them.' : ''}</p>
    ${busy ? '<div class="empty"><div class="spinner"></div><p>Uploading…</p></div>' : ''}
    ${files.length ? `<div class="c-files">${files.map((f) => `<div class="c-file ${f.id === shown ? 'on' : ''}">
        <button class="c-pick" data-cshow="${f.id}"><span class="c-ico">${f.type === 'application/pdf' ? 'PDF' : 'IMG'}</span>
          <span><b>${esc(f.name)}</b><small>${esc(day(f.added))} · ${size(f.size || 0)}</small></span></button>
        <a class="btn" href="course/${esc(f.file)}" target="_blank" rel="noopener">Open ↗</a>
        ${owner ? `<button class="link danger" data-cdel="${f.id}" aria-label="Remove ${esc(f.name)}">Remove</button>` : ''}</div>`).join('')}</div>
      ${cur ? `<div class="c-view">${view(cur)}</div>` : ''}`
    : busy ? '' : `<div class="empty"><p>No ${KINDS[tab].name.toLowerCase()} yet.</p>${owner ? '<p>Upload the PDF (or photos of it) with the button above.</p>' : ''}</div>`}`;
}

const readB64 = (file) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(file); });
const problem = (res, data) => (!res ? 'No internet connection.' : data.error === 'not-set-up' ? 'The site isn’t set up for saving yet (GITHUB_TOKEN / APP_PASSCODE secrets).'
  : data.error === 'bad-token' ? 'GitHub refused – the GITHUB_TOKEN secret may have expired.' : data.error === 'too-big' ? 'That file is too big (20 MB max).' : `Something went wrong (${res.status}).`);

// Wires up the page after it's drawn. redraw() draws it again.
export function bindCourse(main, { isOwner, callApi, toast, redraw }) {
  main.onclick = async (ev) => {
    const t = ev.target.closest('[data-ctab]'); if (t) { tab = t.dataset.ctab; shown = null; return redraw(); }
    const s = ev.target.closest('[data-cshow]'); if (s) { shown = s.dataset.cshow; return redraw(); }
    const d = ev.target.closest('[data-cdel]');
    if (d) {
      const f = course[tab].find((x) => x.id === d.dataset.cdel);
      if (!f || !confirm(`Remove “${f.name}”? Everyone stops seeing it.`)) return;
      const { res, data, cancelled } = await callApi('api/course', { action: 'remove', kind: tab, id: f.id });
      if (res?.ok) { course = data.course; toast('Removed ✓'); } else if (!cancelled) toast(problem(res, data));
      return redraw();
    }
  };
  const input = main.querySelector('#c-file');
  if (input) input.onchange = async () => {
    const files = [...input.files]; if (!files.length || !isOwner()) return;
    busy = true; redraw();
    let added = 0;
    for (const file of files) {
      if (file.size > 20e6) { toast(`“${file.name}” is too big (20 MB max).`); continue; }
      const { res, data, cancelled } = await callApi('api/course', { action: 'add', kind: tab, name: file.name.replace(/\.[^.]+$/, ''), type: file.type, data: await readB64(file) });
      if (res?.ok) { course = data.course; added++; shown = course[tab][course[tab].length - 1]?.id; } else { toast(cancelled ? 'Not uploaded.' : problem(res, data)); break; }
    }
    busy = false;
    try { localStorage.setItem(SAVED, JSON.stringify(course)); } catch { /* full */ }
    if (added) toast(`Uploaded ${added} file${added === 1 ? '' : 's'} ✓`);
    redraw();
  };
}
