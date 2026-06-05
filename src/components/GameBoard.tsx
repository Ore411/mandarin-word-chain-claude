'use client';

import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import VocabReview from '@/components/VocabReview';

function shortMeaning(english: string, n = 2) {
  return english.split(';').slice(0, n).join(';').trim();
}
import type { ChainEntry, GameMode, GameOverReason, VsSubmode, ComputerLevel, ChainMode } from '@/hooks/useGameState';
import type { MoveResult, ConnectionType } from '@/lib/gameRules';
import { calcSpeedMultiplier } from '@/lib/gameRules';
import { getInitialFamilyDisplay, getCompatibleFinals } from '@/lib/pinyin';

const CONNECTION_LABELS: Record<ConnectionType, string> = {
  exactChar: 'Exact character +10',
  exactInitialExactFinal: 'Same sound +8',
  familyInitialExactFinal: 'Same final, related initial +6',
  exactInitialStrongFinal: 'Same initial, similar final +5',
  familyInitialStrongFinal: 'Related sound +3',
  weakMusicalFinal: 'Musical rhyme +2',
  invalid: 'Invalid',
};

const CONNECTION_COLORS: Record<ConnectionType, string> = {
  exactChar: 'text-emerald-400',
  exactInitialExactFinal: 'text-sky-400',
  familyInitialExactFinal: 'text-sky-300',
  exactInitialStrongFinal: 'text-violet-400',
  familyInitialStrongFinal: 'text-violet-300',
  weakMusicalFinal: 'text-amber-400',
  invalid: 'text-red-400',
};

const SUBMODE_LABELS: Record<VsSubmode, string> = {
  'first-to-x': '🏆 First to 50',
  'fixed-rounds': '🎯 10 Rounds',
  'lives': '❤️ 3 Lives',
};

function PlayerLabel({ playedBy, mode }: { playedBy: ChainEntry['playedBy']; mode: GameMode }) {
  if (playedBy === 'start') return <span className="text-slate-500 text-xs">Starting word</span>;
  if (mode === 'vs-computer') {
    return playedBy === 0
      ? <span className="text-emerald-400 text-xs">You</span>
      : <span className="text-rose-400 text-xs">Computer</span>;
  }
  if (mode === 'pass-and-play') {
    return playedBy === 0
      ? <span className="text-sky-400 text-xs">Player 1</span>
      : <span className="text-amber-400 text-xs">Player 2</span>;
  }
  return <span className="text-emerald-400 text-xs">You</span>;
}

function wordLengthBonus(n: number): number {
  if (n === 3) return 2;
  if (n === 4) return 4;
  if (n >= 5) return 6;
  return 0;
}

function ChainEntryRow({ entry, mode, isLast }: { entry: ChainEntry; mode: GameMode; isLast: boolean }) {
  const charCount = [...entry.word.simplified].length;
  const lb = entry.word.isChengyu ? 0 : wordLengthBonus(charCount);
  const mult = entry.speedMultiplier ?? 1;
  const multColor = mult >= 1.8 ? 'text-emerald-400' : mult >= 1.0 ? 'text-amber-400' : 'text-red-400';
  return (
    <div className={`flex items-start gap-3 py-3 ${isLast ? 'opacity-100' : 'opacity-60'}`}>
      <div className="flex flex-col items-end min-w-[2.5rem]">
        <PlayerLabel playedBy={entry.playedBy} mode={mode} />
        {entry.score > 0 && (
          <span className="text-slate-400 text-xs">
            +{entry.score}
            <span className={`ml-0.5 ${multColor}`}>{mult.toFixed(1)}×</span>
          </span>
        )}
      </div>
      <div className="flex flex-col flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white tracking-wider">{entry.word.simplified}</span>
          <HskBadge level={entry.word.hskLevel} />
        </div>
        <span className="text-slate-400 text-xs">{entry.word.pinyin}</span>
        <span className="text-slate-500 text-xs truncate max-w-xs">{shortMeaning(entry.word.english)}</span>
        {entry.connectionType && (
          <span className={`text-xs mt-0.5 ${CONNECTION_COLORS[entry.connectionType as ConnectionType]}`}>
            {CONNECTION_LABELS[entry.connectionType as ConnectionType]}
            {entry.word.isChengyu
              ? ' · Chengyu +5'
              : lb > 0
                ? ` · ${charCount}字 +${lb}`
                : null}
          </span>
        )}
      </div>
    </div>
  );
}

