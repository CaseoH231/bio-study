# Bio Study Notes — notes for Claude

A biology revision web app (plain HTML/CSS/JS ES modules, no build step). Personal project, Cloudflare Worker `bio-study`.

- Notes live in the browser's localStorage (`bio-study-notes-v1`). Don't break that format without a migration.
- Run `bash tests/run_tests.sh` before pushing; it must PASS.
- Each release: bump the cache name in `sw.js` (`bio-study-vN`) and add any new file to its FILES list.
- Scanning photos (`worker/organise.js`, POST /api/organise): free by default via the Workers AI binding (`env.AI`, Gemma 4, thinking off – it timed out otherwise). If the user ever adds ANTHROPIC_API_KEY it uses Claude instead (then APP_PASSCODE is required). Tests fake both – never call the real ones from tests.
- The study helper (`worker/assistant.js`, POST /api/assistant) suggests actions; the app applies them only after "Do it". `worker/access.js` locks the AI endpoints to OWNER_IPS / APP_PASSCODE (secrets the user sets). Notes never go to the server.
- Publishing (`worker/publish.js`): POST /api/publish commits the owner's notes to `published/notes.json` with the GITHUB_TOKEN secret (always needs APP_PASSCODE); GET /api/published serves them, and new visitors start with them. To see the user's current notes, read `published/notes.json` on main.
- Course page (`#/course`, `course.js` + `worker/course.js`, the same files in bio-study and Specialist-Study – keep them identical): the owner uploads the study design and work plan (PDF/images) to `course/` in the repo via `/api/course` (APP_PASSCODE); everyone views them at `/course/<file>`.
- Friends' copies pull in published notes on open (`sync.js`: three-way merge using fingerprints in `d.sync`, or separate Personal / "Donut-Man's notes" sections). The owner's device (`db.owner` or a saved passcode) never pulls.
- Deploy: `npm install`, then `python3 tools/build_bio_worker.py OUT && cd OUT && npx wrangler deploy` (or Cloudflare's GitHub build, if connected).
- Commit and push to `main`. Don't ask for permission to start; just do the work and push.
- After every change, summarise in plain language and end with `Total lines of code: N`, counted with:
  `find . -path ./.git -prune -o -path ./.wrangler -prune -o -path ./node_modules -prune -o -type f \( -name '*.js' -o -name '*.cjs' -o -name '*.py' -o -name '*.html' -o -name '*.css' -o -name '*.sh' -o -name '*.webmanifest' -o -name '*.jsonc' \) -print | xargs cat | wc -l`
