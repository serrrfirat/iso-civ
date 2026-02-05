import { NextRequest, NextResponse } from 'next/server';
import { createGame } from '@/server/gameStore';
import { MAP_SIZES, MapSizeKey } from '@/lib/civ/mapGenerator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const seed = body.seed ?? Math.floor(Math.random() * 1000000);
    const maxTurns = body.maxTurns ?? 20;

    // Parse mapSize from request body, default to 'medium' (30)
    const mapSizeKey: MapSizeKey = body.mapSize && body.mapSize in MAP_SIZES ? body.mapSize : 'medium';
    const mapSize = MAP_SIZES[mapSizeKey];

    const state = createGame(seed, maxTurns, mapSize);

    return NextResponse.json({
      id: state.id,
      turn: state.turn,
      maxTurns: state.maxTurns,
      gridSize: state.gridSize,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create game' }, { status: 500 });
  }
}
