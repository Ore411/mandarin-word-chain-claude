'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { loadDictionary, lookupWord } from '@/lib/dictionary';
import type { WordEntry, MoveResult, ConnectionType } from '@/lib/gameRules';
import { evaluateMove } from '@/lib/gameRules';
import { pickComputerMove } from '@/lib/computerPlayer';

export type GameMode = 'vs-computer' | 'solo' | 'pass-and-play';
export type VsSubmode = 'first-to-x' | 'fixed-rounds' | 'lives';
// null = no restriction (all words); 1–6 = max HSK level for computer's pool
export type ComputerLevel = 1 | 2 | 3 | 4 | 5 | 6 | null;
export type GameStatus = 'loading' | 'ready' | 'playing' | 'game-over';
export type GameOverReason = 'timeout' | 'no-valid-moves' | 'target-reached' | 'rounds-complete';

export interface ChainEntry {
  word: WordEntry;
  playedBy: 0 | 1 | 'start';
  score: number;
  connectionType: ConnectionType | '';
  speedMultiplier: number;
}

const TURN_SECONDS = 30;
const FIRST_TO_X_TARGET = 50;
const ROUNDS_TOTAL = 10;
const STARTING_LIVES = 3;

function dailySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function pickStartingWord(dictionary: WordEntry[]): WordEntry {
  const pool = dictionary.filter(e => e.wordLength === 2 && e.hskLevel !== null && e.hskLevel <= 3);
  const source = pool.length > 0 ? pool : dictionary.filter(e => e.wordLength === 2);
  const idx = Math.floor(seededRandom(dailySeed()) * source.length);
  return source[idx];
}

function usedSet(chain: ChainEntry[]): Set<string> {
  return new Set(chain.map(e => e.word.simplified));
}

