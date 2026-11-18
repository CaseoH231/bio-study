// POST /api/organise – reads photos of handwritten notes and returns a plan: which notes to make,
// what they say, and which topic (existing or new) each one goes in. The app shows the plan for checking
// before anything is saved.
//
// Two readers:
//   • Free (default): Cloudflare Workers AI, Google's Gemma 4 model, through the Worker's AI binding.
//     Free plan = 10,000 "neurons" a day (roughly 50 pages); it simply stops for the day after that, never charges.
//     The passcode is optional here (set APP_PASSCODE if you want one).
//   • Claude (optional, paid): used instead when the Worker has an ANTHROPIC_API_KEY secret.
//     Then APP_PASSCODE is required, so strangers can't use up the API credit.
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

const FREE_MODEL = '@cf/google/gemma-4-26b-a4b-it';

// Extra guidance for the free model, which needs a worked example to follow the rules closely.
const FREE_EXTRA = `
Follow these closely:
- Every line the student wrote must end up in that note's definition or key_points. Don't drop any lines and don't add your own.
- The definition says what the thing IS or DOES (its job), e.g. "Site of aerobic respiration, which releases energy as ATP." Never a fact about the word itself.
- filled is false whenever the definition comes from the page. It is true only for things the page merely names.
- If a heading gives several names ("Golgi bodies / complex / apparatus"), the title is the main singular name ("Golgi body") and a key point says "Also called the Golgi complex or Golgi apparatus".
- Short related lines under a heading (like "exocytosis – exo = exit, cyt = cell" under Lysosomes) are key points of that heading, not new notes.
- Topic names start with a capital letter.

Example. A page reads:
  Mitochondria – plural, Mitochondrion – singular
  - RELEASES energy – ATP
  - "Jiggly wiggly's" is cristae
  Organelles: Nucleus, Ribosome
Good notes:
  {"title":"Mitochondria","definition":"Release energy for the cell, as ATP.","key_points":["Mitochondria = plural, mitochondrion = singular","RELEASES energy – ATP","The “jiggly wiggly” folds are the cristae"],"filled":false, ...}
  {"title":"Nucleus","definition":"Contains the cell's DNA and controls the cell's activities.","key_points":[],"filled":true, ...}
  {"title":"Ribosome","definition":"Where proteins are made.","key_points":[],"filled":true, ...}`;

