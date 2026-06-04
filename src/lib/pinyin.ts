// ── Tone mark conversion ──────────────────────────────────────────────────────
// Converts numbered pinyin "gong1 zuo4" → tone-marked "gōng zuò"

const TONE_MARKS: Record<string, string[]> = {
  a: ['ā','á','ǎ','à','a'],
  e: ['ē','é','ě','è','e'],
  i: ['ī','í','ǐ','ì','i'],
  o: ['ō','ó','ǒ','ò','o'],
  u: ['ū','ú','ǔ','ù','u'],
  ü: ['ǖ','ǘ','ǚ','ǜ','ü'],
};

// Tone placement rules: a/e always take the mark; ou → o; otherwise last vowel
function applyTone(syllable: string, tone: number): string {
  if (tone === 5 || tone === 0) return syllable; // neutral tone — no mark
  const t = tone - 1;
  // ü written as v or u: after j/q/x/y, u is actually ü
  const s = syllable.replace(/v/g, 'ü');
  if (/a|e/.test(s)) return s.replace(/[ae]/, m => TONE_MARKS[m][t]);
  if (s.includes('ou')) return s.replace('o', TONE_MARKS['o'][t]);
  // find last vowel
  const vowels = ['ü','a','e','i','o','u'];
  for (let i = s.length - 1; i >= 0; i--) {
    const c = s[i];
    if (vowels.includes(c)) return s.slice(0, i) + TONE_MARKS[c][t] + s.slice(i + 1);
  }
  return s;
}

function convertSyllable(syl: string): string {
  const match = syl.match(/^([a-züA-ZÜ]+)([1-5])$/);
  if (!match) return syl;
  return applyTone(match[1], parseInt(match[2]));
}

/** Convert numbered pinyin string to tone-marked. e.g. "gong1 zuo4" → "gōng zuò" */
export function toToneMarks(pinyin: string): string {
  return pinyin.split(' ').map(convertSyllable).join(' ');
}

export interface Syllable {
  initial: string;
  final: string;
  tone: number | null;
}

export type InitialFamily = 'retroflex' | 'sibilant' | 'palatal' | 'velar' | 'dental' | 'lip' | 'none';

const INITIAL_FAMILIES: Record<string, InitialFamily> = {
  zh: 'retroflex', ch: 'retroflex', sh: 'retroflex', r: 'retroflex',
  z: 'sibilant', c: 'sibilant', s: 'sibilant',
  j: 'palatal', q: 'palatal', x: 'palatal', y: 'palatal',
  g: 'velar', k: 'velar', h: 'velar', w: 'velar',
  d: 'dental', t: 'dental', n: 'dental', l: 'dental',
  b: 'lip', p: 'lip', m: 'lip', f: 'lip',
  '': 'none',
};

export type FinalRelation = 'exact' | 'strongSimilar' | 'weakMusical' | 'invalid';

const STRONG_SIMILAR_FINALS: [string, string][] = [
  ['an', 'ang'], ['en', 'eng'], ['in', 'ing'], ['ian', 'iang'], ['uan', 'uang'],
];

const STRONG_SIMILAR_SET = new Set<string>(
  STRONG_SIMILAR_FINALS.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`])
);

const WEAK_MUSICAL_SET = new Set<string>(['ui|ei', 'ei|ui']);

export function getInitialFamily(initial: string): InitialFamily {
  return INITIAL_FAMILIES[initial] ?? 'none';
}

export function initialsCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  const fa = getInitialFamily(a);
  const fb = getInitialFamily(b);
  return fa !== 'none' && fb !== 'none' && fa === fb;
}

export function finalsRelation(a: string, b: string): FinalRelation {
  if (a === b) return 'exact';
  const key = `${a}|${b}`;
  if (STRONG_SIMILAR_SET.has(key)) return 'strongSimilar';
  if (WEAK_MUSICAL_SET.has(key)) return 'weakMusical';
  return 'invalid';
}

const FAMILY_DISPLAY: Record<InitialFamily, { name: string; members: string[] }> = {
  retroflex: { name: 'Retroflex', members: ['zh', 'ch', 'sh', 'r'] },
  sibilant:  { name: 'Sibilant',  members: ['z', 'c', 's'] },
  palatal:   { name: 'Palatal',   members: ['j', 'q', 'x', 'y'] },
  velar:     { name: 'Velar',     members: ['g', 'k', 'h', 'w'] },
  dental:    { name: 'Dental',    members: ['d', 't', 'n', 'l'] },
  lip:       { name: 'Lip',       members: ['b', 'p', 'm', 'f'] },
  none:      { name: 'None',      members: [] },
};

export function getInitialFamilyDisplay(initial: string): { family: string; members: string[] } {
  const f = getInitialFamily(initial);
  const { name, members } = FAMILY_DISPLAY[f];
  return { family: name, members };
}

export interface CompatibleFinal {
  final: string;
  type: 'exact' | 'strong' | 'weak';
}

export function getCompatibleFinals(final: string): CompatibleFinal[] {
  const result: CompatibleFinal[] = [{ final, type: 'exact' }];
  for (const [a, b] of STRONG_SIMILAR_FINALS) {
    if (final === a) result.push({ final: b, type: 'strong' });
    else if (final === b) result.push({ final: a, type: 'strong' });
  }
  if (final === 'ui') result.push({ final: 'ei', type: 'weak' });
  else if (final === 'ei') result.push({ final: 'ui', type: 'weak' });
  return result;
}
