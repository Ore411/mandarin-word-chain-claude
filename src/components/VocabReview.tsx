'use client';

import { toToneMarks } from '@/lib/pinyin';

interface WordEntry {
  simplified: string;
  pinyin: string;
  english: string;
  wordLength: number;
  isChengyu: boolean;
  hskLevel: number | null;
}

interface ChainEntry {
  word: WordEntry;
  playedBy: string | number;
  score: number;
  connectionType: string;
  speedMultiplier?: number;
}

const CONNECTION_LABELS: Record<string, string> = {
  exactChar: 'Exact character',
  exactInitialExactFinal: 'Same sound',
  familyInitialExactFinal: 'Same final, related initial',
  exactInitialStrongFinal: 'Same initial, similar final',
  familyInitialStrongFinal: 'Related sound',
  weakMusicalFinal: 'Musical rhyme',
};

const CONNECTION_COLORS: Record<string, string> = {
  exactChar: 'text-emerald-400',
  exactInitialExactFinal: 'text-sky-400',
  familyInitialExactFinal: 'text-sky-300',
  exactInitialStrongFinal: 'text-violet-400',
  familyInitialStrongFinal: 'text-violet-300',
  weakMusicalFinal: 'text-amber-400',
};

const HSK_COLORS: Record<number, string> = {
  1: 'bg-emerald-800 text-emerald-200',
  2: 'bg-sky-800 text-sky-200',
  3: 'bg-violet-800 text-violet-200',
  4: 'bg-amber-800 text-amber-200',
  5: 'bg-orange-800 text-orange-200',
  6: 'bg-red-900 text-red-200',
};

function wordLengthBonus(n: number): number {
  if (n === 3) return 2;
  if (n === 4) return 4;
  if (n >= 5) return 6;
  return 0;
}

function shortMeaning(english: string, n = 2) {
  return english.split(';').slice(0, n).join(';').trim();
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center bg-slate-800 rounded-xl px-4 py-3 min-w-[5rem]">
      <span className="text-white font-bold text-xl leading-none">{value}</span>
      <span className="text-slate-500 text-xs mt-1 text-center">{label}</span>
    </div>
  );
}

interface Props {
  chain: ChainEntry[];
}

export default function VocabReview({ chain }: Props) {
  // Filter out the starting word (score 0, playedBy 'start') for stats — but show it
  const played = chain.filter(e => e.playedBy !== 'start' && e.score > 0);
  const allWords = chain.filter(e => e.word.simplified); // all including start

  // Stats
  const totalScore = played.reduce((s, e) => s + e.score, 0);
  const longestWord = [...allWords].sort((a, b) => b.word.wordLength - a.word.wordLength)[0];
  const bestWord = played.length > 0 ? [...played].sort((a, b) => b.score - a.score)[0] : null;
  const chengyuCount = allWords.filter(e => e.word.isChengyu).length;

  return (
    <div className="w-full max-w-lg mx-auto mt-6 flex flex-col gap-5">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-700" />
        <span className="text-slate-400 text-sm font-medium">Vocabulary Review</span>
        <div className="flex-1 h-px bg-slate-700" />
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-2 justify-center">
        <StatCard label="Words played" value={allWords.length} />
        <StatCard label="Total score" value={totalScore} />
        {longestWord && (
          <StatCard label="Longest word" value={longestWord.word.simplified} />
        )}
        {bestWord && (
          <StatCard label="Best word" value={`${bestWord.word.simplified} +${bestWord.score}`} />
        )}
        {chengyuCount > 0 && (
          <StatCard label="Chengyu 成语" value={chengyuCount} />
        )}
      </div>

      {/* Word list */}
      <div className="flex flex-col gap-2">
        {allWords.map((entry, i) => {
          const isStart = entry.playedBy === 'start';
          return (
            <div
              key={i}
              className={`flex items-start gap-4 px-4 py-3 rounded-xl bg-slate-800 border ${
                isStart ? 'border-slate-700/40 opacity-70' : 'border-slate-700'
              }`}
            >
              {/* Index */}
              <span className="text-slate-600 text-xs w-5 text-right shrink-0 mt-1">{i + 1}</span>

              {/* Chinese + pinyin */}
              <div className="flex flex-col items-start shrink-0 min-w-[5rem]">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-white text-2xl font-bold leading-tight tracking-wide">
                    {entry.word.simplified}
                  </span>
                  {wordLengthBonus(entry.word.wordLength) > 0 && (
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-violet-900/70 text-violet-300 leading-none">
                      {entry.word.wordLength}字 +{wordLengthBonus(entry.word.wordLength)}
                    </span>
                  )}
                </div>
                <span className="text-slate-400 text-xs font-mono mt-0.5">
                  {toToneMarks(entry.word.pinyin)}
                </span>
              </div>

              {/* Meaning + connection */}
              <div className="flex-1 flex flex-col justify-center">
                {entry.word.hskLevel && (
                  <span className={`self-start text-xs px-1.5 py-0.5 rounded font-mono mb-1 ${HSK_COLORS[entry.word.hskLevel] ?? 'bg-slate-700 text-slate-400'}`}>
                    HSK{entry.word.hskLevel}
                  </span>
                )}
                <span className="text-slate-200 text-sm leading-snug">
                  {shortMeaning(entry.word.english)}
                </span>
                {entry.connectionType && CONNECTION_LABELS[entry.connectionType] && (
                  <span className={`text-xs mt-1 ${CONNECTION_COLORS[entry.connectionType]}`}>
                    {CONNECTION_LABELS[entry.connectionType]}
                    {entry.word.isChengyu ? ' · 成语' : ''}
                  </span>
                )}
                {isStart && (
                  <span className="text-xs text-slate-600 mt-0.5">Starting word</span>
                )}
              </div>

              {/* Score */}
              {entry.score > 0 && (
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-emerald-400 font-bold text-sm">+{entry.score}</span>
                  {entry.speedMultiplier && entry.speedMultiplier !== 1 && (
                    <span className="text-slate-500 text-xs">{entry.speedMultiplier.toFixed(1)}×</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
