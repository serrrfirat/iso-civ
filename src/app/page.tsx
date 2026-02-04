'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [seed, setSeed] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleNewGame = useCallback(() => {
    const gameSeed = seed ? parseInt(seed, 10) || hashString(seed) : Math.floor(Math.random() * 1000000);
    router.push(`/game/${gameSeed}`);
  }, [seed, router]);

  const handleWatchDemo = useCallback(() => {
    router.push('/game/42');
  }, [router]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-900 to-slate-950 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full flex flex-col items-center text-center space-y-12">
        {/* Title */}
        <div>
          <h1 className="text-7xl font-light tracking-wider text-white/90 mb-2">
            AGENT CIV
          </h1>
          <p className="text-lg text-gray-400 font-light tracking-wide">
            Three AI civilizations. Natural language diplomacy. You spectate.
          </p>
        </div>

        {/* Civilization preview */}
        <div className="grid grid-cols-3 gap-6 w-full max-w-lg">
          <CivCard
            name="Rome"
            leader="Caesar Augustus"
            trait="Militaristic"
            color="#DC2626"
          />
          <CivCard
            name="Egypt"
            leader="Cleopatra VII"
            trait="Scientific"
            color="#D97706"
          />
          <CivCard
            name="Mongolia"
            leader="Genghis Khan"
            trait="Aggressive"
            color="#2563EB"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button
            onClick={handleNewGame}
            className="w-full py-4 text-xl font-light tracking-wide bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all duration-300"
          >
            New Game
          </button>

          <button
            onClick={handleWatchDemo}
            className="w-full py-4 text-xl font-light tracking-wide bg-white/10 hover:bg-white/20 text-white/80 border border-white/20 rounded-lg transition-all duration-300"
          >
            Watch Demo
          </button>

          {/* Seed input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={seed}
              onChange={e => setSeed(e.target.value)}
              placeholder="Custom seed (optional)"
              className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white/70 text-sm placeholder-white/30 focus:outline-none focus:border-white/30"
            />
          </div>
        </div>

        {/* Info */}
        <div className="text-sm text-gray-500 max-w-md">
          <p>
            Watch three Claude-powered civilizations compete on an isometric map.
            They negotiate alliances, declare wars, and betray each other — all in natural language.
          </p>
          <p className="mt-2 text-gray-600">
            20 turns. 3 civilizations. 1 winner.
          </p>
        </div>
      </div>
    </main>
  );
}

function CivCard({ name, leader, trait, color }: { name: string; leader: string; trait: string; color: string }) {
  return (
    <div className="p-4 bg-white/5 border border-white/10 rounded-lg text-center" style={{ borderTopColor: color, borderTopWidth: '2px' }}>
      <div className="w-8 h-8 rounded-full mx-auto mb-2" style={{ backgroundColor: color }} />
      <div className="text-white font-medium text-sm">{name}</div>
      <div className="text-gray-400 text-xs mt-1">{leader}</div>
      <div className="text-gray-500 text-[10px] mt-1 tracking-wider uppercase">{trait}</div>
    </div>
  );
}

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
