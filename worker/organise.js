// POST /api/organise – reads photos of handwritten notes with Claude and returns a plan:
// which notes to make, what they say, and which topic (existing or new) each one goes in.
// The app shows the plan for checking before anything is saved.
//
// Needs two Cloudflare secrets on the Worker (Settings → Variables and Secrets):
//   ANTHROPIC_API_KEY  – an API key from console.anthropic.com
//   APP_PASSCODE       – the passcode the app asks for, so strangers can't use up the API credit
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod/v4'; // the SDK's helper uses Zod 4
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';

// Built-in diagrams the app can attach to a note (same keys as diagrams.js).
const DIAGRAM_KEYS = ['nucleus', 'mitochondria', 'chloroplast', 'ribosome', 'membrane', 'wall', 'vacuole', 'cytoplasm', 'er',
  'golgi', 'lysosome', 'plasmodesmata', 'peroxisome', 'cytoskeleton', 'animalcell', 'plantcell', 'plasmid'];

const Plan = z.object({
  summary: z.string(),
  new_topics: z.array(z.object({ key: z.string(), name: z.string(), parent: z.string().nullable() })),
  notes: z.array(z.object({
    topic: z.string(),
    title: z.string(),
    definition: z.string(),
    key_points: z.array(z.string()),
    found_in: z.string(),
    diagram: z.enum([...DIAGRAM_KEYS, 'none']),
    filled: z.boolean(),
    drawing: z.object({ page: z.number(), x0: z.number(), y0: z.number(), x1: z.number(), y1: z.number() }).nullable(),
  })),
  unreadable: z.array(z.string()),
});

const SYSTEM = `You help a high-school biology student turn photos of their handwritten notes into their study app. The app keeps notes in topics, and topics can sit inside other topics like folders.

Make one note for each thing the student wrote about (usually a term, organelle, structure or process):
- title: the name as the student wrote it, spelled correctly (e.g. "Mitochondria").
- definition: one or two sentences saying what it is or does, taken from the student's own words on the page, with spelling and grammar fixed. Don't add facts that aren't on the page. If the page only names it with nothing about it, write a short, accurate definition at the student's level and set filled to true; otherwise filled is false.
- key_points: everything else they wrote about it, one point per item, keeping their wording (memory tricks included) with spelling fixed. Fold a sub-bullet into its parent point with a dash. If a drawing of it labels parts, add one point "Parts (from my diagram): …" listing the labels.
- found_in: where it's found if the notes say so (e.g. "Plant only", "Plant, Animal"), otherwise "".
- diagram: the built-in diagram key that shows the same thing, or "none".
- drawing: if the student drew a diagram of it, the box around the drawing and its labels – page (1-based) and x0, y0, x1, y1 in thousandths of the page width and height (0–1000). Otherwise null.

Where each note goes: you're given the app's existing topics with their ids, parents and the notes already in them. Put a note in an existing topic whenever it fits – and always where a note with the same title already is (the app merges them). Only make a new topic when nothing existing fits, and nest it inside an existing topic when it belongs there. Use the page's headings and groupings as a guide: a heading like "Plant Cell Organelles" with a bracket labelled "unique plant organelles" means those notes belong together under that idea. A new topic gets a key such as "new-1"; notes and new topics name their topic or parent by an existing id or a new key (parent null = top level). Don't make empty topics.

summary: one or two friendly sentences telling the student what you found and where it went.
unreadable: anything you couldn't read or weren't sure about, so the student can check it.

Ignore page furniture such as the subject name at the top, dates and doodles.`;

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function organise(request, env) {
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  // Both secrets are needed: without a passcode anyone could use up the API credit.
  if (!env.ANTHROPIC_API_KEY || !env.APP_PASSCODE) return json({ error: 'not-set-up' }, 503);
  if (request.headers.get('x-passcode') !== env.APP_PASSCODE) return json({ error: 'passcode' }, 401);
  if (Number(request.headers.get('content-length') || 0) > 25e6) return json({ error: 'too-big' }, 413);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad-request' }, 400); }
  const images = Array.isArray(body.images) ? body.images : [];
  if (!images.length || images.length > 8 || images.some((im) => !TYPES.includes(im.media_type) || typeof im.data !== 'string')) {
    return json({ error: 'bad-images' }, 400);
  }
  const tree = Array.isArray(body.tree) ? body.tree.slice(0, 300) : [];

  const content = images.flatMap((im, i) => [
    { type: 'text', text: `Page ${i + 1}:` },
    { type: 'image', source: { type: 'base64', media_type: im.media_type, data: im.data } },
  ]);
  content.push({ type: 'text', text: `Topics already in the app:\n${JSON.stringify(tree)}\n\nOrganise the notes in ${images.length === 1 ? 'this photo' : `these ${images.length} photos`}.` });

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}) });
  try {
    const msg = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default', // if the request is declined, the API retries it on a fallback model
      output_config: { effort: 'medium', format: betaZodOutputFormat(Plan) },
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    });
    if (msg.stop_reason === 'refusal') return json({ error: 'refused' }, 422);
    if (msg.stop_reason === 'max_tokens') return json({ error: 'too-long' }, 422);
    if (!msg.parsed_output) return json({ error: 'no-plan' }, 502);
    return json({ plan: msg.parsed_output, model: msg.model });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return json({ error: 'bad-key' }, 500);
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'busy' }, 429);
    if (err instanceof Anthropic.BadRequestError) return json({ error: 'rejected', detail: err.message }, 400);
    if (err instanceof Anthropic.APIError) return json({ error: 'api', status: err.status }, 502);
    return json({ error: 'failed', detail: String(err?.message || err) }, 500);
  }
}