const HSK_COLORS: Record<number, string> = {
  1: 'bg-emerald-800 text-emerald-200',
  2: 'bg-sky-800 text-sky-200',
  3: 'bg-violet-800 text-violet-200',
  4: 'bg-amber-800 text-amber-200',
  5: 'bg-orange-800 text-orange-200',
  6: 'bg-red-900 text-red-200',
};

function HskBadge({ level }: { level: number | null }) {
  if (!level) return null;
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${HSK_COLORS[level] ?? 'bg-slate-700 text-slate-400'}`}>
      HSK{level}
    </span>
  );
}

function SpeedBadge({ timeRemaining, turnSeconds }: { timeRemaining: number; turnSeconds: number }) {
  const mult = calcSpeedMultiplier(timeRemaining, turnSeconds);
  const color = mult >= 1.8 ? 'text-emerald-300 bg-emerald-900/60' :
                mult >= 1.0 ? 'text-amber-300 bg-amber-900/60' : 'text-red-400 bg-red-900/40';
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${color}`}>
      {mult.toFixed(1)}×
    </span>
  );
}

function TimerBar({ timeRemaining, turnSeconds }: { timeRemaining: number; turnSeconds: number }) {
  const pct = (timeRemaining / turnSeconds) * 100;
  const half = turnSeconds / 2;
  const color = timeRemaining > half ? 'bg-emerald-500' : timeRemaining > turnSeconds * 0.27 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-1000 ease-linear ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Lives({ count, max }: { count: number; max: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={`text-sm ${i < count ? 'text-red-400' : 'text-slate-700'}`}>♥</span>
      ))}
    </div>
  );
}

interface GameBoardProps {
  chain: ChainEntry[];
  scores: [number, number];
  currentPlayer: 0 | 1;
  timeRemaining: number;
  isComputerThinking: boolean;
  gameOverReason: GameOverReason | null;
  lastMoveResult: MoveResult | null;
  mode: GameMode;
  vsSubmode: VsSubmode | null;
  computerLevel: ComputerLevel;
  chainMode?: ChainMode;
  status: string;
  lives: [number, number];
  playerTurnsLeft: number;
  firstToXTarget: number;
  roundsTotal: number;
  turnSeconds: number;
  onSubmit: (word: string) => void;
  onReset: () => void;
}

