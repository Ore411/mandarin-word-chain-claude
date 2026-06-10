'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSavedWords, deleteWord, getDueWords, type SavedWord } from '@/lib/vocabulary';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function VocabularyPage() {
  const [words, setWords] = useState<SavedWord[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setWords(getSavedWords());
    setDueCount(getDueWords().length);
    setLoaded(true);
  }, []);

  const handleDelete = (hanzi: string) => {
    deleteWord(hanzi);
    setWords(getSavedWords());
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-900">
      <header className="flex-none flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <Link href="/" className="text-slate-400 hover:text-white text-sm transition-colors w-32">
          ← Menu
        </Link>
        <span className="text-white font-semibold tracking-wide">My Vocabulary</span>
        <div className="w-32 flex justify-end">
          {words.length > 0 && (
            <span className="text-slate-500 text-xs">{words.length} word{words.length === 1 ? '' : 's'}</span>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-lg mx-auto flex flex-col gap-3">
          {loaded && words.length > 0 && (
            <Link
              href="/vocabulary/study"
              className="flex items-center justify-center gap-2 py-3 mb-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
            >
              <span>📚 Study Flashcards</span>
              {dueCount > 0 && (
                <span className="bg-emerald-800 text-emerald-100 text-xs font-mono px-2 py-0.5 rounded-full">
                  {dueCount} due
                </span>
              )}
            </Link>
          )}

          {loaded && words.length === 0 && (
            <div className="text-center text-slate-500 mt-16 flex flex-col gap-3">
              <p className="text-lg">No saved words yet.</p>
              <p className="text-sm">
                Play <Link href="/game?mode=solo" className="text-emerald-400 hover:text-emerald-300">Practice</Link> and
                save words from the review screen.
              </p>
            </div>
          )}

          {words.map(w => (
            <div
              key={w.hanzi}
              className="flex items-start gap-4 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700"
            >
              {/* Hanzi + pinyin */}
              <div className="flex flex-col items-start shrink-0 min-w-[4.5rem]">
                <span className="text-white text-2xl font-bold tracking-wide leading-tight">{w.hanzi}</span>
                <span className="text-slate-400 text-xs font-mono mt-0.5">{w.pinyin}</span>
              </div>

              {/* Meaning + saved date */}
              <div className="flex-1 flex flex-col justify-center">
                <span className="text-slate-200 text-sm leading-snug">{w.meaning}</span>
                <span className="text-slate-600 text-xs mt-1">Saved {formatDate(w.savedAt)}</span>
              </div>

              {/* Delete */}
              <button
                onClick={() => handleDelete(w.hanzi)}
                aria-label={`Delete ${w.hanzi}`}
                className="shrink-0 text-slate-500 hover:text-red-400 transition-colors px-2 py-1 text-sm"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
