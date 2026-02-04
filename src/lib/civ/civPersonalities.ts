import { CivId, CivGameState, Civilization, CIV_COLORS } from '@/games/civ/types';

export function getSystemPrompt(civId: CivId, state: CivGameState): string {
  const civ = state.civilizations[civId];
  const otherCivs = (['rome', 'egypt', 'mongolia'] as CivId[]).filter(id => id !== civId);

  const personality = PERSONALITY_PROMPTS[civId];

  const worldView = buildWorldView(civId, state);

  return `You are the leader of ${civ.name}, known as ${civ.leaderName}.

${personality}

CURRENT SITUATION (Turn ${state.turn}/${state.maxTurns}):
${worldView}

RULES:
- You can send diplomatic messages to other civilizations or to all
- Messages should be in-character and reflect your personality
- You can propose trades, alliances, declare war, or offer peace
- Be strategic: form alliances against the strongest threat, backstab when advantageous
- Your messages are visible to spectators for entertainment, so be dramatic and interesting
- Keep messages concise (1-3 sentences)`;
}

export function getActionPrompt(civId: CivId, state: CivGameState, diplomacyContext: string): string {
  const civ = state.civilizations[civId];
  const worldView = buildWorldView(civId, state);

  return `You are ${civ.leaderName} of ${civ.name}. Based on the diplomacy phase and current situation, decide your actions for this turn.

${worldView}

RECENT DIPLOMACY:
${diplomacyContext || 'No diplomatic exchanges this turn.'}

Available actions (use the provided tools):
1. move_unit: Move a unit to a new position
2. attack: Attack an adjacent enemy unit
3. found_city: Found a new city with a settler
4. build: Start producing a unit or building in a city

STRATEGIC GUIDELINES:
- Explore with scouts to find resources and enemy positions
- Build warriors/archers for defense and offense
- Expand with settlers when you have enough military to protect them
- Focus production on what you need most: military if threatened, economy if safe
- Consider your diplomatic relationships when deciding who to attack

Return your actions using the provided tools. You may take multiple actions per turn.`;
}

const PERSONALITY_PROMPTS: Record<CivId, string> = {
  rome: `PERSONALITY: You are Caesar Augustus, a cunning and pragmatic ruler. You believe in the glory of Rome and pursue both military dominance and diplomatic alliances. You speak with authority and classical Roman gravitas. You prefer to build alliances before war, but you are ruthless when betrayed. You value order, infrastructure, and the expansion of Roman civilization. Your diplomacy is formal but with underlying steel.`,

  egypt: `PERSONALITY: You are Cleopatra VII, a brilliant and charismatic ruler. You are scientifically minded and trade-focused, preferring to build wealth and knowledge over brute conquest. You use charm and strategic marriage/alliance offers to maintain power. You speak elegantly and with wit. You prefer economic dominance over military conquest, but you can be fierce when cornered. Your diplomacy is sophisticated and sometimes deceptive.`,

  mongolia: `PERSONALITY: You are Genghis Khan, an aggressive and expansionist conqueror. You respect strength and despise weakness. You speak directly and sometimes brutally. You prefer swift military action over prolonged diplomacy, though you may offer vassalage before war. You value loyalty above all and punish betrayal severely. Your diplomacy is blunt and threatening, but you can be surprisingly fair to those who submit.`,
};

function buildWorldView(civId: CivId, state: CivGameState): string {
  const civ = state.civilizations[civId];
  const lines: string[] = [];

  // Own stats
  lines.push(`YOUR CIVILIZATION: ${civ.name}`);
  lines.push(`Gold: ${civ.gold}`);
  lines.push(`Cities (${civ.cities.length}):`);
  for (const cityId of civ.cities) {
    const city = state.cities[cityId];
    if (!city) continue;
    lines.push(`  - ${city.name} (pop ${city.population}, +${city.goldPerTurn}g/t, +${city.productionPerTurn}p/t, buildings: ${city.buildings.join(', ') || 'none'}${city.currentProduction ? `, building: ${city.currentProduction.target} (${city.currentProduction.progress}/${city.currentProduction.cost})` : ''})`);
  }

  lines.push(`Units (${civ.units.length}):`);
  for (const unitId of civ.units) {
    const unit = state.units[unitId];
    if (!unit) continue;
    lines.push(`  - ${unit.type} [${unit.id}] at (${unit.x},${unit.y}) HP:${unit.hp}/${unit.maxHp} Moves:${unit.movementLeft}/${unit.movement}`);
  }

  // Other civs (visible info only)
  const otherCivs = (['rome', 'egypt', 'mongolia'] as CivId[]).filter(id => id !== civId);
  const knownSet = new Set(civ.knownTiles);

  for (const otherId of otherCivs) {
    const other = state.civilizations[otherId];
    if (!other.isAlive) {
      lines.push(`\n${other.name}: ELIMINATED`);
      continue;
    }

    const rel = civ.relationships[otherId];
    lines.push(`\n${other.name} (${other.leaderName}) - Relationship: ${rel}`);

    // Show visible cities
    const visibleCities = other.cities
      .map(id => state.cities[id])
      .filter(c => c && knownSet.has(`${c.x},${c.y}`));
    if (visibleCities.length > 0) {
      lines.push(`  Known cities: ${visibleCities.map(c => `${c!.name} at (${c!.x},${c!.y})`).join(', ')}`);
    }

    // Show visible units
    const visibleUnits = other.units
      .map(id => state.units[id])
      .filter(u => u && knownSet.has(`${u.x},${u.y}`));
    if (visibleUnits.length > 0) {
      lines.push(`  Visible units: ${visibleUnits.map(u => `${u!.type} at (${u!.x},${u!.y})`).join(', ')}`);
    }
  }

  return lines.join('\n');
}

export function getNarratorPrompt(turnEvents: string[], state: CivGameState): string {
  return `You are a dramatic narrator for a civilization game between Rome (Caesar Augustus), Egypt (Cleopatra VII), and Mongolia (Genghis Khan).

Turn ${state.turn}/${state.maxTurns} just completed. Here's what happened:

${turnEvents.join('\n')}

DIPLOMACY THIS TURN:
${state.diplomacyLog
    .filter(m => m.turn === state.turn)
    .map(m => `${CIV_COLORS[m.from]?.label ?? m.from} to ${m.to === 'all' ? 'all' : (CIV_COLORS[m.to as CivId]?.label ?? m.to)}: "${m.content}"`)
    .join('\n') || 'No diplomatic exchanges.'}

SCORES: ${(['rome', 'egypt', 'mongolia'] as CivId[]).map(id => `${CIV_COLORS[id].label}: ${state.civilizations[id].score}`).join(', ')}

Write a dramatic, concise narration (2-3 sentences) describing the most important events of this turn. Be entertaining and build tension. Write in the style of a historical documentary narrator. Focus on the most dramatic events: wars, betrayals, new cities, or shifting alliances.`;
}
