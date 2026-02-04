import { NextRequest, NextResponse } from 'next/server';
import { getGame } from '@/server/gameStore';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gameId = `game_${id}`;
  const state = getGame(gameId);

  if (!state) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  return NextResponse.json(state);
}
