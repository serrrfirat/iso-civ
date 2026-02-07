import { CivGameState, CivId, DiplomacyMessage, CivTurnSummary, CulturalArtifact, CulturalArtifactType } from '@/games/civ/types';
import { runDiplomacyPhase, runPlanningPhase, generateNarration, runCulturalSummarization } from './agentService';
import { validateAction, executeAction, processEndOfTurn, addTurnEvent } from './civSimulation';
import { ruleset } from './ruleset';

export type TurnCallback = (state: CivGameState, event: string) => void;

export async function advanceTurn(state: CivGameState, seed: number, onUpdate?: TurnCallback): Promise<CivGameState> {
  if (state.winner) return state;

  // Clear camera events from previous turn
  state.cameraEvents = [];

  const allEvents: string[] = [];
  const civIds = Object.keys(state.civilizations);
  const aliveCivs = civIds.filter(id => state.civilizations[id].isAlive);

  // -- Phase 1: Diplomacy (sequential to avoid CLI contention) --
  state.phase = 'diplomacy';
  onUpdate?.(state, 'diplomacy_start');

  const allDiplomacyMessages: DiplomacyMessage[] = [];

  // Single round: each civ sends messages one at a time
  for (const civId of aliveCivs) {
    // Show messages from earlier civs this turn as inbox
    const inbox = allDiplomacyMessages.filter(m => m.to === civId || m.to === 'all');
    const messages = await runDiplomacyPhase(civId, state, inbox);
    allDiplomacyMessages.push(...messages);
    state.diplomacyLog.push(...messages);
  }

  const diplomacyContext = allDiplomacyMessages
    .map(m => `${m.from} -> ${m.to}: [${m.type}] ${m.content}`)
    .join('\n');

  onUpdate?.(state, 'diplomacy_complete');

  // -- Phase 2: Planning (sequential) --
  state.phase = 'planning';
  onUpdate?.(state, 'planning_start');

  const actionResults: Array<{ civId: CivId; actions: import('@/games/civ/types').AgentAction[] }> = [];

  for (const civId of aliveCivs) {
    const result = await runPlanningPhase(civId, state, diplomacyContext);
    actionResults.push({ civId, actions: result.actions });

    // Process cultural artifacts
    const civ = state.civilizations[civId];
    if (civ.culture) {
      // Set constitution/religion name on first turn
      if (state.turn === 1) {
        if (result.constitutionName) civ.culture.constitutionName = result.constitutionName;
        if (result.religionName) civ.culture.religionName = result.religionName;
      }

      // Process each artifact
      for (const artifact of result.artifacts) {
        const artifactId = `art_${civId}_${state.turn}_${civ.culture.artifacts.length}`;
        const culturalArtifact: CulturalArtifact = {
          id: artifactId,
          civId,
          turn: state.turn,
          type: artifact.type as CulturalArtifactType,
          title: artifact.title,
          content: artifact.content,
          isActive: true,
        };
        civ.culture.artifacts.push(culturalArtifact);
        state.culturalEvents.push(culturalArtifact);
        addTurnEvent(state, 'culture', `${civ.name} created ${artifact.type}: "${artifact.title}"`, civId);
      }
    }
  }

  onUpdate?.(state, 'planning_complete');

  // -- Phase 3: Resolution --
  state.phase = 'resolution';
  onUpdate?.(state, 'resolution_start');

  // Build per-civ turn summaries for action replay
  state.civTurnSummaries = [];

  for (const { civId, actions } of actionResults) {
    const eventsBefore = state.turnEvents.length;

    for (const action of actions) {
      if (validateAction(state, action, civId)) {
        const events = executeAction(state, action, civId, seed);
        allEvents.push(...events);
      }
    }

    const eventsAfter = state.turnEvents.length;
    const civEvents = state.turnEvents.slice(eventsBefore, eventsAfter);
    const civDiplomacy = allDiplomacyMessages.filter(m => m.from === civId);

    state.civTurnSummaries.push({
      civId,
      turn: state.turn,
      diplomacyMessages: civDiplomacy,
      resolvedEvents: civEvents,
    });
  }

  const eotEvents = processEndOfTurn(state);
  allEvents.push(...eotEvents);

  onUpdate?.(state, 'resolution_complete');

  // Cultural summarization every 5 turns
  if (state.turn % 5 === 0) {
    const summarizationPromises = aliveCivs
      .filter(civId => state.civilizations[civId].culture?.artifacts.length > 0)
      .map(async (civId) => {
        const summary = await runCulturalSummarization(civId, state);
        if (summary) {
          state.civilizations[civId].culture.summary = summary;
        }
      });
    await Promise.all(summarizationPromises);
  }

  // -- Phase 4: Narration --
  state.phase = 'narration';
  onUpdate?.(state, 'narration_start');

  const narration = await generateNarration(allEvents, state);
  state.currentNarration = narration;

  onUpdate?.(state, 'narration_complete');

  // Advance turn counter
  state.turn++;
  state.phase = 'idle';
  onUpdate?.(state, 'turn_complete');

  return state;
}

// Fallback: advance turn without AI (for testing / when CLI not available)
export function advanceTurnLocal(state: CivGameState, seed: number): CivGameState {
  if (state.winner) return state;

  // Clear camera events from previous turn
  state.cameraEvents = [];

  state.phase = 'resolution';
  const civIds = Object.keys(state.civilizations);

  for (const civId of civIds) {
    const civ = state.civilizations[civId];
    if (!civ.isAlive) continue;

    // Auto-build in idle cities
    for (const cityId of civ.cities) {
      const city = state.cities[cityId];
      if (city && !city.currentProduction) {
        const action = { type: 'build' as const, cityId, target: 'warrior', targetType: 'unit' as const };
        if (validateAction(state, action, civId)) {
          executeAction(state, action, civId, seed);
        }
      }
    }

    // Move scouts randomly
    for (const unitId of civ.units) {
      const unit = state.units[unitId];
      if (!unit || unit.type !== 'scout' || unit.movementLeft <= 0) continue;

      const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
      const dir = dirs[Math.floor(Math.abs(Math.sin(seed + parseInt(unitId.slice(1)) + state.turn)) * dirs.length)];
      const tx = unit.x + dir.dx;
      const ty = unit.y + dir.dy;

      if (tx >= 0 && tx < state.gridSize && ty >= 0 && ty < state.gridSize) {
        const action = { type: 'move_unit' as const, unitId, targetX: tx, targetY: ty };
        if (validateAction(state, action, civId)) {
          executeAction(state, action, civId, seed);
        }
      }
    }
  }

  processEndOfTurn(state);
  state.currentNarration = `Turn ${state.turn} passes. The civilizations continue to grow in the ancient world.`;
  state.turn++;
  state.phase = 'idle';

  return state;
}