// If the model didn't pick a built-in diagram, match one from the note's name.
const DIAGRAM_WORDS = [
  [/nucle(us|i)\b/i, 'nucleus'], [/mitochond/i, 'mitochondria'], [/chloroplast/i, 'chloroplast'], [/ribosom/i, 'ribosome'],
  [/(cell|plasma|surface) membrane/i, 'membrane'], [/cell wall/i, 'wall'], [/vacuole/i, 'vacuole'], [/cytoplasm/i, 'cytoplasm'],
  [/endoplasmic|\b[rs]?er\b/i, 'er'], [/golgi/i, 'golgi'], [/lysosom/i, 'lysosome'], [/plasmodesm/i, 'plasmodesmata'],
  [/peroxisom/i, 'peroxisome'], [/cyto ?skelet/i, 'cytoskeleton'], [/plasmid/i, 'plasmid'],
];
const guessDiagram = (title) => DIAGRAM_WORDS.find(([re]) => re.test(title))?.[1] || 'none';
const capital = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// Turn whatever the model sent back into a well-formed plan (free models don't always follow the schema exactly).
const str = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v));
const num = (v) => (Number.isFinite(+v) ? +v : NaN);
export function tidyPlan(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const drawing = (d) => {
    if (!d || typeof d !== 'object') return null;
    const b = { page: num(d.page) || 1, x0: num(d.x0), y0: num(d.y0), x1: num(d.x1), y1: num(d.y1) };
    return [b.x0, b.y0, b.x1, b.y1].every(Number.isFinite) ? b : null;
  };
  return {
    summary: str(o.summary),
    new_topics: (Array.isArray(o.new_topics) ? o.new_topics : []).map((t) => ({ key: str(t?.key), name: capital(str(t?.name)), parent: t?.parent ? str(t.parent) : null }))
      .filter((t) => t.key && t.name),
    notes: (Array.isArray(o.notes) ? o.notes : []).map((n) => ({
      topic: str(n?.topic), title: str(n?.title), definition: str(n?.definition),
      key_points: (Array.isArray(n?.key_points) ? n.key_points : []).map(str).filter(Boolean),
      found_in: str(n?.found_in), diagram: DIAGRAM_KEYS.includes(n?.diagram) && n.diagram !== 'none' ? n.diagram : guessDiagram(str(n?.title)),
      filled: n?.filled === true && !!str(n?.definition), drawing: drawing(n?.drawing),
    })).filter((n) => n.title),
    unreadable: (Array.isArray(o.unreadable) ? o.unreadable : []).map(str).filter(Boolean),
  };
}
// Pull the JSON object out of a model's reply (it may be wrapped in ```json fences or have words around it).
export function readJSON(reply) {
  if (reply && typeof reply === 'object') return reply;
  const text = String(reply || '');
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

async function readWithWorkersAI(env, images, ask) {
  const content = images.flatMap((im, i) => [
    { type: 'text', text: `Page ${i + 1}:` },
    { type: 'image_url', image_url: { url: `data:${im.media_type};base64,${im.data}` } },
  ]);
  content.push({ type: 'text', text: ask });
  const out = await env.AI.run(FREE_MODEL, {
    messages: [
      { role: 'system', content: `${SYSTEM}\n${FREE_EXTRA}\n\nReply with one JSON object only, with exactly these fields: summary, new_topics, notes, unreadable.` },
      { role: 'user', content },
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'plan', schema: z.toJSONSchema(Plan), strict: true } },
    max_completion_tokens: 6000,
    temperature: 0.2,
    chat_template_kwargs: { enable_thinking: false }, // long "thinking" made requests time out
  });
  const reply = out?.choices?.[0]?.message?.content ?? out?.response;
  const raw = readJSON(reply);
  return raw ? tidyPlan(raw) : null;
}

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function organise(request, env) {
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  const useClaude = !!env.ANTHROPIC_API_KEY;
  if (!useClaude && !env.AI) return json({ error: 'not-set-up' }, 503);
  // Claude costs money, so it needs a passcode; the free reader only needs one if you've set it.
  if (useClaude && !env.APP_PASSCODE) return json({ error: 'not-set-up' }, 503);
  if (env.APP_PASSCODE && request.headers.get('x-passcode') !== env.APP_PASSCODE) return json({ error: 'passcode' }, 401);
  if (Number(request.headers.get('content-length') || 0) > 25e6) return json({ error: 'too-big' }, 413);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad-request' }, 400); }
  const images = Array.isArray(body.images) ? body.images : [];
  if (!images.length || images.length > 8 || images.some((im) => !TYPES.includes(im.media_type) || typeof im.data !== 'string')) {
    return json({ error: 'bad-images' }, 400);
  }
  const tree = Array.isArray(body.tree) ? body.tree.slice(0, 300) : [];

  const ask = `Topics already in the app:\n${JSON.stringify(tree)}\n\nOrganise the notes in ${images.length === 1 ? 'this photo' : `these ${images.length} photos`}.`;

  if (!useClaude) {
    try {
      const plan = await readWithWorkersAI(env, images, ask);
      if (!plan || (!plan.notes.length && !plan.summary)) return json({ error: 'no-plan' }, 502);
      return json({ plan, reader: 'free', model: FREE_MODEL });
    } catch (err) {
      const msg = String(err?.message || err);
      if (/neuron|allocation|3036|quota|limit/i.test(msg)) return json({ error: 'daily-limit' }, 429);
      return json({ error: 'failed', detail: msg }, 500);
    }
  }

  const content = images.flatMap((im, i) => [
    { type: 'text', text: `Page ${i + 1}:` },
    { type: 'image', source: { type: 'base64', media_type: im.media_type, data: im.data } },
  ]);
  content.push({ type: 'text', text: ask });

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
    return json({ plan: msg.parsed_output, reader: 'claude', model: msg.model });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return json({ error: 'bad-key' }, 500);
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'busy' }, 429);
    if (err instanceof Anthropic.BadRequestError) return json({ error: 'rejected', detail: err.message }, 400);
    if (err instanceof Anthropic.APIError) return json({ error: 'api', status: err.status }, 502);
    return json({ error: 'failed', detail: String(err?.message || err) }, 500);
  }
}
