// Local "My Vocabulary" store. Persists saved words in localStorage only —
// no backend, no accounts. All access is SSR-safe and wrapped so a corrupt
// or unavailable store never throws.

import { defaultSrs, schedule, isDue, type Srs, type Grade } from '@/lib/srs';

export interface SavedWord {
  hanzi: string;
  pinyin: string;
  meaning: string;
  savedAt: string; // ISO timestamp
  srs?: Srs;       // spaced-repetition state (optional for backward compatibility)
}

const STORAGE_KEY = 'myVocabulary';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/** Return all saved words, newest first. Never throws. */
export function getSavedWords(): SavedWord[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (w): w is SavedWord =>
        w && typeof w.hanzi === 'string' && typeof w.pinyin === 'string' &&
        typeof w.meaning === 'string' && typeof w.savedAt === 'string',
    );
  } catch {
    return [];
  }
}

function writeAll(words: SavedWord[]): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
  } catch {
    // Quota or serialization error — ignore; vocabulary is non-critical.
  }
}

/**
 * Save new words, skipping any whose hanzi is already stored.
 * Returns the number of words actually added.
 */
export function saveWords(words: { hanzi: string; pinyin: string; meaning: string }[]): number {
  if (words.length === 0) return 0;
  const existing = getSavedWords();
  const have = new Set(existing.map(w => w.hanzi));
  const now = new Date();
  const nowIso = now.toISOString();
  const additions: SavedWord[] = [];
  for (const w of words) {
    if (have.has(w.hanzi)) continue;
    have.add(w.hanzi);
    // New cards start due immediately so they can be studied right away.
    additions.push({ hanzi: w.hanzi, pinyin: w.pinyin, meaning: w.meaning, savedAt: nowIso, srs: defaultSrs(now) });
  }
  if (additions.length === 0) return 0;
  // Newest first.
  writeAll([...additions, ...existing]);
  return additions.length;
}

/** Return a word's SRS state, lazily defaulting legacy words to "due now". */
export function ensureSrs(word: SavedWord): Srs {
  return word.srs ?? defaultSrs(new Date(0)); // epoch → already due
}

/** Words due for review now (legacy words with no SRS count as due). */
export function getDueWords(now: Date = new Date()): SavedWord[] {
  return getSavedWords().filter(w => isDue(ensureSrs(w), now));
}

/** Grade a word, reschedule it, and persist. Returns the updated word (or null). */
export function gradeWord(hanzi: string, grade: Grade, now: Date = new Date()): SavedWord | null {
  const all = getSavedWords();
  const idx = all.findIndex(w => w.hanzi === hanzi);
  if (idx === -1) return null;
  const updated: SavedWord = { ...all[idx], srs: schedule(ensureSrs(all[idx]), grade, now) };
  all[idx] = updated;
  writeAll(all);
  return updated;
}

/** Delete a saved word by its hanzi. */
export function deleteWord(hanzi: string): void {
  const remaining = getSavedWords().filter(w => w.hanzi !== hanzi);
  writeAll(remaining);
}

/** True if a word with this hanzi is already saved. */
export function isSaved(hanzi: string): boolean {
  return getSavedWords().some(w => w.hanzi === hanzi);
}
