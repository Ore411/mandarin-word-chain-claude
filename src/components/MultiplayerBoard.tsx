'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import type { RoomState, ChainEntry, PlayerInfo } from '@/hooks/useMultiplayerGame';
import { getInitialFamilyDisplay, getCompatibleFinals } from '@/lib/pinyin';

// 10 distinct colours cycling for players
const PLAYER_COLORS = [
  'text-sky-400', 'text-amber-400', 'text-emerald-400', 'text-rose-400',
  'text-violet-400', 'text-orange-400', 'text-teal-400', 'text-pink-400',
  'text-lime-400', 'text-cyan-400',
];
const PLAYER_BG = [
  'bg-sky-900/60', 'bg-amber-900/60', 'bg-emerald-900/60', 'bg-rose-900/60',
  'bg-violet-900/60', 'bg-orange-900/60', 'bg-teal-900/60', 'bg-pink-900/60',
  'bg-lime-900/60', 'bg-cyan-900/60',
];

function playerColor(index: number) { return PLAYER_COLORS[index % PLAYER_COLORS.length]; }
function playerBg(index: number) { return PLAYER_BG[index % PLAYER_BG.length]; }

const CONNECTION_LABELS: Record<string, string> = {
  exactChar: 'Exact character +10',
  exactInitialExactFinal: 'Same sound +8',
  familyInitialExactFinal: 'Same final, related initial +6',
  exactInitialStrongFinal: 'Same initial, similar final +5',
  familyInitialStrongFinal: 'Related sound +3',
  weakMusicalFinal: 'Musical rhyme +2',
};
const CONNECTION_COLORS: Record<string, string> = {
  exactChar: 'text-emerald-400', exactInitialExactFinal: 'text-sky-400',
  familyInitialExactFinal: 'text-sky-300', exactInitialStrongFinal: 'text-violet-400',
  familyInitialStrongFinal: 'text-violet-300', weakMusicalFinal: 'text-amber-400',
};

const MAX_TIMEOUTS = 3;

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

function Strikes({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: MAX_TIMEOUTS }).map((_, i) => (
        <span key={i} className={`text-xs ${i < count ? 'text-red-400' : 'text-slate-700'}`}>✕</span>
      ))}
    </div>
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

