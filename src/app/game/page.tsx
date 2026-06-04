'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { useGameState } from '@/hooks/useGameState';
import type { GameMode, VsSubmode, ComputerLevel, ChainMode } from '@/hooks/useGameState';
import GameBoard from '@/components/GameBoard';

function GameContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mode = (searchParams.get('mode') ?? 'vs-computer') as GameMode;
  const submode = (searchParams.get('submode') ?? undefined) as VsSubmode | undefined;
  const levelParam = searchParams.get('level');
  const computerLevel = (levelParam ? parseInt(levelParam) : null) as ComputerLevel;
  const timeParam = searchParams.get('time');
  const turnSeconds = timeParam && [15, 30, 60].includes(parseInt(timeParam)) ? parseInt(timeParam) : undefined;
  const chainModeParam = searchParams.get('chainMode');
  const chainMode: ChainMode = chainModeParam === 'advanced' ? 'advanced' : 'learner';

  const {
    dictionaryLoading, status, mode: activeMode, vsSubmode, computerLevel: activeComputerLevel,
    chainMode: activeChainMode,
    chain, scores, currentPlayer, timeRemaining, isComputerThinking, gameOverReason,
    lastMoveResult, lives, playerTurnsLeft, firstToXTarget, roundsTotal,
    submitWord, startGame, resetGame,
  } = useGameState();

  useEffect(() => {
    if (status === 'ready') {
      startGame(mode, submode, computerLevel, turnSeconds, chainMode);
    }
  }, [status, mode, submode, computerLevel, turnSeconds, chainMode, startGame]);

  if (dictionaryLoading || status === 'loading' || status === 'ready') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center">
        <div className="text-4xl font-bold text-white">词语接龙</div>
        <div className="text-slate-400">Loading dictionary…</div>
        <div className="w-48 bg-slate-700 rounded-full h-1 overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full animate-pulse w-3/4" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      <header className="flex-none flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <button
          onClick={() => router.push('/')}
          className="text-slate-400 hover:text-white text-sm transition-colors"
        >
          ← Menu
        </button>
        <span className="text-white font-semibold tracking-wide">词语接龙</span>
        <div className="w-16" />
      </header>

      <div className="flex-1 overflow-hidden">
        <GameBoard
          chain={chain}
          scores={scores}
          currentPlayer={currentPlayer}
          timeRemaining={timeRemaining}
          isComputerThinking={isComputerThinking}
          gameOverReason={gameOverReason}
          lastMoveResult={lastMoveResult}
          mode={activeMode}
          vsSubmode={vsSubmode}
          computerLevel={activeComputerLevel}
          chainMode={activeChainMode}
          status={status}
          lives={lives}
          playerTurnsLeft={playerTurnsLeft}
          firstToXTarget={firstToXTarget}
          roundsTotal={roundsTotal}
          onSubmit={submitWord}
          onReset={resetGame}
        />
      </div>
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense>
      <GameContent />
    </Suspense>
  );
}
