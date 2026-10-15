import { GROUPS, JAMO, itemFor, buildSyllables, syllableVariants, similarItems } from './data.js';
import { newState, pickNext, recordAnswer, pickDistractors, shuffle, recordOf, MAX_BOX } from './quiz.js';

const $ = s => document.querySelector(s);
const STORE = 'hangul-drill.v1';
const DIRS = { read: 'Read', write: 'Write', listen: 'Listen', mix: 'Mix' };
const DEFAULTS = { groups: ['v1'], choices: 4, gradual: true, sound: true, mode: 'read', play: false, layout: 'below', pace: 'normal' };
// How long a right answer stays on screen (ms). After a mistake it stays longer so the note can be read.
const PACES = { normal: { clean: 900, mistake: 2200 }, quick: { clean: 400, mistake: 1200 }, minimal: { clean: 120, mistake: 600 } };

// Device text-to-speech sounds poor for single Korean letters, so speech (Listen mode, spoken answers)
// is switched off until there are proper recordings. Flip this to bring it back.
const SPEECH = false;

let { settings, state } = load();
if (!SPEECH && settings.mode === 'listen') settings.mode = 'read';
const session = { questions: 0, right: 0, streak: 0 };
let q = null; // current question
let advanceTimer = 0;
let koVoice = null;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE));
    if (saved?.state) return { settings: { ...DEFAULTS, ...saved.settings }, state: { ...newState(), ...saved.state } };
  } catch { /* private mode or corrupt data: start fresh */ }
  return { settings: { ...DEFAULTS }, state: newState() };
}

function save() {
  try { localStorage.setItem(STORE, JSON.stringify({ settings, state })); } catch { /* storage unavailable */ }
}

// ---------- speech ----------

function findVoice() {
  if (!SPEECH) return;
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices().filter(v => v.lang.replace('_', '-').toLowerCase().startsWith('ko'));
  koVoice = voices.find(v => v.localService) || voices[0] || null;
  renderModes();
}

function speak(text) {
  if (!koVoice) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = koVoice;
  u.lang = koVoice.lang;
  u.rate = 0.8;
  speechSynthesis.speak(u);
}

// ---------- question flow ----------

function selectedGroups(kind) {
  return GROUPS.filter(g => g.kind === kind && settings.groups.includes(g.id));
}

function availableDirs() {
  return ['read', 'write', ...(koVoice ? ['listen'] : [])];
}

function nextQuestion() {
  clearTimeout(advanceTimer);
  if (!settings.groups.length) settings.groups = ['v1'];
  const jamoPool = selectedGroups('jamo').flatMap(g => g.items.map(i => i.id));
  const sylPool = selectedGroups('syl').flatMap(g => buildSyllables(g, settings.groups));
  const usePool = jamoPool.length && sylPool.length ? (Math.random() < 0.5 ? jamoPool : sylPool)
    : jamoPool.length ? jamoPool : sylPool;
  const isJamo = usePool === jamoPool;

  let dir = settings.mode === 'mix' ? availableDirs()[Math.floor(Math.random() * availableDirs().length)] : settings.mode;
  if (dir === 'listen' && !koVoice) dir = 'read';

  const pick = pickNext(usePool, dir, state, { gradual: isJamo && settings.gradual, play: settings.play });
  const item = itemFor(pick.id);
  // Only show the "new letter" card the first time a letter appears in any direction.
  const seenElsewhere = Object.keys(DIRS).some(d => recordOf(state, d, pick.id)?.seen);
  q = { item, dir, wrong: [], done: false, again: pick.again, intro: pick.isNew && isJamo && !seenElsewhere && !settings.play };
  q.options = q.intro ? [] : buildOptions(item, dir, isJamo ? jamoPool : null);
  render();
  if (dir === 'listen' && !q.intro) speak(item.speak);
}

