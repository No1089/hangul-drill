// Scheduling and distractor choice. Pure functions over a plain state object so they can be tested in Node.
//
// Each letter has a Leitner box (0-5) per direction. Getting a question right on the first try moves it up a
// box; any mistake sends it back to 0 and brings it back again 2-4 questions later. Lower boxes are picked
// more often. With gradual introduction on, a new letter is only added once fewer than three letters in
// rotation are still weak (box < 2).

export const WEIGHTS = [10, 6, 3, 1.5, 0.6, 0.3];
export const MAX_BOX = WEIGHTS.length - 1;
const MAX_WEAK = 3;
const MIN_ACTIVE = 3;

export const newState = () => ({ turn: 0, items: {}, confusions: {}, requeue: [], recent: [] });

export const keyOf = (dir, id) => `${dir}|${id}`;
export const recordOf = (state, dir, id) => state.items[keyOf(dir, id)];

function weightedIndex(weights, rng) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) if ((r -= weights[i]) < 0) return i;
  return weights.length - 1;
}

// pool: item ids in teaching order. Returns { id, isNew, again }.
// play: plain random choice from the whole pool (still avoiding immediate repeats), no scheduling.
export function pickNext(pool, dir, state, { gradual = true, play = false, rng = Math.random } = {}) {
  if (play) gradual = false;
  const due = state.requeue.findIndex(r => r.dir === dir && r.at <= state.turn && pool.includes(r.id));
  if (due >= 0 && !play) return { id: state.requeue.splice(due, 1)[0].id, isNew: false, again: true };

  const seen = pool.filter(id => recordOf(state, dir, id)?.seen);
  if (gradual) {
    const unseen = pool.find(id => !recordOf(state, dir, id)?.seen);
    const weak = seen.filter(id => recordOf(state, dir, id).box < 2).length;
    if (unseen && (seen.length < MIN_ACTIVE || weak < MAX_WEAK)) return { id: unseen, isNew: true, again: false };
  }
  let active = gradual && seen.length ? seen : pool;
  // Don't repeat the last couple of letters when there's enough else to ask.
  const recent = state.recent.filter(r => r.dir === dir).slice(-2).map(r => r.id);
  if (active.length > recent.length + 1) active = active.filter(id => !recent.includes(id));
  const weights = active.map(id => (play ? 1 : WEIGHTS[recordOf(state, dir, id)?.box ?? 0]));
  return { id: active[weightedIndex(weights, rng)], isNew: false, again: false };
}

// wrongIds: the options picked before the right one, in order.
export function recordAnswer(state, dir, id, wrongIds, { rng = Math.random } = {}) {
  const key = keyOf(dir, id);
  const r = state.items[key] ??= { box: 0, seen: 0, right: 0, wrong: 0 };
  r.seen++;
  if (wrongIds.length === 0) {
    r.right++;
    r.box = Math.min(MAX_BOX, r.box + 1);
  } else {
    r.wrong++;
    r.box = 0;
    state.requeue = state.requeue.filter(q => !(q.dir === dir && q.id === id));
    state.requeue.push({ dir, id, at: state.turn + 2 + Math.floor(rng() * 3) });
    const c = state.confusions[id] ??= {};
    for (const w of wrongIds) c[w] = (c[w] || 0) + 1;
  }
  state.recent = [...state.recent, { dir, id }].slice(-6);
  state.turn++;
}

// Choose n-1 distractors from candidates (item objects). Letters that look or sound alike, and letters
// this one has been confused with before, are favoured. No two options may show the same label.
export function pickDistractors(item, n, dir, candidates, state, { similar = () => false, rng = Math.random } = {}) {
  const label = dir === 'read' ? i => i.roman : i => i.hangul;
  const used = new Set([label(item)]);
  const confused = state.confusions[item.id] || {};
  let pool = candidates.filter(c => c.id !== item.id);
  const out = [];
  while (out.length < n - 1 && pool.length) {
    const weights = pool.map(c => 1 + (similar(item, c) ? 4 : 0) + Math.min(6, 2 * (confused[c.id] || 0)));
    const [c] = pool.splice(weightedIndex(weights, rng), 1);
    if (used.has(label(c))) continue;
    used.add(label(c));
    out.push(c);
  }
  return out;
}

export function shuffle(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
