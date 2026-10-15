import { compose, decompose, romanize, speakable, isVowel } from './hangul.js';

// Letter groups in teaching order. Each jamo item: [letter, answer label, note shown after answering].
const JAMO_GROUPS = [
  { id: 'v1', name: 'Basic vowels', items: [
    ['ㅏ', 'a', 'Like "a" in father'],
    ['ㅓ', 'eo', 'Like "u" in fun (open o)'],
    ['ㅗ', 'o', 'Like "o" in go, without the w'],
    ['ㅜ', 'u', 'Like "oo" in moon'],
    ['ㅡ', 'eu', 'Like "oo" with lips spread flat'],
    ['ㅣ', 'i', 'Like "ee" in see'],
  ] },
  { id: 'v2', name: 'Y-vowels', items: [
    ['ㅑ', 'ya', 'A second stroke adds a "y": ㅏ → ㅑ'],
    ['ㅕ', 'yeo', 'A second stroke adds a "y": ㅓ → ㅕ'],
    ['ㅛ', 'yo', 'A second stroke adds a "y": ㅗ → ㅛ'],
    ['ㅠ', 'yu', 'A second stroke adds a "y": ㅜ → ㅠ'],
  ] },
  { id: 'c1', name: 'Basic consonants', items: [
    ['ㄱ', 'g/k', 'g at the start of a syllable, k at the end'],
    ['ㄴ', 'n', ''],
    ['ㄷ', 'd/t', 'd at the start of a syllable, t at the end'],
    ['ㄹ', 'r/l', 'r at the start of a syllable, l at the end'],
    ['ㅁ', 'm', ''],
    ['ㅂ', 'b/p', 'b at the start of a syllable, p at the end'],
    ['ㅅ', 's', 's; sounds like sh before ㅣ (시 = "shi")'],
    ['ㅇ', 'ng', 'Silent at the start of a syllable (아 = "a"), ng at the end'],
    ['ㅈ', 'j', ''],
    ['ㅎ', 'h', ''],
  ] },
  { id: 'c2', name: 'Aspirated consonants', items: [
    ['ㅊ', 'ch', 'ㅈ plus a puff of air'],
    ['ㅋ', 'k', 'ㄱ plus a puff of air'],
    ['ㅌ', 't', 'ㄷ plus a puff of air'],
    ['ㅍ', 'p', 'ㅂ plus a puff of air'],
  ] },
  { id: 'c3', name: 'Tense consonants', items: [
    ['ㄲ', 'kk', 'Doubled ㄱ: tight, no puff of air'],
    ['ㄸ', 'tt', 'Doubled ㄷ: tight, no puff of air'],
    ['ㅃ', 'pp', 'Doubled ㅂ: tight, no puff of air'],
    ['ㅆ', 'ss', 'Doubled ㅅ: a sharp, hissed s'],
    ['ㅉ', 'jj', 'Doubled ㅈ: tight, no puff of air'],
  ] },
  { id: 'v3', name: 'Compound vowels', items: [
    ['ㅐ', 'ae', 'Like "e" in bed. Today ㅐ and ㅔ sound almost the same'],
    ['ㅔ', 'e', 'Like "e" in bed. Today ㅐ and ㅔ sound almost the same'],
    ['ㅒ', 'yae', 'ㅐ with a "y"'],
    ['ㅖ', 'ye', 'ㅔ with a "y"'],
    ['ㅘ', 'wa', 'ㅗ + ㅏ'],
    ['ㅙ', 'wae', 'ㅗ + ㅐ'],
    ['ㅚ', 'oe', 'ㅗ + ㅣ, but pronounced "we"'],
    ['ㅝ', 'wo', 'ㅜ + ㅓ'],
    ['ㅞ', 'we', 'ㅜ + ㅔ'],
    ['ㅟ', 'wi', 'ㅜ + ㅣ'],
    ['ㅢ', 'ui', 'ㅡ + ㅣ; often just "i" in speech'],
  ] },
];

const SYLLABLE_GROUPS = [
  { id: 's1', name: 'Syllables', final: false },
  { id: 's2', name: 'Syllables with a final consonant', final: true },
];

export const FINALS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ'];

// Shapes and sounds that learners mix up. Distractors are drawn from these first.
export const SIMILAR = [
  'ㅏㅓㅑㅕ', 'ㅗㅜㅛㅠㅡ', 'ㅐㅔㅒㅖ', 'ㅏㅐ', 'ㅓㅔ', 'ㅘㅙㅚㅝㅞㅟㅢ', 'ㅡㅢ', 'ㅣㅢㅟ',
  'ㄱㅋㄲ', 'ㄷㅌㄸ', 'ㅂㅍㅃ', 'ㅅㅆ', 'ㅈㅊㅉ', 'ㅅㅈㅊ', 'ㅇㅎ', 'ㄴㄷㄹ', 'ㅁㅂ', 'ㄱㄴ',
].map(s => [...s]);

export function similar(a, b) {
  return SIMILAR.some(s => s.includes(a) && s.includes(b));
}

function jamoItem(group, [letter, label, note]) {
  return { id: letter, kind: 'jamo', group: group.id, hangul: letter, roman: label, note,
    vowel: isVowel(letter), speak: speakable(letter) };
}

export const GROUPS = [
  ...JAMO_GROUPS.map(g => ({ id: g.id, name: g.name, kind: 'jamo', items: g.items.map(i => jamoItem(g, i)) })),
  ...SYLLABLE_GROUPS.map(g => ({ ...g, kind: 'syl' })),
];

export const JAMO = Object.fromEntries(GROUPS.flatMap(g => g.items || []).map(i => [i.id, i]));

export function syllableItem(block) {
  const [l, v, t] = decompose(block);
  return { id: block, kind: 'syl', group: t ? 's2' : 's1', hangul: block, roman: romanize(block),
    note: [l, v, t].filter(Boolean).join(' + '), parts: [l, v, t], speak: block };
}

export const itemFor = id => JAMO[id] || syllableItem(id);

// Letters the syllable drills are built from: the selected jamo groups, or the basics if none are selected.
export function syllableLetters(selected) {
  const chosen = GROUPS.filter(g => g.kind === 'jamo' && selected.includes(g.id)).flatMap(g => g.items);
  const pick = (vowel, fallback) => {
    const own = chosen.filter(i => i.vowel === vowel).map(i => i.id);
    return own.length ? own : JAMO_GROUPS.find(g => g.id === fallback).items.map(i => i[0]);
  };
  return { initials: pick(false, 'c1'), vowels: pick(true, 'v1') };
}

// Distractor candidates for a syllable: the same block with one letter swapped.
export function syllableVariants(block, selected) {
  const { initials, vowels } = syllableLetters(selected);
  const [l, v, t] = decompose(block);
  const out = new Set();
  for (const x of initials) out.add(compose(x, v, t));
  for (const x of vowels) out.add(compose(l, x, t));
  if (t) for (const x of FINALS) out.add(compose(l, v, x));
  out.delete(block);
  return [...out].map(syllableItem);
}

// Two syllables are "similar" when the letter that differs is one learners confuse.
export function similarItems(a, b) {
  if (a.kind === 'jamo') return similar(a.id, b.id);
  return a.parts.some((p, i) => p !== b.parts[i] && similar(p, b.parts[i]));
}

export function buildSyllables(group, selected) {
  const { initials, vowels } = syllableLetters(selected);
  const out = [];
  for (const l of initials) for (const v of vowels) {
    if (group.final) for (const t of FINALS) out.push(compose(l, v, t));
    else out.push(compose(l, v));
  }
  return out;
}