function SpeedMultiplierBadge({ timeRemaining, turnSeconds }: { timeRemaining: number; turnSeconds: number }) {
  const gracePeriod = 5;
  const mult = timeRemaining >= turnSeconds - gracePeriod
    ? 2.0
    : Math.round((0.1 + (timeRemaining / (turnSeconds - gracePeriod)) * 1.9) * 10) / 10;
  const color = mult >= 1.8 ? 'text-emerald-300 bg-emerald-900/60' :
                mult >= 1.4 ? 'text-amber-300 bg-amber-900/60' : 'text-slate-400 bg-slate-800';
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${color}`}>
      {mult.toFixed(1)}×
    </span>
  );
}

function ChainRow({ entry, players, isLast }: { entry: ChainEntry; players: PlayerInfo[]; isLast: boolean }) {
  const player = players.find(p => p.index === entry.playerIndex);
  return (
    <div className={`flex items-start gap-3 py-3 ${isLast ? 'opacity-100' : 'opacity-60'}`}>
      <div className="flex flex-col items-end min-w-[2.5rem]">
        {entry.playedBy === 'start'
          ? <span className="text-slate-500 text-xs">Start</span>
          : <span className={`text-xs font-medium ${playerColor(entry.playerIndex)}`}>{player?.name ?? '?'}</span>}
        {entry.score > 0 && (
          <span className="text-slate-400 text-xs">
            +{entry.score}
            {entry.speedMultiplier > 1 && (
              <span className="text-emerald-500 ml-0.5">{entry.speedMultiplier.toFixed(1)}×</span>
            )}
          </span>
        )}
      </div>
      <div className="flex flex-col">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white tracking-wider">{entry.word.simplified}</span>
          <HskBadge level={entry.word.hskLevel} />
        </div>
        <span className="text-slate-400 text-xs">{entry.word.pinyin}</span>
        <span className="text-slate-500 text-xs truncate max-w-xs">{entry.word.english}</span>
        {entry.connectionType && CONNECTION_LABELS[entry.connectionType] && (
          <span className={`text-xs mt-0.5 ${CONNECTION_COLORS[entry.connectionType] ?? ''}`}>
            {CONNECTION_LABELS[entry.connectionType]}
            {entry.word.isChengyu ? ' · Chengyu +5' : ''}
          </span>
        )}
      </div>
    </div>
  );
}

interface Props {
  roomState: RoomState;
  myIndex: number | null;
  isMyTurn: boolean;
  isHost: boolean;
  serverError: string | null;
  roomId: string;
  onSubmit: (word: string) => void;
  onStart: (turnSeconds: 30 | 60, targetScore: number | null, livesMode: number | null) => void;
  onRematch: () => void;
  onLeave: () => void;
}

export default function MultiplayerBoard({
  roomState, myIndex, isMyTurn, isHost, serverError, roomId, onSubmit, onStart, onRematch, onLeave,
}: Props) {
  const [input, setInput] = useState('');
  const [selectedTime, setSelectedTime] = useState<30 | 60>(30);
  const [gameMode, setGameMode] = useState<'endless' | 'first-to-x' | 'lives'>('endless');
  const [selectedTarget, setSelectedTarget] = useState<number>(100);
  const [selectedLives, setSelectedLives] = useState<number>(3);
  const inputRef = useRef<HTMLInputElement>(null);
  const chainEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chainEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [roomState.chain.length]);
  useEffect(() => { if (isMyTurn && roomState.status === 'playing') inputRef.current?.focus(); }, [isMyTurn, roomState.status]);

  function handleSubmit() {
    if (!input.trim()) return;
    onSubmit(input.trim());
    setInput('');
  }
  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSubmit();
  }

  const { players, chain, currentPlayerIndex, turnSeconds, timeRemaining, targetScore, livesMode, status, gameOverReason, lastMoveError, hostId } = roomState;
  const currentTurnPlayer = players.find(p => p.index === currentPlayerIndex);
  const currentWord = chain[chain.length - 1];

  // ── Waiting / Lobby ───────────────────────────────────────────────────────
  if (status === 'waiting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <div className="text-2xl font-bold text-white">Room <span className="text-emerald-400 tracking-widest">{roomId.toUpperCase()}</span></div>

        {/* Share code */}
        <div className="bg-slate-800 rounded-2xl px-8 py-4 border border-slate-700 w-full max-w-sm">
          <p className="text-slate-400 text-xs mb-1">Share this code with friends:</p>
          <div className="text-4xl font-bold tracking-[0.3em] text-emerald-400 mb-3">{roomId.toUpperCase()}</div>
          <p className="text-slate-500 text-xs">{players.length} / 10 players joined</p>
        </div>

        {/* Player list */}
        <div className="w-full max-w-sm flex flex-col gap-2">
          {players.map((p) => (
            <div key={p.id} className={`flex items-center gap-3 px-4 py-2 rounded-xl ${playerBg(p.index)}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${playerColor(p.index)}`}>
                {p.index + 1}
              </span>
              <span className={`font-medium ${playerColor(p.index)} ${!p.connected ? 'opacity-40' : ''}`}>{p.name}</span>
              {!p.connected && <span className="text-xs text-slate-500">reconnecting…</span>}
              {p.id === hostId && p.connected && <span className="text-xs text-slate-500 ml-auto">host</span>}
              {p.index === myIndex && <span className="text-xs text-emerald-500 ml-auto">you</span>}
            </div>
          ))}
          {players.length < 2 && (
            <div className="flex items-center gap-2 text-slate-500 text-sm justify-center py-2">
              <span className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
              Waiting for more players…
            </div>
          )}
        </div>

        {/* Settings + start (host only) */}
        {isHost ? (
          <div className="flex flex-col items-center gap-4 w-full max-w-sm">
            {/* Game mode */}
            <div className="w-full">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2 text-center">Game mode</p>
              <div className="flex gap-2">
                {(['endless', 'first-to-x', 'lives'] as const).map(m => (
                  <button key={m} onClick={() => setGameMode(m)}
                    className={`flex-1 py-2 rounded-xl font-semibold text-xs transition-colors ${
                      gameMode === m ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {m === 'endless' ? 'Endless' : m === 'first-to-x' ? 'First to X' : '❤️ Lives'}
                  </button>
                ))}
              </div>
            </div>

            {/* Target score (First-to-X) */}
            {gameMode === 'first-to-x' && (
              <div className="w-full">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-2 text-center">Target score</p>
                <div className="flex gap-2">
                  {[100, 200, 500].map(t => (
                    <button key={t} onClick={() => setSelectedTarget(t)}
                      className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-colors ${
                        selectedTarget === t ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {t} pts
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Lives per player */}
            {gameMode === 'lives' && (
              <div className="w-full">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-2 text-center">Lives per player</p>
                <div className="flex gap-2">
                  {[1, 2, 3].map(l => (
                    <button key={l} onClick={() => setSelectedLives(l)}
                      className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-colors ${
                        selectedLives === l ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {'❤️'.repeat(l)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Time per turn */}
            <div className="w-full">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2 text-center">Time per turn</p>
              <div className="flex gap-2">
                {([30, 60] as const).map(t => (
                  <button key={t} onClick={() => setSelectedTime(t)}
                    className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-colors ${
                      selectedTime === t ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {t === 30 ? '30 seconds' : '1 minute'}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => onStart(
                selectedTime,
                gameMode === 'first-to-x' ? selectedTarget : null,
                gameMode === 'lives' ? selectedLives : null,
              )}
              disabled={players.length < 2}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors"
            >
              {players.length < 2 ? 'Need at least 2 players' : `Start Game (${players.length} players)`}
            </button>
          </div>
        ) : (
          <p className="text-slate-400 text-sm">Waiting for host to start…</p>
        )}

        <button onClick={onLeave} className="text-slate-500 hover:text-white text-sm transition-colors">← Leave room</button>
      </div>
    );
  }

  // ── Game Over ─────────────────────────────────────────────────────────────
  if (status === 'game-over') {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const winner = sorted[0]?.score > (sorted[1]?.score ?? 0) ? sorted[0] : null;

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <h2 className="text-4xl font-bold text-white">Game Over</h2>
        <p className="text-slate-400">
          {gameOverReason === 'timeout' ? 'Time ran out!' : gameOverReason ?? 'Game ended'}
        </p>

        {winner ? (
          <div className={`text-xl font-semibold ${playerColor(winner.index)}`}>
            {winner.index === myIndex ? 'You win! 🎉' : `${winner.name} wins!`}
          </div>
        ) : (
          <div className="text-slate-300 text-xl">It&apos;s a draw!</div>
        )}

        {/* Final leaderboard */}
        <div className="w-full max-w-sm flex flex-col gap-2">
          {sorted.map((p, rank) => {
            const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : null;
            const pct = targetScore ? Math.min(100, (p.score / targetScore) * 100) : null;
            return (
              <div key={p.id} className={`flex flex-col px-4 py-3 rounded-xl ${rank === 0 ? 'ring-2 ring-emerald-500' : ''} ${playerBg(p.index)}`}>
                <div className="flex items-center gap-3">
                  <span className="text-lg w-6 text-center">{medal ?? <span className="text-slate-500 text-sm">{rank + 1}</span>}</span>
                  <div className="flex-1 text-left">
                    <span className={`font-semibold ${playerColor(p.index)}`}>
                      {p.name}{p.index === myIndex ? ' (you)' : ''}
                    </span>
                    {p.eliminated && <span className="text-xs text-red-400 ml-2">eliminated</span>}
                    <div>
                      {livesMode ? (
                        <span className="text-xs">{Array.from({ length: livesMode }).map((_, i) => i < p.lives ? '❤️' : '🖤').join('')}</span>
                      ) : (
                        <Strikes count={p.timeouts} />
                      )}
                    </div>
                  </div>
                  <span className={`font-bold text-xl ${rank === 0 ? playerColor(p.index) : 'text-slate-300'}`}>{p.score}</span>
                  {targetScore && <span className="text-slate-500 text-xs">/ {targetScore}</span>}
                </div>
                {pct !== null && (
                  <div className="mt-2 w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-full rounded-full ${rank === 0 ? 'bg-emerald-400' : 'bg-slate-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-slate-500 text-sm">Chain length: {chain.length} words</div>
        <div className="flex gap-3">
          {isHost ? (
            <button onClick={onRematch} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold transition-colors">
              Play Again
            </button>
          ) : (
            <div className="text-slate-400 text-sm px-6 py-3">Waiting for host to start again…</div>
          )}
          <button onClick={onLeave} className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold transition-colors">
            Leave
          </button>
        </div>
      </div>
    );
  }

  // ── Playing ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full">
      {/* Scoreboard */}
      <div className="flex-none px-4 pt-3 pb-3 border-b border-slate-700">
        {/* Player score row */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {players.map(p => (
            <div
              key={p.id}
              className={`flex-none text-center px-3 py-1.5 rounded-lg transition-opacity ${
                p.eliminated ? 'opacity-25 line-through' :
                p.index === currentPlayerIndex ? 'opacity-100 ring-1 ring-current' : 'opacity-50'
              } ${playerColor(p.index)}`}
            >
              <div className="text-base font-bold leading-none">{p.score}</div>
              <div className="text-xs opacity-80 mt-0.5 max-w-[4rem] truncate">{p.name}</div>
              {p.index === myIndex && !p.eliminated && <div className="text-xs opacity-60">you</div>}
              {!p.connected && !p.eliminated && <div className="text-xs text-slate-500">···</div>}
              <div className="flex justify-center mt-0.5">
                {livesMode ? (
                  <span className="text-xs">{Array.from({ length: livesMode }).map((_, i) => i < p.lives ? '❤️' : '🖤').join('')}</span>
                ) : (
                  <Strikes count={p.timeouts} />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Target score progress (first-to-X mode) */}
        {targetScore && (
          <div className="mb-2">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>First to {targetScore} pts</span>
              <span>{Math.max(...players.map(p => p.score))} / {targetScore}</span>
            </div>
            <div className="flex gap-1">
              {players.map(p => (
                <div key={p.id} className="flex-1 bg-slate-700 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${playerColor(p.index).replace('text-', 'bg-')}`}
                    style={{ width: `${Math.min(100, (p.score / targetScore) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Turn + multiplier */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-slate-300 text-sm font-medium">
            {isMyTurn
              ? 'Your turn'
              : currentTurnPlayer?.eliminated
                ? `${currentTurnPlayer.name} eliminated…`
                : `${currentTurnPlayer?.name ?? '…'}'s turn`}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-xs">Speed bonus</span>
            <SpeedMultiplierBadge timeRemaining={timeRemaining} turnSeconds={turnSeconds ?? 30} />
          </div>
        </div>

        {/* Timer */}
        <div className="flex items-center gap-2">
          <TimerBar timeRemaining={timeRemaining} turnSeconds={turnSeconds ?? 30} />
          <span className={`text-sm font-mono w-6 text-right ${timeRemaining <= 8 ? 'text-red-400' : 'text-slate-400'}`}>
            {timeRemaining}
          </span>
        </div>
      </div>

      {/* Chain */}
      <div className="flex-1 overflow-y-auto px-4 py-2 divide-y divide-slate-800">
        {chain.map((entry, i) => (
          <ChainRow key={i} entry={entry} players={players} isLast={i === chain.length - 1} />
        ))}
        <div ref={chainEndRef} />
      </div>

      {/* Connect-from hint */}
      {currentWord && (() => {
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
                  {currentWord.word.english}
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
                ) : <span className="text-slate-500 text-xs">vowel-start only</span>}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-500 text-xs">Finals:</span>
                {compatFinals.map(cf => (
                  <span key={cf.final} className={`px-1.5 py-0.5 rounded text-xs font-mono ${cf.type === 'exact' ? 'bg-emerald-700 text-emerald-200' : cf.type === 'strong' ? 'bg-sky-800 text-sky-200' : 'bg-amber-900 text-amber-200'}`}>
                    {cf.final}{cf.type === 'strong' && ' ≈'}{cf.type === 'weak' && ' ~'}
                  </span>
                ))}
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
            placeholder={isMyTurn ? 'Type a Chinese word…' : `Waiting for ${currentTurnPlayer?.name ?? '…'}…`}
            disabled={!isMyTurn}
            className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg placeholder-slate-600 focus:outline-none focus:border-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSubmit}
            disabled={!isMyTurn || !input.trim()}
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors"
          >
            Play
          </button>
        </div>
        {(lastMoveError || serverError) && (
          <div className="text-red-400 text-sm mt-1">✗ {lastMoveError ?? serverError}</div>
        )}
      </div>
    </div>
  );
}
