# Bio Study Notes

A biology revision app. Type or paste what you've learnt and it sorts it into topics of clickable cards,
each with its definition, key points and a **coloured, labelled diagram**.

Live at **https://bio-study.adrian11jonker.workers.dev**

## What it does
- Opens on a **Dashboard**: greeting, a clickable plant cell, totals, your topics and latest notes. The dark sidebar holds search, topics, Flashcards, Paste notes and Backup.
- **Topics work like folders** (like chapters in Mathspace): a topic can hold sub-topics as well as notes. The sidebar is a tree (▸ opens a topic), each topic page has a breadcrumb trail, folder tiles for its sub-topics, and **+ Sub-topic** / **Move** buttons. Flashcards for a topic include its sub-topics.
- Click a note card and it opens as its own page (with its own address, so Back works and Ctrl-click opens a new tab): definition, key points, the parts to know, a **textbook diagram** and your own hand-drawn diagram.
- **Textbook diagrams** come from Wikimedia Commons (`img/ref/`, credits in `refs.js`, shown under each one). They're public domain or Creative Commons, chosen to match the notebook drawings.
- **+ New topic**: ready-made topics (Cell transport, Enzymes, Photosynthesis, Respiration, Cell division, DNA & genetics, Microscopy, Specialised cells), each with starter definitions, or a blank one.
- **Cell explorer**: click part of an animal, plant or bacterial cell to open that organelle's notes.
- **Hide the labels** on a diagram to test yourself, then click each label to reveal it.
- **+ Add note / Edit**: name, definition, key points, where it's found, a built-in diagram, and your own picture.
- **Paste notes**: lines like `Nucleus: contains DNA` become cards (lines starting with `-` become key points). Organelle names get their diagram automatically.
- **Flashcards**: definition → name, name → definition, or diagram → name.
- **Install app** (Chrome/Edge): desktop icon, works offline. Notes are saved in the browser on that device. Use **Backup & reset → Download a backup** to keep a copy or move them.

## Scanning photos of notes

**📷 Scan notes** (sidebar, or the button on the Dashboard): pick photos of your pages and the app reads your handwriting, makes a note for
each thing you wrote about, puts each one in the right topic (making new topics or sub-topics only when nothing fits, and adding to notes
you already have), and cuts out diagrams you drew. You check everything on a review screen before it's added.

**It's free** – no account or key needed. It uses Google's Gemma 4 model through Cloudflare Workers AI, which comes
with the Worker: about 50 pages a day for free (10,000 "neurons" a day). When that runs out it just says to try again
tomorrow – the free plan never charges. Check the notes on the review screen; it occasionally skips a line.

*Optional:* to stop other people using your daily allowance, add a Worker secret `APP_PASSCODE` (Cloudflare →
**Workers & Pages → bio-study → Settings → Variables and Secrets → Add**, type Secret). The app then asks for it once per device.

*Optional, paid:* adding a Worker secret `ANTHROPIC_API_KEY` (from console.anthropic.com, roughly 5–10 US cents a page)
switches scanning to Claude, which reads more carefully and writes definitions for things you only named.
`APP_PASSCODE` is then required.

Scanning only works on the online site (not with Live Server). The code is in `worker/organise.js`.

## Study helper (✦ Ask)

The **✦ Ask** button (bottom right) opens a chat. Ask about your notes ("What does the Golgi body do?"), or ask it to change
them ("make a Cell transport topic inside Headstart with notes on diffusion and osmosis", "move Lysosomes into Shared",
"quiz me on animal cells"). It shows the changes it suggests and **nothing changes until you press Do it**. It uses the same
free model as scanning (Gemma 4 on Cloudflare), so it's free; it can't change the app itself – for that, ask Claude in Claude Code.

## Sharing the link with friends

Everyone who opens the link (or installs it as an app) gets **their own separate notes**, saved only in their own browser.
Nothing anyone writes is uploaded, so friends can't change your notes and you can't change theirs. They start with the
notebook notes in `data.js`.

The AI features (scanning and the study helper) use your free daily allowance, so you can lock them to your laptop:
**Backup & reset → This device & AI features** shows your internet address. In Cloudflare → Workers & Pages → bio-study →
Settings → Variables and Secrets, add a **Secret** `OWNER_IPS` with the value it shows, and a **Secret** `APP_PASSCODE`
(so you can still use them at school, or when your home address changes – home addresses change from time to time).
Friends then don't see the AI buttons at all.

## Publishing your notes (owner only)

**Backup & reset → Publish my notes…** saves the notes on your device to this repository as `published/notes.json`
(backed up with full history, and visible to Claude), and makes them the starting notes for anyone opening the app for
the first time. It always asks for the passcode, so friends pressing it can't do anything. Friends who already use the
app keep their own notes; **Get the latest published notes** swaps theirs for yours if they want.

**One-time set-up:**
1. GitHub → your profile picture → **Settings → Developer settings → Personal access tokens → Fine-grained tokens →
   Generate new token**. Name it "bio-study publish", pick an expiry, **Repository access: Only select repositories →
   bio-study**, and under **Repository permissions** set **Contents** to **Read and write**. Generate it and copy it.
2. Cloudflare → **Workers & Pages → bio-study → Settings → Variables and Secrets → Add**: type **Secret**, name
   `GITHUB_TOKEN`, value: the token. (`APP_PASSCODE` must be set too – that's the passcode it asks for.)

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
data.js               the starting notes: my notes as of 18 Nov (notebook + scanner + study helper)
img/                  photos of my hand-drawn diagrams (img/notes/: drawings cut out by the scanner)
img/slides/           diagrams from the lesson slides
img/ref/              textbook diagrams from Wikimedia Commons (credits in refs.js)
refs.js               which textbook diagram goes with which note, and who made it
presets.js            the ready-made topics
diagrams.js           the coloured, labelled diagrams and the clickable cells
sw.js                 lets the installed app work offline
tests/                bash tests/run_tests.sh
tools/                build_bio_worker.py (deploy without GitHub)
worker/               the Worker: the site plus /api/organise (photos of notes), /api/assistant (study helper),
                      /api/whoami; access.js = who may use the AI features (OWNER_IPS / APP_PASSCODE)
package.json          the Worker's libraries (npm install)
```