export function useGameState() {
  const [dictionaryLoading, setDictionaryLoading] = useState(true);
  const [mode, setMode] = useState<GameMode>('vs-computer');
  const [vsSubmode, setVsSubmode] = useState<VsSubmode | null>(null);
  const [computerLevel, setComputerLevel] = useState<ComputerLevel>(null);
  const [status, setStatus] = useState<GameStatus>('loading');
  const [chain, setChain] = useState<ChainEntry[]>([]);
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [currentPlayer, setCurrentPlayer] = useState<0 | 1>(0);
  const [timeRemaining, setTimeRemaining] = useState(TURN_SECONDS);
  const [isComputerThinking, setIsComputerThinking] = useState(false);
  const [gameOverReason, setGameOverReason] = useState<GameOverReason | null>(null);
  const [lastMoveResult, setLastMoveResult] = useState<MoveResult | null>(null);
  const [lives, setLives] = useState<[number, number]>([STARTING_LIVES, STARTING_LIVES]);
  const [playerTurnsLeft, setPlayerTurnsLeft] = useState(ROUNDS_TOTAL);

  // Refs so callbacks always see current values
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dictionaryRef = useRef<WordEntry[]>([]);
  const chainRef = useRef<ChainEntry[]>([]);
  const scoresRef = useRef<[number, number]>([0, 0]);
  const modeRef = useRef<GameMode>('vs-computer');
  const vsModeRef = useRef<VsSubmode | null>(null);
  const computerLevelRef = useRef<ComputerLevel>(null);
  const currentPlayerRef = useRef<0 | 1>(0);
  const livesRef = useRef<[number, number]>([STARTING_LIVES, STARTING_LIVES]);
  const playerTurnsLeftRef = useRef(ROUNDS_TOTAL);
  // Prevents double-fire of timeout in React Strict Mode
  const timeoutFiredRef = useRef(false);

  useEffect(() => { chainRef.current = chain; }, [chain]);
  useEffect(() => { scoresRef.current = scores; }, [scores]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { vsModeRef.current = vsSubmode; }, [vsSubmode]);
  useEffect(() => { computerLevelRef.current = computerLevel; }, [computerLevel]);
  useEffect(() => { currentPlayerRef.current = currentPlayer; }, [currentPlayer]);
  useEffect(() => { livesRef.current = lives; }, [lives]);
  useEffect(() => { playerTurnsLeftRef.current = playerTurnsLeft; }, [playerTurnsLeft]);

  useEffect(() => {
    loadDictionary().then(data => {
      dictionaryRef.current = data;
      setDictionaryLoading(false);
      setStatus('ready');
    });
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Forward-declared so startTimer can reference it via ref
  const handleTimeoutRef = useRef<() => void>(() => {});

  const startTimer = useCallback(() => {
    stopTimer();
    setTimeRemaining(TURN_SECONDS);
    timeoutFiredRef.current = false;
    timerRef.current = setInterval(() => {
      setTimeRemaining(t => {
        if (t <= 1) {
          if (!timeoutFiredRef.current) {
            timeoutFiredRef.current = true;
            setTimeout(() => {
              stopTimer();
              handleTimeoutRef.current();
            }, 0);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, [stopTimer]);

  // Restart the chain with a new random word (used in lives mode after losing a life)
  const newChainSegment = useCallback(() => {
    const dict = dictionaryRef.current;
    const startWord = pickStartingWord(dict);
    const entry: ChainEntry = { word: startWord, playedBy: 'start', score: 0, connectionType: '', speedMultiplier: 1 };
    setChain([entry]);
    chainRef.current = [entry];
    setCurrentPlayer(0);
    currentPlayerRef.current = 0;
    setIsComputerThinking(false);
    setLastMoveResult(null);
    startTimer();
  }, [startTimer]);

  // Keep handleTimeoutRef in sync (runs whenever startTimer / newChainSegment change)
  useEffect(() => {
    handleTimeoutRef.current = () => {
      const submode = vsModeRef.current;
      const currentMode = modeRef.current;

      if (currentMode === 'vs-computer' && submode === 'lives') {
        const [pLives, cLives] = livesRef.current;
        const newPLives = pLives - 1;
        const newLives: [number, number] = [newPLives, cLives];
        setLives(newLives);
        livesRef.current = newLives;

        if (newPLives <= 0) {
          setStatus('game-over');
          setGameOverReason('timeout');
        } else {
          newChainSegment();
        }
      } else {
        setStatus('game-over');
        setGameOverReason('timeout');
      }
    };
  }, [newChainSegment]);

  const startGame = useCallback((selectedMode: GameMode, selectedVsSubmode?: VsSubmode, selectedComputerLevel?: ComputerLevel) => {
    const dict = dictionaryRef.current;
    const startWord = pickStartingWord(dict);
    const initialChain: ChainEntry[] = [{ word: startWord, playedBy: 'start', score: 0, connectionType: '', speedMultiplier: 1 }];
    const initialLives: [number, number] = [STARTING_LIVES, STARTING_LIVES];

    setMode(selectedMode);
    modeRef.current = selectedMode;

    const submode = selectedMode === 'vs-computer' ? (selectedVsSubmode ?? null) : null;
    setVsSubmode(submode);
    vsModeRef.current = submode;

    const level = selectedMode === 'vs-computer' ? (selectedComputerLevel ?? null) : null;
    setComputerLevel(level);
    computerLevelRef.current = level;

    setChain(initialChain);
    chainRef.current = initialChain;
    setScores([0, 0]);
    scoresRef.current = [0, 0];
    setCurrentPlayer(0);
    currentPlayerRef.current = 0;
    setGameOverReason(null);
    setLastMoveResult(null);
    setIsComputerThinking(false);
    setLives(initialLives);
    livesRef.current = initialLives;
    setPlayerTurnsLeft(ROUNDS_TOTAL);
    playerTurnsLeftRef.current = ROUNDS_TOTAL;
    setStatus('playing');
    startTimer();
  }, [startTimer]);

  const checkSubmodWin = useCallback((newScores: [number, number], turnsLeft: number): boolean => {
    const submode = vsModeRef.current;
    if (!submode) return false;

    if (submode === 'first-to-x') {
      if (newScores[0] >= FIRST_TO_X_TARGET || newScores[1] >= FIRST_TO_X_TARGET) {
        setScores(newScores);
        scoresRef.current = newScores;
        setStatus('game-over');
        setGameOverReason('target-reached');
        return true;
      }
    }

    if (submode === 'fixed-rounds' && turnsLeft <= 0) {
      setScores(newScores);
      scoresRef.current = newScores;
      setStatus('game-over');
      setGameOverReason('rounds-complete');
      return true;
    }

    return false;
  }, []);

  const doComputerMove = useCallback((
    afterWord: WordEntry,
    afterChain: ChainEntry[],
    afterUsed: Set<string>,
    afterScores: [number, number],
    turnsLeftAfterPlayerMove: number,
  ) => {
    const dict = dictionaryRef.current;
    const move = pickComputerMove(afterWord, dict, afterUsed, computerLevelRef.current);

    if (!move) {
      setIsComputerThinking(false);
      setStatus('game-over');
      setGameOverReason('no-valid-moves');
      return;
    }

    // Computer always "answers" within the grace period — give it a mid-range time
    const computerTimeRemaining = TURN_SECONDS - 2;
    const result = evaluateMove(afterWord, move, afterUsed, computerTimeRemaining, TURN_SECONDS);
    const entry: ChainEntry = {
      word: move, playedBy: 1,
      score: result.totalScore, connectionType: result.connectionType, speedMultiplier: result.speedMultiplier,
    };
    const newChain = [...afterChain, entry];
    const newScores: [number, number] = [afterScores[0], afterScores[1] + result.totalScore];

    setChain(newChain);
    chainRef.current = newChain;
    setIsComputerThinking(false);

    if (checkSubmodWin(newScores, turnsLeftAfterPlayerMove)) return;

    setScores(newScores);
    scoresRef.current = newScores;
    setCurrentPlayer(0);
    currentPlayerRef.current = 0;
    startTimer();
  }, [startTimer, checkSubmodWin]);

  const submitWord = useCallback((simplified: string) => {
    if (status !== 'playing' || isComputerThinking) return;

    const isLivesMode = modeRef.current === 'vs-computer' && vsModeRef.current === 'lives';

    const entry = lookupWord(simplified);
    if (!entry) {
      setLastMoveResult({ valid: false, connectionType: 'invalid', baseScore: 0, lengthBonus: 0, chengyuBonus: 0, speedMultiplier: 1, totalScore: 0 });
      if (isLivesMode) { stopTimer(); handleTimeoutRef.current(); }
      return;
    }

    const prevChain = chainRef.current;
    const prevWord = prevChain[prevChain.length - 1].word;
    const used = usedSet(prevChain);
    const result = evaluateMove(prevWord, entry, used, timeRemaining, TURN_SECONDS);

    setLastMoveResult(result);
    if (!result.valid) {
      if (isLivesMode) { stopTimer(); handleTimeoutRef.current(); }
      return;
    }

    stopTimer();

    const player = currentPlayerRef.current;
    const newEntry: ChainEntry = { word: entry, playedBy: player, score: result.totalScore, connectionType: result.connectionType, speedMultiplier: result.speedMultiplier };
    const newChain = [...prevChain, newEntry];
    const newUsed = new Set([...used, simplified]);
    const newScores: [number, number] = [...scoresRef.current] as [number, number];
    newScores[player] += result.totalScore;

    const currentMode = modeRef.current;

    if (currentMode === 'vs-computer') {
      // Decrement rounds counter for fixed-rounds mode
      const newTurnsLeft = playerTurnsLeftRef.current - 1;
      setPlayerTurnsLeft(newTurnsLeft);
      playerTurnsLeftRef.current = newTurnsLeft;

      // Check if player already hit target (first-to-x) before computer responds
      if (vsModeRef.current === 'first-to-x' && newScores[0] >= FIRST_TO_X_TARGET) {
        setChain(newChain);
        chainRef.current = newChain;
        setScores(newScores);
        scoresRef.current = newScores;
        setStatus('game-over');
        setGameOverReason('target-reached');
        return;
      }

      setChain(newChain);
      chainRef.current = newChain;
      setScores(newScores);
      scoresRef.current = newScores;

      setCurrentPlayer(1);
      currentPlayerRef.current = 1;
      setIsComputerThinking(true);

      setTimeout(() => doComputerMove(entry, newChain, newUsed, newScores, newTurnsLeft), 1200);
    } else if (currentMode === 'pass-and-play') {
      setChain(newChain);
      chainRef.current = newChain;
      setScores(newScores);
      scoresRef.current = newScores;
      const next: 0 | 1 = player === 0 ? 1 : 0;
      setCurrentPlayer(next);
      currentPlayerRef.current = next;
      startTimer();
    } else {
      // solo
      setChain(newChain);
      chainRef.current = newChain;
      setScores(newScores);
      scoresRef.current = newScores;
      startTimer();
    }
  }, [status, isComputerThinking, stopTimer, startTimer, doComputerMove]);

  const resetGame = useCallback(() => {
    stopTimer();
    const empty: ChainEntry[] = [];
    setChain(empty);
    chainRef.current = empty;
    setScores([0, 0]);
    scoresRef.current = [0, 0];
    setCurrentPlayer(0);
    currentPlayerRef.current = 0;
    setTimeRemaining(TURN_SECONDS);
    setGameOverReason(null);
    setLastMoveResult(null);
    setIsComputerThinking(false);
    setLives([STARTING_LIVES, STARTING_LIVES]);
    livesRef.current = [STARTING_LIVES, STARTING_LIVES];
    setPlayerTurnsLeft(ROUNDS_TOTAL);
    playerTurnsLeftRef.current = ROUNDS_TOTAL;
    setComputerLevel(null);
    computerLevelRef.current = null;
    setStatus('ready');
  }, [stopTimer]);

  return {
    dictionaryLoading, status, mode, vsSubmode, computerLevel, chain, scores, currentPlayer,
    timeRemaining, isComputerThinking, gameOverReason, lastMoveResult,
    lives, playerTurnsLeft,
    firstToXTarget: FIRST_TO_X_TARGET,
    roundsTotal: ROUNDS_TOTAL,
    submitWord, startGame, resetGame,
  };
}
