'use client';

import { useEffect, useRef } from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { CivGameState, DiplomacyMessage } from '@/games/civ/types';
import { EventAnnouncementData } from '@/components/spectator/EventAnnouncement';

/**
 * Hook that watches game state changes and triggers dramatic announcements
 * for major events like war declarations, city foundations, victories, etc.
 */
export function useEventAnnouncements() {
  const { state, showAnnouncement } = useCivGame();

  // Track previous state to detect changes
  const prevStateRef = useRef<{
    turn: number;
    diplomacyLogLength: number;
    cityCount: number;
    winner: string | null;
    goldenAges: Record<string, number>;
    researchedTechs: Record<string, number>;
  }>({
    turn: 0,
    diplomacyLogLength: 0,
    cityCount: 0,
    winner: null,
    goldenAges: {},
    researchedTechs: {},
  });

  useEffect(() => {
    const prev = prevStateRef.current;

    // Skip if this is the initial render or state hasn't meaningfully changed
    if (prev.turn === 0 && state.turn <= 1) {
      // Initialize tracking
      prevStateRef.current = {
        turn: state.turn,
        diplomacyLogLength: state.diplomacyLog.length,
        cityCount: Object.keys(state.cities).length,
        winner: state.winner,
        goldenAges: Object.fromEntries(
          Object.entries(state.civilizations).map(([id, civ]) => [id, civ.goldenAgesCompleted])
        ),
        researchedTechs: Object.fromEntries(
          Object.entries(state.civilizations).map(([id, civ]) => [id, civ.researchedTechs.length])
        ),
      };
      return;
    }

    // Check for victory
    if (state.winner && state.winner !== prev.winner) {
      const winnerCiv = state.civilizations[state.winner];
      if (winnerCiv) {
        const victoryTypeLabel = state.victoryType === 'conquest'
          ? 'Conquest Victory'
          : state.victoryType === 'science'
          ? 'Science Victory'
          : 'Score Victory';

        showAnnouncement({
          type: 'victory',
          title: `${winnerCiv.name} WINS!`,
          subtitle: victoryTypeLabel,
          civId: state.winner,
        });
      }
    }

    // Check for war declarations (new diplomacy messages)
    if (state.diplomacyLog.length > prev.diplomacyLogLength) {
      const newMessages = state.diplomacyLog.slice(prev.diplomacyLogLength);
      for (const msg of newMessages) {
        if (msg.type === 'war_declaration') {
          const fromCiv = state.civilizations[msg.from];
          const toCiv = msg.to !== 'all' ? state.civilizations[msg.to] : null;

          if (fromCiv && toCiv) {
            showAnnouncement({
              type: 'war_declared',
              title: 'WAR!',
              subtitle: `${fromCiv.name} vs ${toCiv.name}`,
              civId: msg.from,
              secondaryCivId: msg.to !== 'all' ? msg.to : undefined,
            });
            break; // Only show one war announcement at a time
          }
        }
      }
    }

    // Check for new cities founded
    const currentCityCount = Object.keys(state.cities).length;
    if (currentCityCount > prev.cityCount) {
      // Find the newly founded city (cities with turn === current turn)
      const newCities = Object.values(state.cities).filter(city => {
        // Check if this city was just founded by looking at notifications
        const foundedNotification = state.notifications.find(
          n => n.type === 'city' &&
               n.message.includes(city.name) &&
               n.message.includes('founded') &&
               n.turn === state.turn
        );
        return foundedNotification !== undefined;
      });

      if (newCities.length > 0) {
        const city = newCities[0];
        const civ = state.civilizations[city.ownerId];
        if (civ) {
          showAnnouncement({
            type: 'city_founded',
            title: 'New City!',
            subtitle: city.name,
            civId: city.ownerId,
          });
        }
      }
    }

    // Check for golden age starts
    for (const [civId, civ] of Object.entries(state.civilizations)) {
      const prevGoldenAges = prev.goldenAges[civId] ?? 0;
      if (civ.goldenAgesCompleted > prevGoldenAges && civ.goldenAgeTurns > 0) {
        showAnnouncement({
          type: 'golden_age',
          title: 'GOLDEN AGE!',
          subtitle: civ.name,
          civId,
        });
        break; // Only show one golden age announcement at a time
      }
    }

    // Check for tech breakthroughs (major techs only)
    const majorTechs = [
      'writing', 'iron_working', 'mathematics', 'engineering',
      'gunpowder', 'printing_press', 'industrialization', 'electricity',
      'flight', 'computers', 'rocketry', 'space_flight'
    ];

    for (const [civId, civ] of Object.entries(state.civilizations)) {
      const prevTechCount = prev.researchedTechs[civId] ?? 0;
      if (civ.researchedTechs.length > prevTechCount) {
        // Check if any of the new techs are major techs
        const newTechs = civ.researchedTechs.slice(prevTechCount);
        const majorTechResearched = newTechs.find(t => majorTechs.includes(t));

        if (majorTechResearched) {
          // Format tech name nicely
          const techName = majorTechResearched
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

          showAnnouncement({
            type: 'tech_breakthrough',
            title: 'BREAKTHROUGH!',
            subtitle: `${civ.name} discovers ${techName}`,
            civId,
          });
          break; // Only show one tech announcement at a time
        }
      }
    }

    // Update previous state
    prevStateRef.current = {
      turn: state.turn,
      diplomacyLogLength: state.diplomacyLog.length,
      cityCount: currentCityCount,
      winner: state.winner,
      goldenAges: Object.fromEntries(
        Object.entries(state.civilizations).map(([id, civ]) => [id, civ.goldenAgesCompleted])
      ),
      researchedTechs: Object.fromEntries(
        Object.entries(state.civilizations).map(([id, civ]) => [id, civ.researchedTechs.length])
      ),
    };
  }, [state, showAnnouncement]);
}
