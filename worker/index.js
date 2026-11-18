// Worker entry used when Cloudflare builds this repository itself (wrangler.jsonc):
// /api/... is handled here (photos of notes, the study helper); everything else is a file from the site.
import { handleApi } from './api.js';

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname.startsWith('/api/')) return handleApi(request, env);
    return env.ASSETS.fetch(request);
  },
};
