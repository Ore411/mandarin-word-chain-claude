import type * as Party from 'partykit/server';

// ── Types ────────────────────────────────────────────────────────────────────

interface Syllable {
  initial: string;
  final: string;
  tone: number | null;
}

interface WordEntry {
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

interface ChainEntry {
  word: WordEntry;
  playedBy: string; // connection id or 'start'
  playerIndex: number;
  score: number;
  connectionType: string;
  speedMultiplier: number;
}

type RoomStatus = 'waiting' | 'playing' | 'game-over';

export interface PlayerInfo {
  id: string;       // current connection id (changes on reconnect)
  clientId: string; // stable id from localStorage (survives reconnect)
  index: number;
  name: string;
  score: number;
  connected: boolean;
  timeouts: number;    // 0–3
  eliminated: boolean; // true when timeouts >= MAX_TIMEOUTS
}

export interface RoomState {
  status: RoomStatus;
  hostId: string | null;
  players: PlayerInfo[];
  chain: ChainEntry[];
  currentPlayerIndex: number;
  turnSeconds: number;
  timeRemaining: number;
  gameOverReason: string | null;
  lastMoveError: string | null;
}

// ── Message types ────────────────────────────────────────────────────────────

type ServerMsg =
  | { type: 'state'; state: RoomState }
  | { type: 'error'; message: string };

type ClientMsg =
  | { type: 'join'; name: string; clientId: string }
  | { type: 'start'; turnSeconds: number }
  | { type: 'rematch' }
  | { type: 'play'; word: string };

// ── Game logic ───────────────────────────────────────────────────────────────

type ConnectionType =
  | 'exactChar' | 'exactInitialExactFinal' | 'familyInitialExactFinal'
  | 'exactInitialStrongFinal' | 'familyInitialStrongFinal' | 'weakMusicalFinal'
  | 'invalid';

const BASE_SCORES: Record<ConnectionType, number> = {
  exactChar: 10, exactInitialExactFinal: 8, familyInitialExactFinal: 6,
  exactInitialStrongFinal: 5, familyInitialStrongFinal: 3, weakMusicalFinal: 2, invalid: 0,
};

const INITIAL_FAMILIES: Record<string, string> = {
  zh: 'retroflex', ch: 'retroflex', sh: 'retroflex', r: 'retroflex',
  z: 'sibilant', c: 'sibilant', s: 'sibilant',
  j: 'palatal', q: 'palatal', x: 'palatal', y: 'palatal',
  g: 'velar', k: 'velar', h: 'velar', w: 'velar',
  d: 'dental', t: 'dental', n: 'dental', l: 'dental',
  b: 'lip', p: 'lip', m: 'lip', f: 'lip',
  '': 'none',
};

const STRONG_SIMILAR_SET = new Set<string>([
  'an|ang', 'ang|an', 'en|eng', 'eng|en', 'in|ing', 'ing|in',
  'ian|iang', 'iang|ian', 'uan|uang', 'uang|uan',
]);
const WEAK_MUSICAL_SET = new Set<string>(['ui|ei', 'ei|ui']);

function initialsCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  const fa = INITIAL_FAMILIES[a] ?? 'none';
  const fb = INITIAL_FAMILIES[b] ?? 'none';
  return fa !== 'none' && fb !== 'none' && fa === fb;
}

function finalsRelation(a: string, b: string): 'exact' | 'strongSimilar' | 'weakMusical' | 'invalid' {
  if (a === b) return 'exact';
  if (STRONG_SIMILAR_SET.has(`${a}|${b}`)) return 'strongSimilar';
  if (WEAK_MUSICAL_SET.has(`${a}|${b}`)) return 'weakMusical';
  return 'invalid';
}

function classifyConnection(prev: WordEntry, next: WordEntry): ConnectionType {
  if (prev.lastChar === next.firstChar) return 'exactChar';
  const ps = prev.lastSyllable;
  const ns = next.firstSyllable;
  const finalRel = finalsRelation(ps.final, ns.final);
  if (finalRel === 'invalid') return 'invalid';
  const exactInitial = ps.initial === ns.initial;
  const familyInitial = !exactInitial && initialsCompatible(ps.initial, ns.initial);
  if (!exactInitial && !familyInitial) return 'invalid';
  if (finalRel === 'weakMusical') return 'weakMusicalFinal';
  if (finalRel === 'exact') return exactInitial ? 'exactInitialExactFinal' : 'familyInitialExactFinal';
  return exactInitial ? 'exactInitialStrongFinal' : 'familyInitialStrongFinal';
}

