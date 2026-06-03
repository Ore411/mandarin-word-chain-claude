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

function TimerBar({ timeRemaining }: { timeRemaining: number }) {
  const pct = (timeRemaining / 30) * 100;
  const color = timeRemaining > 15 ? 'bg-emerald-500' : timeRemaining > 8 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-1000 ease-linear ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function SpeedMultiplierBadge({ timeRemaining }: { timeRemaining: number }) {
  const mult = Math.round((1 + timeRemaining / 30) * 10) / 10;
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
  myIndex: number | null;
  isMyTurn: boolean;
  isHost: boolean;
  serverError: string | null;
  roomId: string;
  onSubmit: (word: string) => void;
  onStart: () => void;
  onLeave: () => void;
}

export default function MultiplayerBoard({
  roomState, myIndex, isMyTurn, isHost, serverError, roomId, onSubmit, onStart, onLeave,
}: Props) {
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

  const { players, chain, currentPlayerIndex, timeRemaining, status, gameOverReason, lastMoveError, hostId } = roomState;
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

        {/* Start button (host only) */}
        {isHost ? (
          <button
            onClick={onStart}
            disabled={players.length < 2}
            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors"
          >
            {players.length < 2 ? 'Need at least 2 players' : `Start Game (${players.length} players)`}
          </button>
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
          {sorted.map((p, rank) => (
            <div key={p.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${playerBg(p.index)}`}>
              <span className="text-slate-400 text-sm w-5 text-right">{rank + 1}</span>
              <span className={`flex-1 font-medium text-left ${playerColor(p.index)}`}>
                {p.name}{p.index === myIndex ? ' (you)' : ''}
              </span>
              <span className={`font-bold text-lg ${playerColor(p.index)}`}>{p.score}</span>
            </div>
          ))}
        </div>

        <div className="text-slate-500 text-sm">Chain length: {chain.length} words</div>
        <button onClick={onLeave} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold transition-colors">
          Back to Menu
        </button>
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
                p.index === currentPlayerIndex ? 'opacity-100 ring-1 ring-current' : 'opacity-50'
              } ${playerColor(p.index)}`}
            >
              <div className="text-base font-bold leading-none">{p.score}</div>
              <div className="text-xs opacity-80 mt-0.5 max-w-[4rem] truncate">{p.name}</div>
              {p.index === myIndex && <div className="text-xs opacity-60">you</div>}
              {!p.connected && <div className="text-xs text-slate-500">···</div>}
            </div>
          ))}
        </div>

        {/* Turn + multiplier */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-slate-300 text-sm font-medium">
            {isMyTurn ? 'Your turn' : `${currentTurnPlayer?.name ?? '…'}'s turn`}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-xs">Speed bonus</span>
            <SpeedMultiplierBadge timeRemaining={timeRemaining} />
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
              ) : <span className="text-slate-500 text-xs">vowel-start only</span>}
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