function buildOptions(item, dir, jamoPool) {
  let candidates;
  if (item.kind === 'jamo') {
    // Vowels compete with vowels and consonants with consonants. Prefer letters already in play.
    const sameKind = i => i.vowel === item.vowel;
    candidates = jamoPool.map(id => JAMO[id]).filter(sameKind);
    if (candidates.length < settings.choices) {
      candidates = [...candidates, ...Object.values(JAMO).filter(i => sameKind(i) && !candidates.includes(i))];
    }
  } else {
    candidates = syllableVariants(item.id, settings.groups);
  }
  const distractors = pickDistractors(item, settings.choices, dir, candidates, state, { similar: similarItems });
  return shuffle([item, ...distractors]);
}

function choose(option, button) {
  if (!q || q.done || q.intro || q.wrong.includes(option.id)) return;
  if (option.id === q.item.id) {
    q.done = true;
    session.questions++;
    if (!q.wrong.length) { session.right++; session.streak++; } else session.streak = 0;
    recordAnswer(state, q.dir, q.item.id, q.wrong);
    save();
    button.classList.add('right');
    $('#choices').classList.add('done');
    if (settings.sound) speak(q.item.speak);
    renderPromptExtras(true);
    renderScore();
    maybeSuggestNextGroup();
    const pace = PACES[settings.pace] || PACES.normal;
    advanceTimer = setTimeout(nextQuestion, q.item.note && q.wrong.length ? pace.mistake : pace.clean);
  } else {
    q.wrong.push(option.id);
    button.classList.add('wrong');
    button.disabled = true;
    navigator.vibrate?.(60);
  }
}

// ---------- rendering ----------

function label(item, dir, side) {
  // side: 'prompt' or 'answer'
  const hangulSide = dir === 'read' ? side === 'prompt' : side === 'answer';
  return hangulSide ? item.hangul : item.roman;
}

function render() {
  const { item, dir } = q;
  const prompt = $('#prompt');
  prompt.className = 'prompt';
  const glyph = $('#glyph');
  if (q.intro) {
    glyph.textContent = item.hangul;
    glyph.className = 'glyph hangul';
  } else if (dir === 'listen') {
    glyph.textContent = '';
    glyph.className = 'glyph';
  } else {
    const text = label(item, dir, 'prompt');
    glyph.textContent = text;
    glyph.className = 'glyph ' + (dir === 'read' ? 'hangul' : 'latin');
  }
  $('#play').hidden = !(dir === 'listen' || q.intro) || !koVoice;
  $('#tag').textContent = q.intro ? 'New letter' : q.again ? 'Again' : '';
  renderPromptExtras(q.intro);

  const box = $('#choices');
  box.replaceChildren();
  box.className = `choices n${q.intro ? 1 : q.options.length}`;
  const ring = settings.layout === 'ring' && !q.intro;
  $('main').classList.toggle('ring', ring);
  if (q.intro) {
    const ok = document.createElement('button');
    ok.className = 'choice gotit';
    ok.textContent = 'Got it';
    ok.addEventListener('click', () => {
      q.intro = false;
      q.options = buildOptions(item, dir, selectedGroups('jamo').flatMap(g => g.items.map(i => i.id)));
      render();
      if (dir === 'listen') speak(item.speak);
    });
    box.append(ok);
    if (settings.sound) speak(item.speak);
    return;
  }
  q.options.forEach((opt, i) => {
    const b = document.createElement('button');
    const text = label(opt, dir, 'answer');
    b.className = 'choice ' + (dir === 'read' ? 'latin' : 'hangul');
    b.textContent = text;
    b.dataset.key = i + 1;
    if (ring) {
      // Evenly round the circle, starting at the top.
      const a = -Math.PI / 2 + (2 * Math.PI * i) / q.options.length;
      b.style.left = `${50 + 38 * Math.cos(a)}%`;
      b.style.top = `${50 + 38 * Math.sin(a)}%`;
      b.style.setProperty('--len', text.length);
    }
    b.addEventListener('click', e => {
      e.stopPropagation(); // the container's "tap to continue" must not see the answering tap
      if (q.done) nextQuestion(); else choose(opt, b);
    });
    box.append(b);
  });
}

