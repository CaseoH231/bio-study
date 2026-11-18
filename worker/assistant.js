// POST /api/assistant – the study helper chat. It answers questions about your notes (and biology in general)
// and can suggest changes: new topics or notes, edits, moves, deletions, opening a page or starting flashcards.
// Changes are only suggestions – the app shows them and nothing happens until you press "Do it".
// Uses the same free Workers AI model as scanning, on the same daily allowance.
import { z } from 'zod/v4';
import { access, refuse } from './access.js';
import { json, readJSON, FREE_MODEL } from './organise.js';

const ACTIONS = ['add_topic', 'add_note', 'update_note', 'move_note', 'delete_note', 'rename_topic', 'move_topic', 'delete_topic', 'open', 'quiz'];

const Reply = z.object({
  reply: z.string(),
  actions: z.array(z.object({
    type: z.enum(ACTIONS),
    key: z.string(), // for add_topic: a new key like "new-1" that later actions can use as a topic
    topic: z.string(), // a topic id or new key
    note: z.string(), // a note id
    name: z.string(),
    parent: z.string(),
    title: z.string(),
    definition: z.string(),
    key_points: z.array(z.string()),
    found_in: z.string(),
  }).partial().required({ type: true })),
});

const SYSTEM = `You are the study helper inside "Bio Study Notes", a high-school student's biology revision app. The student talks to you in a chat box in the app.

You're given the student's topics and notes. Topic ids look like [t-…] and note ids like (e-…). Topics can sit inside other topics like folders.

You can:
- Answer questions about their notes or about biology. Keep answers short, friendly and at high-school level. When your answer goes beyond what's in their notes, say so briefly.
- Suggest changes, but only ones the student asked for. Each change is one action:
  add_topic {key, name, parent}            – key is a new id like "new-1"; parent is a topic id, a new key, or "" for top level
  add_note {topic, title, definition, key_points, found_in}   – topic is a topic id or a new key
  update_note {note, title?, definition?, key_points?}        – key_points here are points to ADD, not a replacement
  move_note {note, topic}
  delete_note {note}
  rename_topic {topic, name}
  move_topic {topic, parent}               – parent "" means top level
  delete_topic {topic}                     – also deletes everything inside it
  open {topic} or open {note}              – show that page
  quiz {topic}                             – start flashcards on that topic ("" for all notes)
- When they ask you to add notes, write accurate, concise content in student-friendly words.

Use only ids that exist in the list (or keys you create with add_topic). In "reply", say in a sentence or two what you've answered or what you're suggesting. Changes are NOT done yet when you reply: the app shows them with a "Do it" button. So never say you've done a change – say what you suggest, e.g. "I can make a Cell transport topic with notes on diffusion and osmosis – press Do it to add them." Opening a page and starting a quiz do happen straight away.

Reply with one JSON object only: {"reply": "...", "actions": [...]} (actions is [] when there's nothing to do).`;

export async function assistant(request, env) {
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  if (!env.AI) return json({ error: 'not-set-up' }, 503);
  const who = access(request, env);
  if (!who.owner) return refuse(who, json);
  if (Number(request.headers.get('content-length') || 0) > 300000) return json({ error: 'too-big' }, 413);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad-request' }, 400); }
  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-12).map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (!history.length || history[history.length - 1].role !== 'user') return json({ error: 'bad-request' }, 400);
  const notes = String(body.notes || '').slice(0, 60000);
  const where = String(body.where || '').slice(0, 500);

  try {
    const out = await env.AI.run(FREE_MODEL, {
      messages: [
        { role: 'system', content: `${SYSTEM}\n\nThe student's topics and notes:\n${notes || '(none yet)'}\n\nThey are currently looking at: ${where || 'the dashboard'}` },
        ...history,
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'reply', schema: z.toJSONSchema(Reply), strict: true } },
      max_completion_tokens: 3000,
      temperature: 0.3,
      chat_template_kwargs: { enable_thinking: false },
    });
    const raw = readJSON(out?.choices?.[0]?.message?.content ?? out?.response);
    if (!raw || typeof raw.reply !== 'string') return json({ error: 'no-reply' }, 502);
    const actions = (Array.isArray(raw.actions) ? raw.actions : []).filter((a) => a && ACTIONS.includes(a.type)).slice(0, 40);
    return json({ reply: raw.reply.trim(), actions });
  } catch (err) {
    const msg = String(err?.message || err);
    if (/neuron|allocation|3036|quota|limit/i.test(msg)) return json({ error: 'daily-limit' }, 429);
    return json({ error: 'failed', detail: msg }, 500);
  }
}
