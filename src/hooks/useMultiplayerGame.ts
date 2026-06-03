'use client';

import { useState, useEffect, useCallback } from 'react';
import usePartySocket from 'partysocket/react';

export interface Syllable {
  initial: string;
  final: string;
  tone: number | null;
}

export interface WordEntry {
  simplified: string;
  pinyin: string;
  english: string;
  firstChar: string;
  lastChar: string;
  firstSyllable: Syllable;
  lastSyllable: Syllable;
  wordLength: number;
  isChengyu: boolean;
  hskLevel: number | null;
}

export interface ChainEntry {
  word: WordEntry;
  playedBy: string;
  playerIndex: number;
  score: number;
  connectionType: string;
  speedMultiplier: number;
}

export interface PlayerInfo {
  id: string;
  index: number;
  name: string;
  score: number;
}

export type RoomStatus = 'waiting' | 'playing' | 'game-over';

export interface RoomState {
  status: RoomStatus;
  hostId: string | null;
  players: PlayerInfo[];
  chain: ChainEntry[];
  currentPlayerIndex: number;
  timeRemaining: number;
  gameOverReason: string | null;
  lastMoveError: string | null;
}

type ServerMsg =
  | { type: 'state'; state: RoomState }
  | { type: 'error'; message: string };

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? 'mandarin-word-chain.ore411.partykit.dev';

export function useMultiplayerGame(roomId: string, playerName: string) {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  const ws = usePartySocket({
    host: PARTYKIT_HOST,
    room: roomId,
    onMessage(e: MessageEvent) {
      const msg = JSON.parse(e.data as string) as ServerMsg;
      if (msg.type === 'state') {
        setRoomState(msg.state);
        setServerError(null);
      } else if (msg.type === 'error') {
        setServerError(msg.message);
      }
    },
  });

  useEffect(() => {
    if (!ws || joined) return;
    const id = (ws as unknown as { id: string }).id;
    if (!id) return;
    setMyId(id);
    ws.send(JSON.stringify({ type: 'join', name: playerName }));
    setJoined(true);
  }, [ws, playerName, joined]);

  const submitWord = useCallback((word: string) => {
    ws?.send(JSON.stringify({ type: 'play', word }));
  }, [ws]);

  const startGame = useCallback(() => {
    ws?.send(JSON.stringify({ type: 'start' }));
  }, [ws]);

  const myIndex: number | null = roomState?.players.find(p => p.id === myId)?.index ?? null;
  const isMyTurn = myIndex !== null && roomState?.currentPlayerIndex === myIndex;
  const isHost = myId !== null && roomState?.hostId === myId;

  return { roomState, myId, myIndex, isMyTurn, isHost, serverError, submitWord, startGame };
}
