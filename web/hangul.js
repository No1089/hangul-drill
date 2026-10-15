// Syllable-block composition and Revised Romanization for single blocks.
// Uses compatibility jamo (U+3131..) everywhere so letters render on their own.

const L = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const V = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const T = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ',
  'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

const R_INITIAL = { 'ㄱ': 'g', 'ㄲ': 'kk', 'ㄴ': 'n', 'ㄷ': 'd', 'ㄸ': 'tt', 'ㄹ': 'r', 'ㅁ': 'm', 'ㅂ': 'b', 'ㅃ': 'pp',
  'ㅅ': 's', 'ㅆ': 'ss', 'ㅇ': '', 'ㅈ': 'j', 'ㅉ': 'jj', 'ㅊ': 'ch', 'ㅋ': 'k', 'ㅌ': 't', 'ㅍ': 'p', 'ㅎ': 'h' };
const R_VOWEL = { 'ㅏ': 'a', 'ㅐ': 'ae', 'ㅑ': 'ya', 'ㅒ': 'yae', 'ㅓ': 'eo', 'ㅔ': 'e', 'ㅕ': 'yeo', 'ㅖ': 'ye', 'ㅗ': 'o',
  'ㅘ': 'wa', 'ㅙ': 'wae', 'ㅚ': 'oe', 'ㅛ': 'yo', 'ㅜ': 'u', 'ㅝ': 'wo', 'ㅞ': 'we', 'ㅟ': 'wi', 'ㅠ': 'yu', 'ㅡ': 'eu',
  'ㅢ': 'ui', 'ㅣ': 'i' };
// A final consonant is pronounced as one of seven sounds when the block stands alone.
const R_FINAL = { '': '', 'ㄱ': 'k', 'ㄲ': 'k', 'ㄴ': 'n', 'ㄷ': 't', 'ㄹ': 'l', 'ㅁ': 'm', 'ㅂ': 'p', 'ㅅ': 't', 'ㅆ': 't',
  'ㅇ': 'ng', 'ㅈ': 't', 'ㅊ': 't', 'ㅋ': 'k', 'ㅌ': 't', 'ㅍ': 'p', 'ㅎ': 't' };

export const isVowel = j => V.includes(j);

export function compose(initial, vowel, final = '') {
  const l = L.indexOf(initial), v = V.indexOf(vowel), t = T.indexOf(final);
  if (l < 0 || v < 0 || t < 0) throw new Error(`cannot compose ${initial}${vowel}${final}`);
  return String.fromCharCode(0xac00 + (l * 21 + v) * 28 + t);
}

export function decompose(block) {
  const c = block.charCodeAt(0) - 0xac00;
  return [L[Math.floor(c / 588)], V[Math.floor((c % 588) / 28)], T[c % 28]];
}

export function romanize(block) {
  const [l, v, t] = decompose(block);
  return R_INITIAL[l] + R_VOWEL[v] + R_FINAL[t];
}

// What to feed speech synthesis for a lone letter: vowels get the silent ㅇ, consonants get ㅏ.
export const speakable = j => (isVowel(j) ? compose('ㅇ', j) : compose(j, 'ㅏ'));
