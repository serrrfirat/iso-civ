import { NextRequest, NextResponse } from 'next/server';
import { createGame } from '@/server/gameStore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const seed = body.seed ?? Math.floor(Math.random() * 1000000);
    const maxTurns = body.maxTurns ?? 20;

    const state = createGame(seed, maxTurns);

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
