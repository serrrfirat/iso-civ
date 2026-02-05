'use client';

import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import { CivGameProvider } from '@/context/CivGameContext';
import { SpectatorView } from '@/components/spectator/SpectatorView';
import { createInitialGameState, MAP_SIZES, MapSizeKey } from '@/lib/civ/mapGenerator';

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();

  // Parse seed from id (e.g., "test" -> hash, or numeric seed)
  const seed = id === 'test' ? 42 : parseInt(id, 10) || hashString(id);

  // Parse mapSize from query params, default to 'medium'
  const mapSizeParam = searchParams.get('mapSize') as MapSizeKey | null;
  const mapSizeKey: MapSizeKey = mapSizeParam && mapSizeParam in MAP_SIZES ? mapSizeParam : 'medium';
  const mapSize = MAP_SIZES[mapSizeKey];

  const initialState = createInitialGameState(seed, mapSize);

  return (
    <CivGameProvider initialState={initialState}>
      <div className="h-screen w-screen bg-gray-950 flex flex-col">
        <SpectatorView />
      </div>
    </CivGameProvider>
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
