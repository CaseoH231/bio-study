# Bio Study Notes

A biology revision app. Type or paste what you've learnt and it sorts it into topics of clickable cards,
each with its definition, key points and a **coloured, labelled diagram**.

Live at **https://bio-study.adrian11jonker.workers.dev**

## What it does
- Opens on a **Dashboard**: greeting, a clickable plant cell, totals, your topics and latest notes. The dark sidebar holds search, topics, Flashcards, Paste notes and Backup.
- **Topics** of note cards. Click a card for the definition, key points and labelled diagram.
- **+ New topic**: ready-made topics (Cell transport, Enzymes, Photosynthesis, Respiration, Cell division, DNA & genetics, Microscopy, Specialised cells), each with starter definitions, or a blank one.
- **Cell explorer**: click part of an animal, plant or bacterial cell to open that organelle's notes.
- **Hide the labels** on a diagram to test yourself, then click each label to reveal it.
- **+ Add note / Edit**: name, definition, key points, where it's found, a built-in diagram, and your own picture.
- **Paste notes**: lines like `Nucleus: contains DNA` become cards (lines starting with `-` become key points). Organelle names get their diagram automatically.
- **Flashcards**: definition → name, name → definition, or diagram → name.
- **Install app** (Chrome/Edge): desktop icon, works offline. Notes are saved in the browser on that device. Use **Backup & reset → Download a backup** to keep a copy or move them.

## Run it on your computer
Open the folder in VS Code → right-click `index.html` → **Open with Live Server**.

## Cloudflare
The Worker is **bio-study**. To make every push to `main` update the site by itself (one-time):
Cloudflare → **Workers & Pages → bio-study → Settings → Builds → Connect** → pick this repository, branch `main`,
build command empty, deploy command `npx wrangler deploy`, root directory empty.

`wrangler.jsonc` = serve this folder as a website. `_headers` = always check for a newer version.
`.assetsignore` = keep tests, tools and these notes off the site.
Without GitHub, `tools/build_bio_worker.py` packs the app into one Worker script that can be deployed with `npx wrangler deploy`.

## Files
```
index.html            page layout (sidebar + main area)
style.css             all the styling (Coop Ledger-style layout)
app.js                everything the app does: topics, cards, dialogs, paste, flashcards, saving
data.js               the notes from my notebook (the starting notes)
img/                  photos of my hand-drawn diagrams
presets.js            the ready-made topics
diagrams.js           the coloured, labelled diagrams and the clickable cells
sw.js                 lets the installed app work offline
tests/                bash tests/run_tests.sh
tools/                build_bio_worker.py (deploy without GitHub)
```
