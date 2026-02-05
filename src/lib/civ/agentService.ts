import { spawn } from 'child_process';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { CivId, CivGameState, DiplomacyMessage, AgentAction } from '@/games/civ/types';
import { getSystemPrompt, getActionPrompt, getNarratorPrompt } from './civPersonalities';
import { ruleset } from './ruleset';

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

function getActionsFormat(civId: CivId, state: CivGameState): string {
  const civ = state.civilizations[civId];
  const availableUnits = ruleset.getAvailableUnits(civ.researchedTechs);
  const availableBuildings = Object.keys(ruleset.buildings).filter(id => {
    const b = ruleset.buildings[id];
    return !b.isCapital && (!b.techReq || civ.researchedTechs.includes(b.techReq));
  });
  const researchable = ruleset.getResearchableTechs(civ.researchedTechs);

  // Build improvements info
  const improvementInfo = Object.entries(ruleset.improvements)
    .map(([id, imp]) => `${id} (valid on: ${imp.validTerrain.join('/')}, ${imp.turnsToComplete} turns, +${Object.entries(imp.effects).map(([k, v]) => `${v} ${k}`).join(', ')})`)
    .join('; ');

  // Build upgradeable units info
  const upgradeableUnits: string[] = [];
  for (const unitId of civ.units) {
    const unit = state.units[unitId];
    if (!unit) continue;
    const unitDef = ruleset.getUnit(unit.type);
    if (!unitDef || !unitDef.obsoleteBy || unitDef.upgradeCost === null) continue;
    const upgradedUnitDef = ruleset.getUnit(unitDef.obsoleteBy);
    if (!upgradedUnitDef) continue;
    // Check if civ has required tech for the upgraded unit
    if (upgradedUnitDef.techReq && !civ.researchedTechs.includes(upgradedUnitDef.techReq)) continue;
    // Check if civ has enough gold
    if (civ.gold >= unitDef.upgradeCost) {
      upgradeableUnits.push(`${unitId} (${unit.type} -> ${unitDef.obsoleteBy}, cost: ${unitDef.upgradeCost}g)`);
    }
  }

  const upgradeInfo = upgradeableUnits.length > 0
    ? `\nUpgradeable units: ${upgradeableUnits.join(', ')}`
    : '';

  // Build ranged units info
  const rangedUnitsInfo: string[] = [];
  for (const unitId of civ.units) {
    const unit = state.units[unitId];
    if (!unit) continue;
    const unitDef = ruleset.getUnit(unit.type);
    if (unitDef && unitDef.range) {
      rangedUnitsInfo.push(`${unitId} (${unit.type}, range: ${unitDef.range})`);
    }
  }
  const rangedInfo = rangedUnitsInfo.length > 0
    ? `\nRanged units (use ranged_attack for targets within range, no counter-damage): ${rangedUnitsInfo.join(', ')}`
    : '';

  // Build available governments info
  const availableGovs = ruleset.getAvailableGovernments(civ.researchedTechs);
  const currentGov = civ.government;
  const governmentInfo = availableGovs
    .filter(g => g !== currentGov)
    .map(g => {
      const gov = ruleset.getGovernment(g);
      return `${g} (${gov?.description || ''})`;
    })
    .join('; ');

  const governmentSection = governmentInfo
    ? `\nGovernment change (causes 5 turns of anarchy with no production): current=${currentGov}, can change to: ${governmentInfo}. Change government when the long-term benefits outweigh the 5-turn production loss - best during peacetime with stable economy.`
    : '';

  // Build great person abilities info
  const greatPersonsInfo: string[] = [];
  for (const unitId of civ.units) {
    const unit = state.units[unitId];
    if (!unit || !unit.isGreatPerson) continue;

    // Map great person types to their abilities
    const abilityMap: Record<string, { ability: string; description: string }> = {
      'great_scientist': { ability: 'instant_research', description: 'complete current research instantly (requires active research)' },
      'great_artist': { ability: 'golden_age', description: 'trigger 8 turns of Golden Age (+50% production and gold)' },
      'great_general': { ability: 'combat_bonus', description: 'give all units +10% combat strength for 10 turns' },
      'great_merchant': { ability: 'gold_bonus', description: 'gain 500 gold instantly' },
      'great_engineer': { ability: 'rush_production', description: 'complete current production in a city (requires active production)' },
    };

    const info = abilityMap[unit.type];
    if (info) {
      greatPersonsInfo.push(`${unitId} (${unit.type}, ability: ${info.ability} - ${info.description})`);
    }
  }
  const greatPersonsSection = greatPersonsInfo.length > 0
    ? `\nGreat Persons (expend to use ability): ${greatPersonsInfo.join('; ')}`
    : '';

  return `

Respond with ONLY a JSON object in this exact format (no markdown, no code blocks, no explanation):
{"actions":[
  {"type":"move_unit","unitId":"u1","targetX":5,"targetY":6},
  {"type":"attack","unitId":"u1","targetId":"u2"},
  {"type":"ranged_attack","unitId":"u1","targetId":"u2"},
  {"type":"found_city","settlerId":"u3","cityName":"New City"},
  {"type":"build","cityId":"c1","target":"warrior","targetType":"unit"},
  {"type":"build_improvement","workerId":"u5","improvement":"farm"},
  {"type":"set_research","techId":"archery"},
  {"type":"fortify","unitId":"u1"},
  {"type":"upgrade_unit","unitId":"u1"},
  {"type":"change_government","government":"republic"},
  {"type":"expend_great_person","unitId":"gp500","ability":"instant_research"}
]}

Only include actions you want to take.
Valid unit build targets: ${availableUnits.join(', ')}
Valid building build targets: ${availableBuildings.join(', ')}
Valid improvements (for workers): ${improvementInfo}
Valid research targets: ${researchable.map(t => t.id).join(', ') || 'none available'}${upgradeInfo}${rangedInfo}${governmentSection}${greatPersonsSection}`;
}

