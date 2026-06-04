'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

function randomRoomId() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ── Example chain shown on the landing page ───────────────────────────────────

const EXAMPLE_CHAIN = [
  { word: '中国', pinyin: 'zhōng guó', meaning: 'China', link: 'exact character 国' },
  { word: '国家', pinyin: 'guó jiā',   meaning: 'country / nation', link: 'exact character 家' },
  { word: '家人', pinyin: 'jiā rén',   meaning: 'family members', link: 'exact character 人' },
  { word: '人口', pinyin: 'rén kǒu',   meaning: 'population', link: null },
];

function ExampleChain() {
  return (
    <div className="flex flex-col gap-0">
      {EXAMPLE_CHAIN.map((item, i) => (
        <div key={item.word}>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center w-16 shrink-0">
              <span className="text-3xl font-bold text-white">{item.word}</span>
              <span className="text-emerald-400 text-xs font-mono mt-0.5">{item.pinyin}</span>
            </div>
            <div className="flex-1">
              <span className="text-slate-300 text-sm">{item.meaning}</span>
            </div>
          </div>
          {item.link && (
            <div className="flex items-center gap-2 ml-5 my-1">
              <div className="w-px h-4 bg-emerald-700 ml-5" />
              <span className="text-emerald-600 text-xs font-mono">↳ {item.link}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── How to play section ───────────────────────────────────────────────────────

function HowToPlay() {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="font-semibold text-white">How to play</span>
        <span className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>→</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-slate-700">
          {/* Core concept */}
          <div className="pt-4">
            <p className="text-slate-300 text-sm leading-relaxed mb-3">
              Each word must connect to the previous one — either by sharing the <strong className="text-white">same last character</strong>, or a <strong className="text-white">similar sound</strong>. The faster you answer, the higher your score multiplier (up to <span className="text-emerald-400 font-mono font-bold">2.0×</span>).
            </p>
          </div>

          {/* Example chain */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Example chain</p>
            <ExampleChain />
          </div>

          {/* Scoring */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Connection types</p>
            <div className="flex flex-col gap-1.5">
              {[
                { label: 'Exact character',           example: '中国 → 国家',  points: '+10', color: 'text-emerald-400' },
                { label: 'Same sound (tone-free)',    example: '历史 → 世界',  points: '+8',  color: 'text-sky-400' },
                { label: 'Same final, related initial', example: '爬山 → 三文治', points: '+6', color: 'text-sky-300' },
                { label: 'Same initial, similar final', example: '山 shān → 上 shàng', points: '+5', color: 'text-violet-400' },
                { label: 'Related sound family',      example: '亡 → 环境',   points: '+3',  color: 'text-violet-300' },
                { label: 'Musical rhyme (ui ↔ ei)',   example: '机会 → 危险', points: '+2',  color: 'text-amber-400' },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between text-sm gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`shrink-0 text-xs font-bold font-mono w-7 text-right ${r.color}`}>{r.points}</span>
                    <span className="text-slate-300 text-xs">{r.label}</span>
                  </div>
                  <span className="text-slate-600 font-mono text-xs shrink-0">{r.example}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-700/60 text-xs text-slate-500 space-y-1">
              <p>Length bonus: 3-char <span className="text-slate-400">+2</span> · 4-char <span className="text-slate-400">+4</span> · 5+ char <span className="text-slate-400">+6</span></p>
              <p>Chengyu bonus: <span className="text-slate-400">+5</span> for 四字成语</p>
              <p>3 timeouts = eliminated · each timeout = <span className="text-red-400">−5 pts</span></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Play Online section ───────────────────────────────────────────────────────

function PlayOnline() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);

  function createRoom() {
    router.push(`/room/${randomRoomId()}`);
  }

  function joinRoom(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toLowerCase();
    if (code.length !== 4) return;
    router.push(`/room/${code}`);
  }

  return (
    <div className="bg-slate-800 border-2 border-emerald-700 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🌐</span>
          <h2 className="text-xl font-bold text-white">Play Online</h2>
          <span className="text-slate-500 text-sm">联机对战</span>
        </div>
        <p className="text-slate-400 text-sm">Challenge friends on different devices in real time — up to 10 players.</p>
      </div>

      <div className="border-t border-slate-700 px-5 py-4 flex flex-col gap-4">

        {/* Create room */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Start a new game</p>
          <button
            onClick={createRoom}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-lg transition-colors"
          >
            <span>➕</span> Create Room
          </button>
          {/* How it works steps */}
          <ol className="mt-3 flex flex-col gap-1.5">
            {[
              'You get a 4-letter room code',
              'Share the code or page link with friends',
              'They enter the code and join your room',
              'You start the game when everyone is in',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-500">
                <span className="shrink-0 w-4 h-4 rounded-full bg-slate-700 text-slate-400 flex items-center justify-center font-bold text-xs mt-0.5">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-700" />
          <span className="text-slate-600 text-xs">or join with a code</span>
          <div className="flex-1 h-px bg-slate-700" />
        </div>

        {/* Join room */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Join an existing room</p>
          <form onSubmit={joinRoom} className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4))}
              placeholder="XXXX"
              maxLength={4}
              className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono uppercase tracking-[0.3em] text-center"
            />
            <button
              type="submit"
              disabled={joinCode.length !== 4}
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors"
            >
              Join →
            </button>
          </form>
          <p className="text-xs text-slate-600 mt-1.5">Enter the 4-letter code your friend shared with you</p>
        </div>
      </div>
    </div>
  );
}

// ── Shared time picker ────────────────────────────────────────────────────────

const TIME_OPTIONS = [
  { value: 15, label: '15 sec' },
  { value: 30, label: '30 sec' },
  { value: 60, label: '1 min'  },
] as const;

function TimePicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Time per turn</p>
      <div className="flex gap-2">
        {TIME_OPTIONS.map(t => (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              value === t.value ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── VS Computer section ───────────────────────────────────────────────────────

const VS_SUBMODES = [
  { id: 'first-to-x',   emoji: '🏆', title: 'First to 50',  titleZh: '先得50分', desc: 'Race to 50 points.' },
  { id: 'fixed-rounds', emoji: '🎯', title: '10 Rounds',    titleZh: '10回合',   desc: 'Each player takes 10 turns.' },
  { id: 'lives',        emoji: '❤️', title: '3 Lives',      titleZh: '三条命',   desc: '3 timeouts = you lose.' },
];

const COMPUTER_LEVELS = [
  { value: null, label: 'All words', labelZh: '全部词汇', desc: 'Full dictionary.' },
  { value: 3,    label: 'HSK 1–3',  labelZh: '初级',     desc: 'Beginner vocabulary.' },
  { value: 4,    label: 'HSK 1–4',  labelZh: '中级',     desc: 'Intermediate.' },
  { value: 5,    label: 'HSK 1–5',  labelZh: '高级',     desc: 'Advanced.' },
  { value: 6,    label: 'HSK 1–6',  labelZh: '精通',     desc: 'Full HSK range.' },
] as const;

function VsComputer() {
  const [expanded, setExpanded] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState(30);
  const [selectedChainMode, setSelectedChainMode] = useState<'learner' | 'advanced'>('learner');

  return (
    <div>
      <button
        onClick={() => setExpanded(v => !v)}
        className="group w-full flex items-center gap-4 p-5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500 rounded-2xl transition-all text-left"
      >
        <span className="text-3xl">🤖</span>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-lg">vs Computer</span>
            <span className="text-slate-500 text-sm">人机对战</span>
          </div>
          <p className="text-slate-400 text-sm mt-0.5">Play solo against an AI opponent.</p>
        </div>
        <span className={`text-slate-400 text-lg transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>→</span>
      </button>

      {expanded && (
        <div className="mt-2 ml-4 flex flex-col gap-3">
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 flex flex-col gap-4">
            <TimePicker value={selectedTime} onChange={setSelectedTime} />

            {/* Chain mode */}
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Chain mode</p>
              <div className="flex gap-2">
                {(['learner', 'advanced'] as const).map(m => (
                  <button key={m} onClick={() => setSelectedChainMode(m)}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedChainMode === m ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {m === 'learner' ? '🎓 Learner' : '⚡ Advanced'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {selectedChainMode === 'advanced' ? 'Exact character only — no phonetic matches' : 'Phonetic matches also accepted'}
              </p>
            </div>

            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Computer vocabulary</p>
            <div className="flex flex-wrap gap-2">
              {COMPUTER_LEVELS.map(cl => (
                <button
                  key={String(cl.value)}
                  onClick={() => setSelectedLevel(cl.value)}
                  title={cl.desc}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedLevel === cl.value ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {cl.label}
                  <span className="ml-1.5 text-xs opacity-60">{cl.labelZh}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">{COMPUTER_LEVELS.find(cl => cl.value === selectedLevel)?.desc}</p>
          </div>
          {VS_SUBMODES.map(s => (
            <Link
              key={s.id}
              href={`/game?mode=vs-computer&submode=${s.id}${selectedLevel != null ? `&level=${selectedLevel}` : ''}&time=${selectedTime}&chainMode=${selectedChainMode}`}
              className="group flex items-center gap-4 p-4 bg-slate-800/60 hover:bg-slate-700 border border-slate-700/60 hover:border-emerald-500 rounded-xl transition-all"
            >
              <span className="text-2xl">{s.emoji}</span>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold">{s.title}</span>
                  <span className="text-slate-500 text-xs">{s.titleZh}</span>
                </div>
                <p className="text-slate-400 text-xs mt-0.5">{s.desc}</p>
              </div>
              <span className="text-slate-600 group-hover:text-emerald-400 transition-colors">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Solo Practice section ─────────────────────────────────────────────────────

function SoloMode() {
  return (
    <Link
      href="/game?mode=solo"
      className="group flex items-center gap-4 p-5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500 rounded-2xl transition-all"
    >
      <span className="text-3xl">🧘</span>
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-lg">Solo Practice</span>
          <span className="text-slate-500 text-sm">单人练习</span>
        </div>
        <p className="text-slate-400 text-sm mt-0.5">Build the longest chain you can. No opponent, no pressure.</p>
      </div>
      <span className="text-slate-600 group-hover:text-emerald-400 transition-colors text-xl">→</span>
    </Link>
  );
}

// ── Pass & Play section ───────────────────────────────────────────────────────

function PassAndPlay() {
  const [expanded, setExpanded] = useState(false);
  const [selectedTime, setSelectedTime] = useState(30);
  const [selectedChainMode, setSelectedChainMode] = useState<'learner' | 'advanced'>('learner');
  return (
    <div>
      <button
        onClick={() => setExpanded(v => !v)}
        className="group w-full flex items-center gap-4 p-5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500 rounded-2xl transition-all text-left"
      >
        <span className="text-3xl">🤝</span>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-lg">Pass & Play</span>
            <span className="text-slate-500 text-sm">双人对战</span>
          </div>
          <p className="text-slate-400 text-sm mt-0.5">Two players on the same device. Pass the phone each turn.</p>
        </div>
        <span className={`text-slate-400 text-lg transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>→</span>
      </button>
      {expanded && (
        <div className="mt-2 ml-4">
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 flex flex-col gap-4">
            <TimePicker value={selectedTime} onChange={setSelectedTime} />

            {/* Chain mode */}
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Chain mode</p>
              <div className="flex gap-2">
                {(['learner', 'advanced'] as const).map(m => (
                  <button key={m} onClick={() => setSelectedChainMode(m)}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedChainMode === m ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {m === 'learner' ? '🎓 Learner' : '⚡ Advanced'}
                  </button>
                ))}
              </div>
            </div>

            <Link
              href={`/game?mode=pass-and-play&time=${selectedTime}&chainMode=${selectedChainMode}`}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-center transition-colors"
            >
              Start
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Home page ─────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-900 text-white flex flex-col items-center px-4 py-10">
      <div className="max-w-lg w-full flex flex-col gap-5">

        {/* Header */}
        <div className="text-center mb-2">
          <h1 className="text-6xl font-bold tracking-wide mb-2">词语接龙</h1>
          <p className="text-slate-300 text-lg font-medium">Chinese Word Chain</p>
          <p className="text-slate-500 text-sm mt-1">Chain Chinese words by sound or shared characters</p>
        </div>

        {/* Primary CTA: Play Online */}
        <PlayOnline />

        {/* How to play */}
        <HowToPlay />

        {/* Secondary modes */}
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-600 uppercase tracking-wider px-1">Other modes</p>

          <VsComputer />

          <SoloMode />
          <PassAndPlay />
        </div>

      </div>
    </main>
  );
}
