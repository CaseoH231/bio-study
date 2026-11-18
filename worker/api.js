// Everything under /api/: reading photos of notes, the study helper, publishing notes to GitHub, and "who am I".
import { organise, json } from './organise.js';
import { assistant } from './assistant.js';
import { access } from './access.js';
import { publish, published } from './publish.js';

export async function handleApi(request, env) {
  const { pathname } = new URL(request.url);
  if (pathname === '/api/organise') return organise(request, env);
  if (pathname === '/api/assistant') return assistant(request, env);
  if (pathname === '/api/publish') return publish(request, env);
  if (pathname === '/api/published') return published(request, env);
  if (pathname === '/api/whoami') {
    // Tells the app whether this device may use the AI features, and the address to put in OWNER_IPS.
    const a = access(request, env);
    return json({ ip: a.ip, suggest: a.suggest, owner: a.owner, locked: a.locked, ipLocked: a.ipLocked, hasPasscode: a.hasPasscode, ai: !!env.AI || !!env.ANTHROPIC_API_KEY });
  }
  return json({ error: 'not-found' }, 404);
}
