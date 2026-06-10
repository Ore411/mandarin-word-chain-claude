// Lightweight SM-2-style spaced-repetition scheduler.
// Pure functions only — no storage, no side effects. Day-level granularity.

export type Grade = 'again' | 'good' | 'easy';

export interface Srs {
  due: string;            // ISO — when the card is next due
  intervalDays: number;   // current interval in days
  ease: number;           // ease factor, starts 2.5
  reps: number;           // successful reviews in a row
  lapses: number;         // times graded "again"
  lastReviewed: string | null;
}

const MIN_EASE = 1.3;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A fresh card, due immediately so it can be studied right away. */
export function defaultSrs(now: Date = new Date()): Srs {
  return {
    due: now.toISOString(),
    intervalDays: 0,
    ease: 2.5,
    reps: 0,
    lapses: 0,
    lastReviewed: null,
  };
}

function addDays(now: Date, days: number): string {
  return new Date(now.getTime() + days * DAY_MS).toISOString();
}

/** Compute the next SRS state after grading. Pure. */
export function schedule(prev: Srs, grade: Grade, now: Date = new Date()): Srs {
  const nowIso = now.toISOString();

  if (grade === 'again') {
    // Reset progress; card stays due now (re-queued within the session).
    return {
      due: nowIso,
      intervalDays: 0,
      ease: Math.max(MIN_EASE, prev.ease - 0.2),
      reps: 0,
      lapses: prev.lapses + 1,
      lastReviewed: nowIso,
    };
  }

  if (grade === 'easy') {
    const interval =
      prev.reps === 0 ? 3 : Math.max(1, Math.round(prev.intervalDays * prev.ease * 1.3));
    return {
      due: addDays(now, interval),
      intervalDays: interval,
      ease: prev.ease + 0.15,
      reps: prev.reps + 1,
      lapses: prev.lapses,
      lastReviewed: nowIso,
    };
  }

  // grade === 'good'
  const interval =
    prev.reps === 0 ? 1 : prev.reps === 1 ? 3 : Math.max(1, Math.round(prev.intervalDays * prev.ease));
  return {
    due: addDays(now, interval),
    intervalDays: interval,
    ease: prev.ease,
    reps: prev.reps + 1,
    lapses: prev.lapses,
    lastReviewed: nowIso,
  };
}

/** Whether a card is due for review at the given time. */
export function isDue(srs: Srs, now: Date = new Date()): boolean {
  return new Date(srs.due).getTime() <= now.getTime();
}

/** Human-friendly label for the next interval a grade would produce. */
export function previewInterval(prev: Srs, grade: Grade): string {
  if (grade === 'again') return '<10 min';
  const next = schedule(prev, grade);
  const d = next.intervalDays;
  if (d < 1) return '<1 day';
  if (d === 1) return '1 day';
  if (d < 30) return `${d} days`;
  const months = Math.round(d / 30);
  return months <= 1 ? '1 month' : `${months} months`;
}
