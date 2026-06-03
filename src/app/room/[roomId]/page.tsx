'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useMultiplayerGame } from '@/hooks/useMultiplayerGame';
import MultiplayerBoard from '@/components/MultiplayerBoard';

// Only mounts (and connects) after the player has entered their name
function GameSession({ roomId, playerName }: { roomId: string; playerName: string }) {
  const router = useRouter();
  const { roomState, myIndex, isMyTurn, serverError, submitWord } = useMultiplayerGame(roomId, playerName);

  if (!roomState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-white">Connecting…</div>
        <div className="w-48 bg-slate-700 rounded-full h-1 overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full animate-pulse w-3/4" />
        </div>
      </div>
    );
  }

  return (
    <MultiplayerBoard
      roomState={roomState}
      myIndex={myIndex}
      isMyTurn={isMyTurn}
      serverError={serverError}
      roomId={roomId}
      onSubmit={submitWord}
      onLeave={() => router.push('/')}
    />
  );
}

function RoomContent({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('playerName');
    if (saved) setNameInput(saved);
  }, []);

  function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = nameInput.trim() || 'Player';
    localStorage.setItem('playerName', name);
    setPlayerName(name);
  }

  if (!playerName) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <div className="text-2xl font-bold text-white">
          Join Room <span className="text-emerald-400 tracking-widest">{roomId.toUpperCase()}</span>
        </div>
        <form onSubmit={handleNameSubmit} className="flex flex-col gap-3 w-full max-w-xs">
          <input
            autoFocus
            type="text"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            placeholder="Your name"
            maxLength={20}
            className="bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg placeholder-slate-600 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold transition-colors"
          >
            Enter Room
          </button>
        </form>
        <button onClick={() => router.push('/')} className="text-slate-500 hover:text-white text-sm transition-colors">
          ← Back
        </button>
      </div>
    );
  }

  return <GameSession roomId={roomId} playerName={playerName} />;
}

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      <header className="flex-none flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <a href="/" className="text-slate-400 hover:text-white text-sm transition-colors">← Menu</a>
        <span className="text-white font-semibold tracking-wide">词语接龙</span>
        <span className="text-slate-500 text-xs font-mono">{roomId.toUpperCase()}</span>
      </header>
      <div className="flex-1 overflow-hidden">
        <RoomContent roomId={roomId} />
      </div>
    </div>
  );
}
