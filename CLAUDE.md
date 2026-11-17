# Bio Study Notes — notes for Claude

A biology revision web app (plain HTML/CSS/JS ES modules, no build step). Personal project, Cloudflare Worker `bio-study`.

- Notes live in the browser's localStorage (`bio-study-notes-v1`). Don't break that format without a migration.
- Run `bash tests/run_tests.sh` before pushing; it must PASS.
- Each release: bump the cache name in `sw.js` (`bio-study-vN`) and add any new file to its FILES list.
- Scanning photos (`worker/organise.js`, POST /api/organise) calls Claude; it needs the Worker secrets ANTHROPIC_API_KEY and APP_PASSCODE (the user sets them in Cloudflare). Tests fake the API – never call the real one from tests.
- Deploy: `npm install`, then `python3 tools/build_bio_worker.py OUT && cd OUT && npx wrangler deploy` (or Cloudflare's GitHub build, if connected).
- Commit and push to `main`. Don't ask for permission to start; just do the work and push.
- After every change, summarise in plain language and end with `Total lines of code: N`, counted with:
  `find . -path ./.git -prune -o -path ./.wrangler -prune -o -path ./node_modules -prune -o -type f \( -name '*.js' -o -name '*.cjs' -o -name '*.py' -o -name '*.html' -o -name '*.css' -o -name '*.sh' -o -name '*.webmanifest' -o -name '*.jsonc' \) -print | xargs cat | wc -l`