function renderPromptExtras(reveal) {
  const { item, dir } = q;
  const answer = $('#answer');
  const note = $('#note');
  if (!reveal) { answer.textContent = ''; note.textContent = ''; return; }
  // After answering (or when introducing), show both sides plus the pronunciation note.
  answer.textContent = q.intro ? item.roman : dir === 'read' ? item.roman : dir === 'write' ? item.hangul : `${item.hangul} · ${item.roman}`;
  note.textContent = item.note;
}

function renderScore() {
  $('#score').textContent = session.questions ? `${session.right}/${session.questions}` : '0/0';
  $('#pct').textContent = session.questions ? `${Math.round((100 * session.right) / session.questions)}%` : '';
  $('#streak').textContent = session.streak >= 3 ? `${session.streak} in a row` : '';
}

function renderStyle() {
  for (const b of document.querySelectorAll('#style button')) {
    b.setAttribute('aria-pressed', String(b.dataset.play === 'true') === String(settings.play));
  }
}

function renderModes() {
  const nav = $('#modes');
  nav.replaceChildren();
  for (const [dir, name] of Object.entries(DIRS)) {
    if (dir === 'listen' && !SPEECH) continue;
    const b = document.createElement('button');
    b.textContent = name;
    b.setAttribute('aria-pressed', settings.mode === dir);
    if (dir === 'listen' && !koVoice) {
      b.disabled = true;
      b.title = 'No Korean voice on this device';
    }
    b.addEventListener('click', () => {
      settings.mode = dir;
      save();
      renderModes();
      nextQuestion();
    });
    nav.append(b);
  }
}

// ---------- group progression ----------

function groupMastery(group, dir) {
  const ids = group.items.map(i => i.id);
  const boxes = ids.map(id => recordOf(state, dir, id)?.box ?? -1);
  return {
    known: boxes.filter(b => b >= 4).length,
    learning: boxes.filter(b => b >= 0 && b < 4).length,
    fresh: boxes.filter(b => b < 0).length,
    ready: boxes.every(b => b >= 3),
  };
}

function maybeSuggestNextGroup() {
  const banner = $('#banner');
  if (!banner.hidden || q.item.kind !== 'jamo' || settings.play) return;
  const dir = q.dir;
  const selected = selectedGroups('jamo');
  if (!selected.length || !selected.every(g => groupMastery(g, dir).ready)) return;
  const next = GROUPS.find(g => !settings.groups.includes(g.id));
  if (!next) return;
  banner.querySelector('span').textContent = `You know these well. Add ${next.name.toLowerCase()}?`;
  banner.hidden = false;
  banner.querySelector('button.yes').onclick = () => {
    settings.groups.push(next.id);
    save();
    banner.hidden = true;
    nextQuestion();
  };
}

// ---------- settings & progress dialogs ----------

function renderSettings() {
  const list = $('#groups');
  list.replaceChildren();
  for (const g of GROUPS) {
    const row = document.createElement('label');
    row.className = 'group';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = settings.groups.includes(g.id);
    cb.addEventListener('change', () => {
      settings.groups = GROUPS.map(x => x.id).filter(id => id === g.id ? cb.checked : settings.groups.includes(id));
      save();
    });
    const name = document.createElement('span');
    name.className = 'gname';
    name.textContent = g.name;
    const sample = document.createElement('span');
    sample.className = 'gsample hangul';
    sample.textContent = g.items ? g.items.map(i => i.hangul).join(' ') : g.final ? '각 난 말 밥' : '가 너 도 루';
    row.append(cb, name, sample);
    list.append(row);
  }
  for (const input of document.querySelectorAll('input[name=choices]')) {
    input.checked = Number(input.value) === settings.choices;
  }
  $('#gradual').checked = settings.gradual;
  $('#sound').checked = settings.sound;
  for (const input of document.querySelectorAll('input[name=layout]')) input.checked = input.value === settings.layout;
  for (const input of document.querySelectorAll('input[name=pace]')) input.checked = input.value === settings.pace;
}

