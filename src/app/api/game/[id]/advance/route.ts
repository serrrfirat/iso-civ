import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getGame, createGame, updateGame } from '@/server/gameStore';
import { advanceTurn, advanceTurnLocal } from '@/lib/civ/turnManager';

const execFileAsync = promisify(execFile);

// Check once at startup whether `claude` CLI is available
let claudeAvailable: boolean | null = null;

async function isClaudeAvailable(): Promise<boolean> {
  if (claudeAvailable !== null) return claudeAvailable;

  const candidates = [
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
    '/usr/bin/claude',
  ];

  for (const p of candidates) {
    try {
      await execFileAsync(p, ['--version'], { timeout: 5000 });
      claudeAvailable = true;
      console.log(`[agent-civ] claude CLI found at ${p}`);
      return true;
    } catch {}
  }

  // Try resolving via shell
  try {
    const { stdout } = await execFileAsync('/bin/sh', ['-c', 'which claude'], { timeout: 5000 });
    if (stdout.trim()) {
      claudeAvailable = true;
      console.log(`[agent-civ] claude CLI found at ${stdout.trim()}`);
      return true;
    }
  } catch {}

  claudeAvailable = false;
  console.log('[agent-civ] claude CLI not found, using local simulation');
  return false;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Try to get or create game
  let state = getGame(`game_${id}`) ?? getGame(id);

  if (!state) {
    const seed = parseInt(id, 10) || hashString(id);
    state = createGame(seed);
  }

  if (state.winner) {
    return NextResponse.json(state);
  }

  // Use AI agents if `claude` CLI is available (uses OAuth, no API key needed)
  const useAI = await isClaudeAvailable();

  try {
    if (useAI) {
      state = await advanceTurn(state, Date.now(), (s, event) => {
        updateGame(s, event);
      });
    } else {
      state = advanceTurnLocal(state, Date.now());
    }

    updateGame(state);
    return NextResponse.json(state);
  } catch (error) {
    console.error('Turn advance error:', error);
    // Fall back to local simulation
    state = advanceTurnLocal(state, Date.now());
    updateGame(state);
    return NextResponse.json(state);
  }
}

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
