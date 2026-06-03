'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import type { RoomState, ChainEntry, PlayerInfo } from '@/hooks/useMultiplayerGame';
import { getInitialFamilyDisplay, getCompatibleFinals } from '@/lib/pinyin';

const CONNECTION_LABELS: Record<string, string> = {
  exactChar: 'Exact character +10',
  exactInitialExactFinal: 'Same sound +8',
  familyInitialExactFinal: 'Same final, related initial +6',
  exactInitialStrongFinal: 'Same initial, similar final +5',
  familyInitialStrongFinal: 'Related sound +3',
  weakMusicalFinal: 'Musical rhyme +2',
};

const CONNECTION_COLORS: Record<string, string> = {
  exactChar: 'text-emerald-400',
  exactInitialExactFinal: 'text-sky-400',
  familyInitialExactFinal: 'text-sky-300',
  exactInitialStrongFinal: 'text-violet-400',
  familyInitialStrongFinal: 'text-violet-300',
  weakMusicalFinal: 'text-amber-400',
};

function TimerBar({ timeRemaining }: { timeRemaining: number }) {
  const pct = (timeRemaining / 30) * 100;
  const color = timeRemaining > 15 ? 'bg-emerald-500' : timeRemaining > 8 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-1000 ease-linear ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ChainRow({ entry, players, isLast }: { entry: ChainEntry; players: PlayerInfo[]; isLast: boolean }) {
  const player = players.find(p => p.index === entry.playerIndex);
  const colorClass = entry.playerIndex === 0 ? 'text-sky-400' : 'text-amber-400';
  return (
    <div className={`flex items-start gap-3 py-3 ${isLast ? 'opacity-100' : 'opacity-60'}`}>
      <div className="flex flex-col items-end min-w-[2.5rem]">
        {entry.playedBy === 'start'
          ? <span className="text-slate-500 text-xs">Start</span>
          : <span className={`text-xs ${colorClass}`}>{player?.name ?? '?'}</span>}
        {entry.score > 0 && <span className="text-slate-400 text-xs">+{entry.score}</span>}
      </div>
      <div className="flex flex-col">
        <span className="text-2xl font-bold text-white tracking-wider">{entry.word.simplified}</span>
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
  myIndex: 0 | 1 | null;
  isMyTurn: boolean;
  serverError: string | null;
  roomId: string;
  onSubmit: (word: string) => void;
  onLeave: () => void;
}

export default function MultiplayerBoard({ roomState, myIndex, isMyTurn, serverError, roomId, onSubmit, onLeave }: Props) {
  const [input, setInput] = useState('');
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

  const { players, chain, currentPlayerIndex, timeRemaining, status, gameOverReason, lastMoveError } = roomState;
  const p0 = players[0];
  const p1 = players[1];
  const currentWord = chain[chain.length - 1];
  const currentTurnPlayer = players.find(p => p.index === currentPlayerIndex);

  // ── Waiting ────────────────────────────────────────────────────────────────
  if (status === 'waiting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <div className="text-3xl font-bold text-white">Waiting for opponent…</div>
        <div className="bg-slate-800 rounded-2xl px-8 py-6 border border-slate-700">
          <p className="text-slate-400 text-sm mb-2">Share this room code with your friend:</p>
          <div className="text-4xl font-bold tracking-[0.3em] text-emerald-400">{roomId.toUpperCase()}</div>
        </div>
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {players[0] ? `${players[0].name} is ready` : 'Connecting…'}
        </div>
        <button onClick={onLeave} className="text-slate-500 hover:text-white text-sm transition-colors">← Leave room</button>
      </div>
    );
  }

  // ── Game Over ──────────────────────────────────────────────────────────────
  if (status === 'game-over') {
    const winner = p0 && p1
      ? p0.score > p1.score ? p0 : p1.score > p0.score ? p1 : null
      : null;

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <h2 className="text-4xl font-bold text-white">Game Over</h2>
        <p className="text-slate-400">
          {gameOverReason === 'timeout' ? 'Time ran out!' : gameOverReason ?? 'Game ended'}
        </p>
        {winner
          ? <div className={`text-xl font-semibold ${winner.index === 0 ? 'text-sky-400' : 'text-amber-400'}`}>
              {winner.index === myIndex ? 'You win! 🎉' : `${winner.name} wins!`}
            </div>
          : <div className="text-slate-300 text-xl">It&apos;s a draw!</div>
        }
        <div className="flex gap-8">
          {p0 && (
            <div className="text-center">
              <div className="text-3xl font-bold text-sky-400">{p0.score}</div>
              <div className="text-slate-400 text-sm">{p0.name}</div>
            </div>
          )}
          {p1 && (
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-400">{p1.score}</div>
              <div className="text-slate-400 text-sm">{p1.name}</div>
            </div>
          )}
        </div>
        <div className="text-slate-500 text-sm">Chain length: {chain.length} words</div>
        <button onClick={onLeave} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold transition-colors">
          Back to Menu
        </button>
      </div>
    );
  }

  // ── Playing ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex-none px-4 pt-3 pb-3 border-b border-slate-700">
        <div className="flex justify-between items-center mb-2">
          {/* Player 0 */}
          <div className={`text-center transition-opacity ${currentPlayerIndex === 0 ? 'opacity-100' : 'opacity-40'}`}>
            <div className="text-xl font-bold text-sky-400">{p0?.score ?? 0}</div>
            <div className="text-slate-400 text-xs">{p0?.name ?? '…'}</div>
            {myIndex === 0 && <div className="text-emerald-500 text-xs">you</div>}
          </div>

          {/* Center turn indicator */}
          <div className="flex flex-col items-center gap-1">
            <div className="text-slate-300 text-sm font-medium">
              {isMyTurn ? 'Your turn' : `${currentTurnPlayer?.name ?? '…'}'s turn`}
            </div>
          </div>

          {/* Player 1 */}
          <div className={`text-center transition-opacity ${currentPlayerIndex === 1 ? 'opacity-100' : 'opacity-40'}`}>
            <div className="text-xl font-bold text-amber-400">{p1?.score ?? 0}</div>
            <div className="text-slate-400 text-xs">{p1?.name ?? '…'}</div>
            {myIndex === 1 && <div className="text-emerald-500 text-xs">you</div>}
          </div>
        </div>

        {/* Timer */}
        <div className="flex items-center gap-2">
          <TimerBar timeRemaining={timeRemaining} />
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
          <div className="flex-none px-4 py-3 bg-slate-800 border-t border-slate-700 space-y-2">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-white">{currentWord.word.lastChar}</span>
              <span className="text-slate-300 text-sm font-mono">{initial || '∅'}{final}</span>
              <span className="text-slate-600 text-xs">exact char → +10</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-500 text-xs w-16 shrink-0">Initials:</span>
              {members.length > 0 ? (
                <>
                  <span className="text-slate-400 text-xs">{family} —</span>
                  {members.map(m => (
                    <span key={m} className={`px-1.5 py-0.5 rounded text-xs font-mono ${m === initial ? 'bg-emerald-700 text-emerald-200' : 'bg-slate-700 text-slate-300'}`}>{m}</span>
                  ))}
                </>
              ) : (
                <span className="text-slate-500 text-xs">vowel-start only</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-500 text-xs w-16 shrink-0">Finals:</span>
              {compatFinals.map(cf => (
                <span key={cf.final} className={`px-1.5 py-0.5 rounded text-xs font-mono ${cf.type === 'exact' ? 'bg-emerald-700 text-emerald-200' : cf.type === 'strong' ? 'bg-sky-800 text-sky-200' : 'bg-amber-900 text-amber-200'}`}>
                  {cf.final}{cf.type === 'strong' && ' ≈'}{cf.type === 'weak' && ' ~'}
                </span>
              ))}
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
            placeholder={isMyTurn ? 'Type a Chinese word…' : 'Waiting for opponent…'}
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