function renderStats(dir) {
  for (const t of document.querySelectorAll('#statdirs button')) t.setAttribute('aria-pressed', t.dataset.dir === dir);
  const body = $('#statbody');
  body.replaceChildren();
  let reviews = 0, right = 0;
  for (const r of Object.entries(state.items)) {
    if (r[0].startsWith(dir + '|')) { reviews += r[1].seen; right += r[1].right; }
  }
  const summary = document.createElement('p');
  summary.className = 'muted';
  summary.textContent = reviews ? `${reviews} answers · ${Math.round((100 * right) / reviews)}% right first time` : 'Nothing practised in this direction yet.';
  body.append(summary);
  for (const g of GROUPS.filter(g => g.kind === 'jamo')) {
    const m = groupMastery(g, dir);
    const h = document.createElement('h3');
    h.textContent = g.name;
    const small = document.createElement('small');
    small.textContent = ` ${m.known} known · ${m.learning} learning`;
    h.append(small);
    const grid = document.createElement('div');
    grid.className = 'cells';
    for (const item of g.items) {
      const r = recordOf(state, dir, item.id);
      const cell = document.createElement('div');
      cell.className = 'cell hangul';
      cell.dataset.box = r ? r.box : 'new';
      cell.title = r ? `${item.roman}: ${r.right}/${r.seen} right first time, level ${r.box}/${MAX_BOX}` : `${item.roman}: not seen yet`;
      cell.textContent = item.hangul;
      grid.append(cell);
    }
    body.append(h, grid);
  }
}

// ---------- wiring ----------

$('#settingsBtn').addEventListener('click', () => { renderSettings(); $('#settings').showModal(); });
$('#settings').addEventListener('close', () => nextQuestion());
for (const input of document.querySelectorAll('input[name=choices]')) {
  input.addEventListener('change', () => { settings.choices = Number(input.value); save(); });
}
for (const input of document.querySelectorAll('input[name=pace]')) {
  input.addEventListener('change', () => { settings.pace = input.value; save(); });
}
for (const input of document.querySelectorAll('input[name=layout]')) {
  input.addEventListener('change', () => { settings.layout = input.value; save(); });
}
$('#gradual').addEventListener('change', e => { settings.gradual = e.target.checked; save(); });
$('#sound').addEventListener('change', e => { settings.sound = e.target.checked; save(); });
$('#reset').addEventListener('click', () => {
  if (!confirm('Forget all progress on this device?')) return;
  state = newState();
  Object.assign(session, { questions: 0, right: 0, streak: 0 });
  save();
  renderScore();
  $('#settings').close();
});

$('#statsBtn').addEventListener('click', () => {
  renderStats(settings.mode === 'mix' ? 'read' : settings.mode);
  $('#stats').showModal();
});
for (const t of document.querySelectorAll('#statdirs button')) t.addEventListener('click', () => renderStats(t.dataset.dir));
for (const d of document.querySelectorAll('dialog')) {
  d.addEventListener('click', e => { if (e.target === d) d.close(); }); // tap the backdrop to close
}
$('#banner button.no').addEventListener('click', () => { $('#banner').hidden = true; });

$('#play').addEventListener('click', () => speak(q.item.speak));
$('main').addEventListener('click', e => {
  if (q?.done && !e.target.closest('.choice:not(.right), #play')) nextQuestion(); // tap again to skip the pause
});
document.addEventListener('keydown', e => {
  if (document.querySelector('dialog[open]') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (q?.done && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); nextQuestion(); return; }
  if (q?.intro && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); $('#choices .gotit').click(); return; }
  if (e.key === ' ' || e.key === 'r') { e.preventDefault(); if (q) speak(q.item.speak); return; }
  const b = document.querySelector(`#choices .choice[data-key="${e.key}"]`);
  if (b) b.click();
});

if ('speechSynthesis' in window) {
  findVoice();
  speechSynthesis.addEventListener?.('voiceschanged', findVoice);
}
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js');
}

for (const b of document.querySelectorAll('#style button')) {
  b.addEventListener('click', () => {
    settings.play = b.dataset.play === 'true';
    $('#banner').hidden = true;
    save();
    renderStyle();
    nextQuestion();
  });
}

if (!SPEECH) {
  for (const el of document.querySelectorAll('.speech')) el.hidden = true;
  $('.modes').style.gridTemplateColumns = 'repeat(3, 1fr)';
}
renderStyle();
renderModes();
renderScore();
nextQuestion();
