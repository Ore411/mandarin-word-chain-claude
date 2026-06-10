'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getDueWords,
  getSavedWords,
  ensureSrs,
  gradeWord,
  type SavedWord,
} from '@/lib/vocabulary';
import { previewInterval, type Grade } from '@/lib/srs';

type SessionState = 'loading' | 'empty' | 'caught-up' | 'studying' | 'done';

const GRADES: { grade: Grade; label: string; classes: string }[] = [
  { grade: 'again', label: 'Again', classes: 'bg-red-600 hover:bg-red-500' },
  { grade: 'good', label: 'Good', classes: 'bg-emerald-600 hover:bg-emerald-500' },
  { grade: 'easy', label: 'Easy', classes: 'bg-sky-600 hover:bg-sky-500' },
];

export default function StudyPage() {
  const [state, setState] = useState<SessionState>('loading');
  const [queue, setQueue] = useState<SavedWord[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  // Build the initial session from due cards.
  useEffect(() => {
    const total = getSavedWords().length;
    const due = getDueWords();
    if (total === 0) {
      setState('empty');
    } else if (due.length === 0) {
      setState('caught-up');
    } else {
      setQueue(due);
      setState('studying');
    }
  }, []);

  function startStudyAll() {
    const all = getSavedWords();
    if (all.length === 0) {
      setState('empty');
      return;
    }
    setQueue(all);
    setReviewedCount(0);
    setRevealed(false);
    setState('studying');
  }

  function handleGrade(grade: Grade) {
    const current = queue[0];
    if (!current) return;
    const updated = gradeWord(current.hanzi, grade) ?? current;
    setRevealed(false);

    if (grade === 'again') {
      // Re-queue at the end — must be recalled correctly before the session ends.
      setQueue(q => [...q.slice(1), updated]);
    } else {
      setReviewedCount(c => c + 1);
      setQueue(q => {
        const next = q.slice(1);
        if (next.length === 0) setState('done');
        return next;
      });
    }
  }

  const current = queue[0];

  return (
    <div className="flex flex-col min-h-screen bg-slate-900">
      <header className="flex-none flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <Link href="/vocabulary" className="text-slate-400 hover:text-white text-sm transition-colors w-32">
          ← Vocabulary
        </Link>
        <span className="text-white font-semibold tracking-wide">Study Flashcards</span>
        <div className="w-32 flex justify-end">
          {state === 'studying' && (
            <span className="text-slate-500 text-xs">{reviewedCount} done · {queue.length} left</span>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        {state === 'loading' && <p className="text-slate-500">Loading…</p>}

        {state === 'empty' && (
          <div className="text-center text-slate-400 flex flex-col gap-3">
            <p className="text-lg">No saved words yet.</p>
            <Link href="/game?mode=solo" className="text-emerald-400 hover:text-emerald-300">
              Play Practice to save some words →
            </Link>
          </div>
        )}

        {state === 'caught-up' && (
          <div className="text-center text-slate-300 flex flex-col items-center gap-4">
            <div className="text-5xl">✅</div>
            <p className="text-xl font-semibold">All caught up!</p>
            <p className="text-slate-500 text-sm">No cards are due right now.</p>
            <button
              onClick={startStudyAll}
              className="mt-2 px-5 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
            >
              Study all words anyway
            </button>
          </div>
        )}

        {state === 'done' && (
          <div className="text-center text-slate-300 flex flex-col items-center gap-4">
            <div className="text-5xl">🎉</div>
            <p className="text-xl font-semibold">Session complete!</p>
            <p className="text-slate-500 text-sm">Reviewed {reviewedCount} card{reviewedCount === 1 ? '' : 's'}.</p>
            <Link
              href="/vocabulary"
              className="mt-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
            >
              Back to My Vocabulary
            </Link>
          </div>
        )}

        {state === 'studying' && current && (
          <div className="w-full max-w-md flex flex-col items-center gap-6">
            {/* Card */}
            <div className="w-full min-h-[16rem] bg-slate-800 border border-slate-700 rounded-2xl flex flex-col items-center justify-center px-6 py-10 gap-4">
              <span className="text-6xl font-bold text-white tracking-wider">{current.hanzi}</span>

              {revealed && (
                <div className="flex flex-col items-center gap-2 animate-fb-pop">
                  <span className="text-emerald-400 text-lg font-mono">{current.pinyin}</span>
                  <span className="text-slate-300 text-base text-center">{current.meaning}</span>
                </div>
              )}
            </div>

            {/* Controls */}
            {!revealed ? (
              <button
                onClick={() => setRevealed(true)}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
              >
                Show answer
              </button>
            ) : (
              <div className="w-full grid grid-cols-3 gap-2">
                {GRADES.map(({ grade, label, classes }) => (
                  <button
                    key={grade}
                    onClick={() => handleGrade(grade)}
                    className={`flex flex-col items-center py-3 rounded-xl text-white font-semibold transition-colors ${classes}`}
                  >
                    <span>{label}</span>
                    <span className="text-[10px] font-normal opacity-80 mt-0.5">
                      {previewInterval(ensureSrs(current), grade)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