export async function runPlanningPhase(civId: CivId, state: CivGameState, diplomacyContext: string): Promise<AgentAction[]> {
  const actionsFormat = getActionsFormat(civId, state);
  const prompt = getActionPrompt(civId, state, diplomacyContext) + actionsFormat;
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
        case 'ranged_attack':
          actions.push({ type: 'ranged_attack', unitId: a.unitId as string, targetX: a.targetX as number, targetY: a.targetY as number });
          break;
        case 'found_city':
          actions.push({ type: 'found_city', settlerId: a.settlerId as string, cityName: a.cityName as string });
          break;
        case 'build':
          actions.push({ type: 'build', cityId: a.cityId as string, target: a.target as string, targetType: a.targetType as 'unit' | 'building' });
          break;
        case 'build_improvement':
          actions.push({ type: 'build_improvement', workerId: a.workerId as string, improvement: a.improvement as 'farm' | 'mine' | 'road' });
          break;
        case 'set_research':
          actions.push({ type: 'set_research', techId: a.techId as string });
          break;
        case 'fortify':
          actions.push({ type: 'fortify', unitId: a.unitId as string });
          break;
        case 'upgrade_unit':
          actions.push({ type: 'upgrade_unit', unitId: a.unitId as string, targetType: a.targetType as string });
          break;
        case 'change_government':
          actions.push({ type: 'change_government', government: a.government as 'despotism' | 'monarchy' | 'republic' | 'democracy' | 'communism' });
          break;
        case 'expend_great_person':
          actions.push({ type: 'expend_great_person', unitId: a.unitId as string, ability: a.ability as 'instant_research' | 'golden_age' | 'combat_bonus' | 'gold_bonus' | 'rush_production' });
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

  // Check against ruleset civilizations
  for (const [id, civDef] of Object.entries(ruleset.civilizations)) {
    if (lower === id) return id;
    if (lower.includes(id)) return id;
    if (civDef.leader && lower.includes(civDef.leader.toLowerCase())) return id;
    if (civDef.name && lower.includes(civDef.name.toLowerCase())) return id;
  }

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