function lengthBonus(n: number): number {
  if (n === 2) return 0; if (n === 3) return 2; if (n === 4) return 4; return 6;
}

function speedMultiplier(timeRemaining: number, turnSeconds: number): number {
  const gracePeriod = 5;
  if (timeRemaining >= turnSeconds - gracePeriod) return 2.0;
  return Math.round((0.1 + (timeRemaining / (turnSeconds - gracePeriod)) * 1.9) * 10) / 10;
}

function hasValidMoves(prev: WordEntry, dict: WordEntry[], usedWords: Set<string>): boolean {
  return dict.some(e => !usedWords.has(e.simplified) && classifyConnection(prev, e) !== 'invalid');
}

// ── Pinyin parser ────────────────────────────────────────────────────────────

const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l',
  'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'];

function parseSyllable(raw: string): Syllable {
  const toneMap: Record<string, number> = {
    'ā': 1, 'á': 2, 'ǎ': 3, 'à': 4, 'ē': 1, 'é': 2, 'ě': 3, 'è': 4,
    'ī': 1, 'í': 2, 'ǐ': 3, 'ì': 4, 'ō': 1, 'ó': 2, 'ǒ': 3, 'ò': 4,
    'ū': 1, 'ú': 2, 'ǔ': 3, 'ù': 4,
  };
  let tone: number | null = null;
  for (const ch of raw) { if (toneMap[ch]) { tone = toneMap[ch]; break; } }
  const toneDigit = raw.match(/([1-5])$/)?.[1];
  if (!tone && toneDigit) tone = parseInt(toneDigit);

  const cleaned = raw
    .replace(/[āáǎà]/g, 'a').replace(/[ēéěè]/g, 'e').replace(/[īíǐì]/g, 'i')
    .replace(/[ōóǒò]/g, 'o').replace(/[ūúǔù]/g, 'u').replace(/[ǖǘǚǜü]/g, 'v')
    .replace(/[1-5]$/, '');

  let initial = '';
  let remaining = cleaned;
  for (const ini of INITIALS) {
    if (cleaned.startsWith(ini)) { initial = ini; remaining = cleaned.slice(ini.length); break; }
  }
  return { initial, final: remaining, tone };
}

// ── Dictionary ───────────────────────────────────────────────────────────────

let cachedDict: WordEntry[] | null = null;

async function getDictionary(): Promise<WordEntry[]> {
  if (cachedDict) return cachedDict;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mandarin-word-chain-claude.vercel.app';
  const res = await fetch(`${baseUrl}/api/dictionary`);
  if (!res.ok) throw new Error('Failed to load dictionary');
  cachedDict = await res.json() as WordEntry[];
  return cachedDict;
}

function lookupWord(simplified: string, dict: WordEntry[]): WordEntry | null {
  return dict.find(e => e.simplified === simplified) ?? null;
}

function dailySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function pickStartingWord(dict: WordEntry[]): WordEntry {
  // Prefer HSK 1-3 two-character words; same word each day via date seed
  const pool = dict.filter(e => e.wordLength === 2 && e.hskLevel !== null && e.hskLevel <= 3);
  const source = pool.length > 0 ? pool : dict.filter(e => e.wordLength === 2);
  const idx = Math.floor(seededRandom(dailySeed()) * source.length);
  return source[idx];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TURN_SECONDS = 30;
const MAX_PLAYERS = 10;
const MAX_TIMEOUTS = 3;
const TIMEOUT_PENALTY = 5;

// ── Party Server ──────────────────────────────────────────────────────────────

export default class GameRoom implements Party.Server {
  private state: RoomState = {
    status: 'waiting',
    hostId: null,
    players: [],
    chain: [],
    currentPlayerIndex: 0,
    turnSeconds: TURN_SECONDS,
    timeRemaining: TURN_SECONDS,
    gameOverReason: null,
    lastMoveError: null,
  };

  private dict: WordEntry[] = [];
  private usedWords = new Set<string>();
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  constructor(readonly room: Party.Room) {}

  async onStart() {
    try { this.dict = await getDictionary(); } catch (e) { console.error('Dict load failed:', e); }
    const saved = await this.room.storage.get<RoomState>('state');
    if (saved) this.state = saved;
    const savedUsed = await this.room.storage.get<string[]>('usedWords');
    if (savedUsed) this.usedWords = new Set(savedUsed);
  }

  async onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({ type: 'state', state: this.state } satisfies ServerMsg));
  }

  async onMessage(raw: string, sender: Party.Connection) {
    if (!this.dict.length) {
      try { this.dict = await getDictionary(); } catch { /* retry next message */ }
    }
    let msg: ClientMsg;
    try { msg = JSON.parse(raw) as ClientMsg; } catch { return; }

    if (msg.type === 'join') await this.handleJoin(sender, msg.name, msg.clientId);
    else if (msg.type === 'start') await this.handleStart(sender, msg.turnSeconds);
    else if (msg.type === 'rematch') await this.handleRematch(sender);
    else if (msg.type === 'play') await this.handlePlay(sender, msg.word);
  }

  async onClose(conn: Party.Connection) {
    const player = this.state.players.find(p => p.id === conn.id);
    if (!player) return;

    if (this.state.status === 'playing') {
      // Mark offline but keep in game — timer will handle their turn naturally
      player.connected = false;
      this.broadcast();
      await this.saveState();
    } else if (this.state.status === 'waiting') {
      this.state.players = this.state.players.filter(p => p.id !== conn.id);
      this.state.players.forEach((p, i) => { p.index = i; });
      if (this.state.hostId === conn.id) {
        this.state.hostId = this.state.players[0]?.id ?? null;
      }
      this.broadcast();
      await this.saveState();
    }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  private async handleJoin(conn: Party.Connection, name: string, clientId: string) {
    // Reconnect: player already exists with this clientId
    const existing = this.state.players.find(p => p.clientId === clientId);
    if (existing) {
      existing.id = conn.id;
      existing.connected = true;
      // Restore host mapping if they were the host
      if (this.state.hostId === existing.id || !this.state.hostId) {
        this.state.hostId = conn.id;
      }
      conn.send(JSON.stringify({ type: 'state', state: this.state } satisfies ServerMsg));
      this.broadcast();
      await this.saveState();
      return;
    }

    if (this.state.status !== 'waiting') {
      conn.send(JSON.stringify({ type: 'error', message: 'Game already in progress' } satisfies ServerMsg));
      return;
    }
    if (this.state.players.length >= MAX_PLAYERS) {
      conn.send(JSON.stringify({ type: 'error', message: 'Room is full (max 10 players)' } satisfies ServerMsg));
      return;
    }

    const index = this.state.players.length;
    const trimmedName = name.trim() || `Player ${index + 1}`;
    this.state.players.push({ id: conn.id, clientId, index, name: trimmedName, score: 0, connected: true, timeouts: 0, eliminated: false });

    if (!this.state.hostId) this.state.hostId = conn.id;

    this.broadcast();
    await this.saveState();
  }

  private async handleStart(conn: Party.Connection, turnSeconds: number) {
    if (this.state.status !== 'waiting') return;
    if (this.state.hostId !== conn.id) {
      conn.send(JSON.stringify({ type: 'error', message: 'Only the host can start the game' } satisfies ServerMsg));
      return;
    }
    if (this.state.players.length < 2) {
      conn.send(JSON.stringify({ type: 'error', message: 'Need at least 2 players to start' } satisfies ServerMsg));
      return;
    }
    const validSeconds = [30, 60].includes(turnSeconds) ? turnSeconds : TURN_SECONDS;
    await this.startGame(validSeconds);
  }

  private async handleRematch(conn: Party.Connection) {
    if (this.state.status !== 'game-over') return;
    if (this.state.hostId !== conn.id) {
      conn.send(JSON.stringify({ type: 'error', message: 'Only the host can start a rematch' } satisfies ServerMsg));
      return;
    }
    this.stopTimer();
    this.usedWords = new Set();
    this.state.status = 'waiting';
    this.state.chain = [];
    this.state.gameOverReason = null;
    this.state.lastMoveError = null;
    this.state.currentPlayerIndex = 0;
    this.state.players.forEach(p => {
      p.score = 0;
      p.timeouts = 0;
      p.eliminated = false;
    });
    this.broadcast();
    await this.saveState();
  }

  private async handlePlay(conn: Party.Connection, simplified: string) {
    if (this.state.status !== 'playing') return;

    const player = this.state.players.find(p => p.id === conn.id);
    if (!player) return;
    if (player.index !== this.state.currentPlayerIndex) {
      conn.send(JSON.stringify({ type: 'error', message: 'Not your turn' } satisfies ServerMsg));
      return;
    }

    const entry = lookupWord(simplified, this.dict);
    if (!entry) {
      this.state.lastMoveError = 'Word not found in dictionary';
      this.broadcast();
      return;
    }
    if (this.usedWords.has(simplified)) {
      this.state.lastMoveError = 'Word already used';
      this.broadcast();
      return;
    }

    const prevWord = this.state.chain[this.state.chain.length - 1].word;
    const connType = classifyConnection(prevWord, entry);
    if (connType === 'invalid') {
      this.state.lastMoveError = 'Invalid connection';
      this.broadcast();
      return;
    }

    this.stopTimer();
    this.state.lastMoveError = null;
    player.connected = true;

    const base = BASE_SCORES[connType];
    const lb = lengthBonus(entry.wordLength);
    const cb = entry.isChengyu ? 5 : 0;
    const mult = speedMultiplier(this.state.timeRemaining, this.state.turnSeconds);
    const score = Math.round((base + lb + cb) * mult);

    this.state.chain.push({
      word: entry, playedBy: conn.id, playerIndex: player.index,
      score, connectionType: connType, speedMultiplier: mult,
    });
    this.usedWords.add(simplified);
    this.state.players[player.index].score += score;

    // Check if the chain is now stuck (no valid moves from this new word)
    if (!hasValidMoves(entry, this.dict, this.usedWords)) {
      this.state.status = 'game-over';
      this.state.gameOverReason = 'No valid moves left — chain complete!';
      this.broadcast();
      await this.saveState();
      return;
    }

    this.advanceToNextPlayer();
    this.broadcast();
    await this.saveState();
    this.startTimer();
  }

  // ── Game flow ──────────────────────────────────────────────────────────────

  private async startGame(turnSeconds: number = TURN_SECONDS) {
    const startWord = pickStartingWord(this.dict);
    this.usedWords = new Set([startWord.simplified]);

    const firstPlayer = Math.floor(Math.random() * this.state.players.length);
    this.state.status = 'playing';
    this.state.turnSeconds = turnSeconds;
    this.state.chain = [{
      word: startWord, playedBy: 'start', playerIndex: firstPlayer,
      score: 0, connectionType: '', speedMultiplier: 1,
    }];
    this.state.currentPlayerIndex = firstPlayer;
    this.state.timeRemaining = turnSeconds;
    this.state.gameOverReason = null;
    this.state.lastMoveError = null;
    this.state.players.forEach(p => { p.score = 0; p.timeouts = 0; p.eliminated = false; });

    this.broadcast();
    await this.saveState();
    this.startTimer();
  }

  private startTimer() {
    this.stopTimer();
    this.state.timeRemaining = this.state.turnSeconds;
    this.timerInterval = setInterval(async () => {
      this.state.timeRemaining -= 1;
      this.broadcast();
      if (this.state.timeRemaining <= 0) {
        this.stopTimer();
        await this.handleTurnTimeout();
      }
    }, 1000);
  }

  private async handleTurnTimeout() {
    const player = this.state.players[this.state.currentPlayerIndex];
    player.score -= TIMEOUT_PENALTY;
    player.timeouts += 1;

    if (player.timeouts >= MAX_TIMEOUTS) {
      player.eliminated = true;
      const active = this.state.players.filter(p => !p.eliminated);
      if (active.length < 2) {
        this.state.status = 'game-over';
        this.state.gameOverReason =
          active.length === 1 ? `${active[0].name} is the last player standing!` : 'All players eliminated';
        this.broadcast();
        await this.saveState();
        return;
      }
    }

    this.advanceToNextPlayer();
    this.broadcast();
    await this.saveState();
    this.startTimer();
  }

  private advanceToNextPlayer() {
    const total = this.state.players.length;
    let next = (this.state.currentPlayerIndex + 1) % total;
    for (let i = 0; i < total; i++) {
      if (!this.state.players[next].eliminated) break;
      next = (next + 1) % total;
    }
    this.state.currentPlayerIndex = next;
  }

  private stopTimer() {
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
  }

  private broadcast() {
    this.room.broadcast(JSON.stringify({ type: 'state', state: this.state } satisfies ServerMsg));
  }

  private async saveState() {
    await this.room.storage.put('state', this.state);
    await this.room.storage.put('usedWords', [...this.usedWords]);
  }
}

GameRoom satisfies Party.Worker;
