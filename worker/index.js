// Worker entry used when Cloudflare builds this repository itself (wrangler.jsonc):
// /api/organise reads photos of notes; everything else is a file from the site.
import { organise } from './organise.js';

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/organise') return organise(request, env);
    return env.ASSETS.fetch(request);
  },
};
