'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

function randomRoomId() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function OnlineSection() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [expanded, setExpanded] = useState(false);

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
    <div>
      <button
        onClick={() => setExpanded(v => !v)}
        className="group w-full flex items-center gap-4 p-5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500 rounded-2xl transition-all text-left"
      >
        <span className="text-3xl">🌐</span>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-lg">Play Online</span>
            <span className="text-slate-500 text-sm">联机对战</span>
          </div>
          <p className="text-slate-400 text-sm mt-0.5">Challenge a friend on another device in real time.</p>
        </div>
        <span className={`text-slate-400 text-lg transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>→</span>
      </button>

      {expanded && (
        <div className="mt-2 ml-4 flex flex-col gap-3">
          <button
            onClick={createRoom}
            className="flex items-center gap-4 p-4 bg-slate-800/60 hover:bg-slate-700 border border-slate-700/60 hover:border-emerald-500 rounded-xl transition-all text-left"
          >
            <span className="text-2xl">➕</span>
            <div>
              <div className="font-semibold text-white">Create Room</div>
              <p className="text-slate-400 text-xs mt-0.5">Get a 4-letter code to share with your friend.</p>
            </div>
          </button>

          <form onSubmit={joinRoom} className="flex gap-2 p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl">
            <span className="text-2xl self-center">🔗</span>
            <input
              type="text"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4))}
              placeholder="Room code"
              maxLength={4}
              className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono uppercase tracking-widest text-center"
            />
            <button
              type="submit"
              disabled={joinCode.length !== 4}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors text-sm"
            >
              Join
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

const VS_SUBMODES = [
  {
    id: 'first-to-x',
    emoji: '🏆',
    title: 'First to 50',
    titleZh: '先得50分',
    desc: 'Race to 50 points. Score a point-scoring word before the computer does.',
  },
  {
    id: 'fixed-rounds',
    emoji: '🎯',
    title: '10 Rounds',
    titleZh: '10回合',
    desc: 'Each player gets 10 turns. Highest score when time runs out wins.',
  },
  {
    id: 'lives',
    emoji: '❤️',
    title: '3 Lives',
    titleZh: '三条命',
    desc: 'You have 3 lives. Each timeout costs one. The computer plays on after yours run out.',
  },
];

const OTHER_MODES = [
  {
    id: 'solo',
    emoji: '🧘',
    title: 'Solo Practice',
    titleZh: '单人练习',
    desc: 'Build the longest chain you can, alone. No opponent — just you and the clock.',
  },
  {
    id: 'pass-and-play',
    emoji: '🤝',
    title: 'Pass & Play',
    titleZh: '双人对战',
    desc: 'Two players on the same device take turns. Most points when the chain breaks wins.',
  },
];

const RULES = [
  { label: 'Exact character', example: '中国 → 国家', points: '+10' },
  { label: 'Same sound', example: '历史 → 世界', points: '+8' },
  { label: 'Similar final, related initial', example: '爬山 → 三文治', points: '+6' },
  { label: 'Same initial, similar final', example: '山 → 上班', points: '+5' },
  { label: 'Related sound', example: '亡 → 环境', points: '+3' },
  { label: 'Musical rhyme (ui↔ei)', example: '机会 → 危险', points: '+2' },
];

const COMPUTER_LEVELS = [
  { value: null,  label: 'All words',     labelZh: '全部词汇',   desc: 'No restriction — computer uses the full dictionary.' },
  { value: 3,     label: 'HSK 1–3',       labelZh: '初级',       desc: 'Beginner vocabulary only. Great for learners.' },
  { value: 4,     label: 'HSK 1–4',       labelZh: '中级',       desc: 'Elementary to intermediate vocabulary.' },
  { value: 5,     label: 'HSK 1–5',       labelZh: '高级',       desc: 'Up to advanced vocabulary.' },
  { value: 6,     label: 'HSK 1–6',       labelZh: '精通',       desc: 'Full HSK range — no untagged obscure words.' },
] as const;

export default function Home() {
  const [vsExpanded, setVsExpanded] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);

  return (
    <main className="min-h-screen bg-slate-900 text-white flex flex-col items-center px-4 py-12">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-6xl font-bold tracking-wide mb-2">词语接龙</h1>
          <p className="text-slate-400 text-lg">Mandarin Word Chain</p>
        </div>

        {/* Mode cards */}
        <div className="flex flex-col gap-3 mb-10">
          {/* Online multiplayer */}
          <OnlineSection />

          {/* vs Computer — expandable */}
          <div>
            <button
              onClick={() => setVsExpanded(v => !v)}
              className="group w-full flex items-center gap-4 p-5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500 rounded-2xl transition-all text-left"
            >
              <span className="text-3xl">🤖</span>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-lg">vs Computer</span>
                  <span className="text-slate-500 text-sm">人机对战</span>
                </div>
                <p className="text-slate-400 text-sm mt-0.5">Choose a win condition to challenge the computer.</p>
              </div>
              <span className={`text-slate-400 text-lg transition-transform duration-200 ${vsExpanded ? 'rotate-90' : ''}`}>
                →
              </span>
            </button>

            {vsExpanded && (
              <div className="mt-2 ml-4 flex flex-col gap-3">
                {/* Computer difficulty picker */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Computer vocabulary</p>
                  <div className="flex flex-wrap gap-2">
                    {COMPUTER_LEVELS.map(cl => (
                      <button
                        key={String(cl.value)}
                        onClick={() => setSelectedLevel(cl.value)}
                        title={cl.desc}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          selectedLevel === cl.value
                            ? 'bg-violet-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {cl.label}
                        <span className="ml-1.5 text-xs opacity-60">{cl.labelZh}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    {COMPUTER_LEVELS.find(cl => cl.value === selectedLevel)?.desc}
                  </p>
                </div>

                {/* Submode cards */}
                {VS_SUBMODES.map(s => (
                  <Link
                    key={s.id}
                    href={`/game?mode=vs-computer&submode=${s.id}${selectedLevel != null ? `&level=${selectedLevel}` : ''}`}
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

          {/* Other modes */}
          {OTHER_MODES.map(m => (
            <Link
              key={m.id}
              href={`/game?mode=${m.id}`}
              className="group flex items-center gap-4 p-5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500 rounded-2xl transition-all"
            >
              <span className="text-3xl">{m.emoji}</span>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-lg">{m.title}</span>
                  <span className="text-slate-500 text-sm">{m.titleZh}</span>
                </div>
                <p className="text-slate-400 text-sm mt-0.5">{m.desc}</p>
              </div>
              <span className="text-slate-600 group-hover:text-emerald-400 transition-colors text-xl">→</span>
            </Link>
          ))}
        </div>

        {/* Scoring reference */}
        <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Scoring</h2>
          <div className="flex flex-col gap-2">
            {RULES.map(r => (
              <div key={r.label} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-white">{r.label}</span>
                  <span className="text-slate-500 font-mono text-xs">{r.example}</span>
                </div>
                <span className="text-emerald-400 font-semibold font-mono">{r.points}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-700 text-xs text-slate-500 space-y-1">
            <p>Length bonus: 3-char +2 · 4-char +4 · 5+ char +6</p>
            <p>Chengyu bonus: +5 if the word is a 四字成语</p>
            <p>Finals must be compatible — initials are checked second.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