export default function GameBoard({
  chain, scores, currentPlayer, timeRemaining,
  isComputerThinking, gameOverReason, lastMoveResult,
  mode, vsSubmode, computerLevel, chainMode = 'learner', status, lives, playerTurnsLeft, firstToXTarget, roundsTotal,
  turnSeconds,
  onSubmit, onReset,
}: GameBoardProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const chainEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chainEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chain.length]);
  useEffect(() => {
    if (status === 'playing' && !isComputerThinking) inputRef.current?.focus();
  }, [status, isComputerThinking, currentPlayer]);
  useEffect(() => { if (lastMoveResult?.valid) setInput(''); }, [chain.length, lastMoveResult?.valid]);

  const imeHint = (() => {
    if (typeof navigator === 'undefined') return null;
    const ua = navigator.userAgent;
    const isMac = /Mac/.test(navigator.platform ?? ua);
    const isWin = /Win/.test(navigator.platform ?? ua);
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);
    if (isIOS || isAndroid) return 'Hold the globe key to switch to Chinese keyboard';
    if (isMac) return 'Switch to Chinese: Ctrl+Space (or Caps Lock if configured)';
    if (isWin) return 'Switch to Chinese: Win+Space';
    return 'Switch to Chinese: check your OS input method settings';
  })();

  function handleSubmit() {
    if (!input.trim()) return;
    onSubmit(input.trim());
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSubmit();
  }

  const currentWord = chain[chain.length - 1];
  const isGameOver = status === 'game-over';

  const playerName = (p: 0 | 1) => {
    if (mode === 'vs-computer') return p === 0 ? 'You' : 'Computer';
    if (mode === 'pass-and-play') return p === 0 ? 'Player 1' : 'Player 2';
    return 'You';
  };

  const playerColor = (p: 0 | 1) =>
    mode === 'vs-computer'
      ? p === 0 ? 'text-emerald-400' : 'text-rose-400'
      : p === 0 ? 'text-sky-400' : 'text-amber-400';

  // ── Game Over ──────────────────────────────────────────────────────────────
  if (isGameOver) {
    const loser: 0 | 1 = currentPlayer;
    const winner: 0 | 1 | null = mode === 'solo' ? null : loser === 0 ? 1 : 0;

    // For submode wins, use score comparison (both finished their turns)
    const submodeWinner: 0 | 1 | null =
      gameOverReason === 'target-reached' || gameOverReason === 'rounds-complete'
        ? scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : null
        : winner;

    const gameOverTitle = () => {
      if (gameOverReason === 'target-reached') return '🏆 Target reached!';
      if (gameOverReason === 'rounds-complete') return '🎯 Rounds complete!';
      if (gameOverReason === 'no-valid-moves') return 'No valid moves!';
      if (vsSubmode === 'lives') return '💔 Out of lives!';
      return 'Time ran out!';
    };

    const winnerText = () => {
      if (submodeWinner === null) return "It's a draw!";
      if (submodeWinner === 0 && mode === 'vs-computer') return 'You win!';
      return `${playerName(submodeWinner)} wins!`;
    };

    return (
      <div className="h-full overflow-y-auto">
      <div className="flex flex-col items-center gap-6 text-center px-4 py-8">
        <h2 className="text-4xl font-bold text-white">Game Over</h2>
        <div className="flex items-center gap-3">
          {vsSubmode && (
            <div className="text-xs text-slate-500 uppercase tracking-wider">{SUBMODE_LABELS[vsSubmode]}</div>
          )}
          {computerLevel != null && (
            <div className="text-xs bg-violet-900 text-violet-300 px-2 py-0.5 rounded font-mono">Computer: HSK ≤{computerLevel}</div>
          )}
        </div>
        <p className="text-slate-400 text-lg">{gameOverTitle()}</p>

        {mode !== 'solo' && (
          <div className={`text-xl font-semibold ${submodeWinner !== null ? playerColor(submodeWinner as 0 | 1) : 'text-slate-300'}`}>
            {winnerText()}
          </div>
        )}

        <div className="flex gap-8">
          {mode !== 'solo' ? (
            <>
              <div className="text-center">
                <div className={`text-3xl font-bold ${playerColor(0)}`}>{scores[0]}</div>
                <div className="text-slate-400 text-sm">{playerName(0)}</div>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${playerColor(1)}`}>{scores[1]}</div>
                <div className="text-slate-400 text-sm">{playerName(1)}</div>
              </div>
            </>
          ) : (
            <div className="text-center">
              <div className="text-4xl font-bold text-emerald-400">{scores[0]}</div>
              <div className="text-slate-400">Final score</div>
            </div>
          )}
        </div>

        <button
          onClick={onReset}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold transition-colors"
        >
          Play Again
        </button>

        <VocabReview chain={chain} />
      </div>
      </div>
    );
  }

  // ── Playing ────────────────────────────────────────────────────────────────
  const roundsPlayed = roundsTotal - playerTurnsLeft;

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex-none px-4 pt-3 pb-3 border-b border-slate-700">
        {/* Submode badge + status */}
        <div className="flex justify-between items-center mb-2">
          {mode !== 'solo' ? (
            <>
              {/* Left: player score + lives */}
              <div className={`text-center transition-opacity ${currentPlayer === 0 ? 'opacity-100' : 'opacity-40'}`}>
                <div className={`text-xl font-bold ${playerColor(0)}`}>{scores[0]}</div>
                <div className="text-slate-400 text-xs">{playerName(0)}</div>
                {vsSubmode === 'lives' && <Lives count={lives[0]} max={3} />}
              </div>

              {/* Center: submode badge + turn indicator */}
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  {vsSubmode && (
                    <span className="text-xs text-slate-500 font-medium">{SUBMODE_LABELS[vsSubmode]}</span>
                  )}
                  {computerLevel != null && (
                    <span className="text-xs bg-violet-900 text-violet-300 px-1.5 py-0.5 rounded font-mono">HSK ≤{computerLevel}</span>
                  )}
                  <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${chainMode === 'advanced' ? 'bg-amber-900 text-amber-300' : 'bg-slate-700 text-slate-400'}`}>
                    {chainMode === 'advanced' ? '⚡ Advanced' : '🎓 Learner'}
                  </span>
                </div>
                <div className={`text-slate-300 text-sm font-medium ${isComputerThinking ? 'animate-pulse text-rose-400' : ''}`}>
                  {isComputerThinking
                    ? 'Computer thinking…'
                    : currentPlayer === 0 && mode === 'vs-computer'
                      ? 'Your turn'
                      : `${playerName(currentPlayer)}'s turn`}
                </div>
                {vsSubmode === 'fixed-rounds' && (
                  <span className="text-xs text-slate-500">
                    Round {Math.min(roundsPlayed + 1, roundsTotal)} / {roundsTotal}
                  </span>
                )}
                {vsSubmode === 'first-to-x' && (
                  <span className="text-xs text-slate-500">First to {firstToXTarget} pts</span>
                )}
              </div>

              {/* Right: computer score */}
              <div className={`text-center transition-opacity ${currentPlayer === 1 ? 'opacity-100' : 'opacity-40'}`}>
                <div className={`text-xl font-bold ${playerColor(1)}`}>{scores[1]}</div>
                <div className="text-slate-400 text-xs">{playerName(1)}</div>
                {vsSubmode === 'lives' && <div className="text-xs text-slate-600">∞</div>}
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col items-start gap-1">
                <div className="text-slate-400 text-sm">Score</div>
                <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${chainMode === 'advanced' ? 'bg-amber-900 text-amber-300' : 'bg-slate-700 text-slate-400'}`}>
                  {chainMode === 'advanced' ? '⚡ Advanced' : '🎓 Learner'}
                </span>
              </div>
              <div className="text-2xl font-bold text-emerald-400">{scores[0]}</div>
              <div className="text-slate-400 text-sm">Words: {chain.length}</div>
            </>
          )}
        </div>

        {/* First-to-X progress bars */}
        {vsSubmode === 'first-to-x' && (
          <div className="flex gap-1 mb-2">
            <div className="flex-1 bg-slate-700 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (scores[0] / firstToXTarget) * 100)}%` }}
              />
            </div>
            <div className="flex-1 bg-slate-700 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-rose-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (scores[1] / firstToXTarget) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Timer */}
        <div className="flex items-center gap-2">
          <TimerBar timeRemaining={timeRemaining} turnSeconds={turnSeconds} />
          <span className={`text-sm font-mono w-6 text-right ${mode !== 'solo' && timeRemaining <= (turnSeconds * 0.27) ? 'text-red-400' : 'text-slate-400'}`}>
            {timeRemaining}
          </span>
          <SpeedBadge timeRemaining={timeRemaining} turnSeconds={turnSeconds} />
        </div>
        {mode === 'solo' && (
          <div className="text-xs text-slate-600 mt-1 text-center">Timer resets automatically — take your time</div>
        )}
      </div>

      {/* Chain history */}
      <div className="flex-1 overflow-y-auto px-4 py-2 divide-y divide-slate-800">
        {chain.map((entry, i) => (
          <ChainEntryRow key={i} entry={entry} mode={mode} isLast={i === chain.length - 1} />
        ))}
        {isComputerThinking && (
          <div className="py-3 flex items-center gap-2 text-rose-400 animate-pulse text-xl">…</div>
        )}
        <div ref={chainEndRef} />
      </div>

      {/* Connect-from prompt */}
      {currentWord && !isComputerThinking && (() => {
        const { initial, final } = currentWord.word.lastSyllable;
        const { family, members } = getInitialFamilyDisplay(initial);
        const compatFinals = getCompatibleFinals(final);
        return (
          <div className="flex-none bg-slate-800 border-t-2 border-emerald-700">
            {/* Word display */}
            <div className="px-4 pt-4 pb-3">
              {/* Chinese + English equally prominent */}
              <div className="flex items-center gap-4 mb-2">
                <span className="text-5xl font-bold text-emerald-300 tracking-wider leading-none drop-shadow-[0_0_12px_rgba(110,231,183,0.4)] shrink-0">
                  {currentWord.word.simplified}
                </span>
                <span className="text-slate-400 text-xs font-mono leading-tight shrink-0">{currentWord.word.pinyin}</span>
                <span className="text-white text-lg leading-snug font-semibold">
                  {shortMeaning(currentWord.word.english)}
                </span>
              </div>
              {/* Chain target */}
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs">Continue with:</span>
                <span className="text-2xl font-bold text-emerald-400">{currentWord.word.lastChar}</span>
                <span className="text-slate-400 text-sm font-mono">{initial || '∅'}{final}</span>
              </div>
            </div>

            {/* Hints row */}
            <div className="px-4 pb-3 flex flex-wrap gap-x-4 gap-y-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-500 text-xs">Initials:</span>
                {members.length > 0 ? (
                  <>
                    <span className="text-slate-500 text-xs">{family} —</span>
                    {members.map(m => (
                      <span key={m} className={`px-1.5 py-0.5 rounded text-xs font-mono ${m === initial ? 'bg-emerald-700 text-emerald-200' : 'bg-slate-700 text-slate-300'}`}>{m}</span>
                    ))}
                  </>
                ) : (
                  <span className="text-slate-500 text-xs">vowel-start only</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-500 text-xs">Finals:</span>
                {compatFinals.map(cf => (
                  <span key={cf.final} className={`px-1.5 py-0.5 rounded text-xs font-mono ${cf.type === 'exact' ? 'bg-emerald-700 text-emerald-200' : cf.type === 'strong' ? 'bg-sky-800 text-sky-200' : 'bg-amber-900 text-amber-200'}`}>
                    {cf.final}{cf.type === 'strong' && ' ≈'}{cf.type === 'weak' && ' ~'}
                  </span>
                ))}
              </div>

              {/* Length bonus chips */}
              <div className="w-full flex items-center gap-1.5 flex-wrap mt-0.5">
                <span className="text-slate-500 text-xs">Length bonus:</span>
                {[
                  { chars: 2, bonus: 0,  label: '2字' },
                  { chars: 3, bonus: 2,  label: '3字' },
                  { chars: 4, bonus: 4,  label: '4字' },
                  { chars: 5, bonus: 6,  label: '5字+' },
                ].map(({ chars, bonus, label }) => {
                  const inputLen = [...input].length;
                  const isActive = inputLen > 0 && (chars === 5 ? inputLen >= 5 : inputLen === chars);
                  return bonus === 0 ? null : (
                    <span
                      key={chars}
                      className={`px-2 py-0.5 rounded text-xs font-mono font-semibold transition-colors ${
                        isActive
                          ? 'bg-violet-600 text-white ring-1 ring-violet-400'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {label} <span className={isActive ? 'text-violet-200' : 'text-slate-500'}>+{bonus}×</span>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Input */}
      <div className="flex-none px-4 py-4 border-t border-slate-700">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type a Chinese word…"
            disabled={isComputerThinking || status !== 'playing'}
            className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg placeholder-slate-600 focus:outline-none focus:border-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSubmit}
            disabled={isComputerThinking || status !== 'playing' || !input.trim()}
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors"
          >
            Play
          </button>
        </div>
        {lastMoveResult && !lastMoveResult.valid && (
          <div className="text-red-400 text-sm mt-1">
            {lastMoveResult.connectionType === 'exactChar' && chainMode === 'advanced'
              ? '✗ Advanced Mode only accepts exact character matches'
              : '✗ Word not found or invalid connection'}
          </div>
        )}
        {imeHint && (
          <div className="text-slate-600 text-xs mt-1.5">{imeHint}</div>
        )}
      </div>
    </div>
  );
}
