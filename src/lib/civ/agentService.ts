import { spawn } from 'child_process';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { CivId, CivGameState, DiplomacyMessage, AgentAction } from '@/games/civ/types';
import { getSystemPrompt, getActionPrompt, getNarratorPrompt } from './civPersonalities';

const execFileAsync = promisify(execFile);

// ============================================================================
// Claude Code CLI runner
// ============================================================================

let claudePath: string | null = null;

async function getClaudePath(): Promise<string> {
  if (claudePath) return claudePath;

  const candidates = [
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
    '/usr/bin/claude',
  ];

  for (const p of candidates) {
    try {
      await execFileAsync(p, ['--version'], { timeout: 5000 });
      claudePath = p;
      return p;
    } catch {}
  }

  try {
    const { stdout } = await execFileAsync('/bin/sh', ['-c', 'which claude'], { timeout: 5000 });
    const resolved = stdout.trim();
    if (resolved) { claudePath = resolved; return resolved; }
  } catch {}

  throw new Error('claude CLI not found');
}

const MODEL = 'claude-sonnet-4-20250514';
const TIMEOUT = 120_000;

function runClaude(prompt: string, systemPrompt?: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const bin = await getClaudePath();

    const args = ['-p', prompt, '--output-format', 'json', '--max-turns', '1', '--model', MODEL];
    if (systemPrompt) {
      args.push('--system-prompt', systemPrompt);
    }

    console.log(`[agent-civ] calling claude (${prompt.length} chars)...`);
    const start = Date.now();

    const proc = spawn(bin, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1', TERM: 'dumb' },
    });

    // Close stdin immediately so claude doesn't wait for input
    proc.stdin.end();

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`claude timed out after ${TIMEOUT / 1000}s`));
    }, TIMEOUT);

    proc.on('close', (code) => {
      clearTimeout(timer);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`[agent-civ] claude responded in ${elapsed}s (code ${code})`);

      if (code === 0 && stdout.trim()) {
        try {
          const parsed = JSON.parse(stdout.trim());
          resolve(parsed.result ?? '');
        } catch {
          resolve(stdout.trim());
        }
      } else {
        reject(new Error(`claude exited with code ${code}: ${stderr.slice(0, 200)}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });
  });
}

// ============================================================================
// Diplomacy phase
// ============================================================================

let nextMsgId = 1;

const DIPLOMACY_FORMAT = `

Respond with ONLY a JSON object in this exact format (no markdown, no code blocks, no explanation):
{"messages":[{"to":"<civId or all>","message_type":"<message|trade_proposal|alliance_proposal|war_declaration|peace_offer>","content":"<your message>"}]}

If you have nothing to say, return: {"messages":[]}`;

export async function runDiplomacyPhase(civId: CivId, state: CivGameState, inbox: DiplomacyMessage[]): Promise<DiplomacyMessage[]> {
  const systemPrompt = getSystemPrompt(civId, state);

  const inboxText = inbox.length > 0
    ? `Messages received this turn:\n${inbox.map(m => `From ${m.from}: [${m.type}] ${m.content}`).join('\n')}`
    : 'No messages received yet this turn.';

  const userPrompt = `${inboxText}\n\nSend your diplomatic messages for this turn (0-3 messages). Be strategic and in-character.${DIPLOMACY_FORMAT}`;

  try {
    const raw = await runClaude(userPrompt, systemPrompt);
    const jsonStr = extractJson(raw);
    const output = JSON.parse(jsonStr) as { messages: Array<{ to: string; message_type: string; content: string }> };

    const messages: DiplomacyMessage[] = [];
    for (const msg of output.messages || []) {
      const to = normalizeCivId(msg.to);
      if (!to || to === civId) continue;

      messages.push({
        id: `msg_${nextMsgId++}`,
        turn: state.turn,
        from: civId,
        to,
        type: (msg.message_type || 'message') as DiplomacyMessage['type'],
        content: msg.content,
      });
    }

    return messages;
  } catch (error) {
    console.error(`Diplomacy error for ${civId}:`, error);
    return [];
  }
}

// ============================================================================
// Planning phase
// ============================================================================

const ACTIONS_FORMAT = `

Respond with ONLY a JSON object in this exact format (no markdown, no code blocks, no explanation):
{"actions":[
  {"type":"move_unit","unitId":"u1","targetX":5,"targetY":6},
  {"type":"attack","unitId":"u1","targetId":"u2"},
  {"type":"found_city","settlerId":"u3","cityName":"New City"},
  {"type":"build","cityId":"c1","target":"warrior","targetType":"unit"}
]}

Only include actions you want to take. Valid build targets: warrior, archer, scout, settler, granary, barracks, walls, market, library.`;

export async function runPlanningPhase(civId: CivId, state: CivGameState, diplomacyContext: string): Promise<AgentAction[]> {
  const prompt = getActionPrompt(civId, state, diplomacyContext) + ACTIONS_FORMAT;
  const systemPrompt = `You are the AI controlling ${state.civilizations[civId].name}. Make strategic decisions. Return ONLY valid JSON, no markdown.`;

  try {
    const raw = await runClaude(prompt, systemPrompt);
    const jsonStr = extractJson(raw);
    const output = JSON.parse(jsonStr) as { actions: Array<Record<string, unknown>> };

    const actions: AgentAction[] = [];
    for (const a of output.actions || []) {
      switch (a.type) {
        case 'move_unit':
          actions.push({ type: 'move_unit', unitId: a.unitId as string, targetX: a.targetX as number, targetY: a.targetY as number });
          break;
        case 'attack':
          actions.push({ type: 'attack', unitId: a.unitId as string, targetId: a.targetId as string });
          break;
        case 'found_city':
          actions.push({ type: 'found_city', settlerId: a.settlerId as string, cityName: a.cityName as string });
          break;
        case 'build':
          actions.push({ type: 'build', cityId: a.cityId as string, target: a.target as string, targetType: a.targetType as 'unit' | 'building' });
          break;
      }
    }

    return actions;
  } catch (error) {
    console.error(`Planning error for ${civId}:`, error);
    return [];
  }
}

// ============================================================================
// Narrator
// ============================================================================

export async function generateNarration(turnEvents: string[], state: CivGameState): Promise<string> {
  const prompt = getNarratorPrompt(turnEvents, state) + '\n\nRespond with ONLY a JSON object: {"narration":"<your 2-3 sentence narration>"}';

  try {
    const raw = await runClaude(prompt);
    const jsonStr = extractJson(raw);
    const output = JSON.parse(jsonStr) as { narration: string };
    return output.narration || 'The world turns in silence.';
  } catch (error) {
    console.error('Narrator error:', error);
    return 'The world turns in silence.';
  }
}

// ============================================================================
// Helpers
// ============================================================================

/** Normalize a civ identifier — agents may return full names instead of IDs */
function normalizeCivId(raw: string): CivId | 'all' | null {
  const lower = raw.toLowerCase().trim();
  if (lower === 'all') return 'all';
  if (lower === 'rome' || lower.includes('roman') || lower.includes('rome') || lower.includes('caesar') || lower.includes('augustus')) return 'rome';
  if (lower === 'egypt' || lower.includes('egypt') || lower.includes('cleopatra') || lower.includes('kingdom of egypt')) return 'egypt';
  if (lower === 'mongolia' || lower.includes('mongol') || lower.includes('genghis') || lower.includes('khan')) return 'mongolia';
  // Check if it's already a valid CivId
  if (['rome', 'egypt', 'mongolia'].includes(lower)) return lower as CivId;
  return null;
}

/** Extract JSON from a response that may have markdown code fences or surrounding text */
function extractJson(raw: string): string {
  // Try as-is first
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) return trimmed;

  // Extract from markdown code block
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  // Find first { to last }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}
