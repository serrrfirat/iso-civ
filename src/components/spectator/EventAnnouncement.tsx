'use client';

import React, { useEffect, useState } from 'react';
import { CivId, CIV_COLORS } from '@/games/civ/types';

export type EventAnnouncementType =
  | 'war_declared'
  | 'city_founded'
  | 'wonder_built'
  | 'tech_breakthrough'
  | 'victory'
  | 'golden_age';

export interface EventAnnouncementData {
  type: EventAnnouncementType;
  title: string;
  subtitle?: string;
  civId?: CivId;
  secondaryCivId?: CivId; // For war declarations
}

interface EventAnnouncementProps {
  event: EventAnnouncementData;
  onDismiss: () => void;
}

const EVENT_STYLES: Record<EventAnnouncementType, {
  bgGradient: string;
  borderColor: string;
  textColor: string;
  glowColor: string;
  icon: string;
}> = {
  war_declared: {
    bgGradient: 'from-red-950/95 via-red-900/90 to-red-950/95',
    borderColor: 'border-red-500',
    textColor: 'text-red-100',
    glowColor: 'shadow-red-500/50',
    icon: '\u2694\uFE0F', // crossed swords
  },
  city_founded: {
    bgGradient: 'from-amber-950/95 via-amber-900/90 to-amber-950/95',
    borderColor: 'border-amber-500',
    textColor: 'text-amber-100',
    glowColor: 'shadow-amber-500/50',
    icon: '\u{1F3DB}', // classical building
  },
  wonder_built: {
    bgGradient: 'from-purple-950/95 via-purple-900/90 to-purple-950/95',
    borderColor: 'border-purple-400',
    textColor: 'text-purple-100',
    glowColor: 'shadow-purple-400/50',
    icon: '\u2728', // sparkles
  },
  tech_breakthrough: {
    bgGradient: 'from-cyan-950/95 via-cyan-900/90 to-cyan-950/95',
    borderColor: 'border-cyan-400',
    textColor: 'text-cyan-100',
    glowColor: 'shadow-cyan-400/50',
    icon: '\u{1F4A1}', // lightbulb
  },
  victory: {
    bgGradient: 'from-yellow-900/95 via-yellow-700/90 to-yellow-900/95',
    borderColor: 'border-yellow-400',
    textColor: 'text-yellow-100',
    glowColor: 'shadow-yellow-400/60',
    icon: '\u{1F3C6}', // trophy
  },
  golden_age: {
    bgGradient: 'from-yellow-950/95 via-orange-900/90 to-yellow-950/95',
    borderColor: 'border-orange-400',
    textColor: 'text-orange-100',
    glowColor: 'shadow-orange-400/50',
    icon: '\u2600\uFE0F', // sun
  },
};

export function EventAnnouncement({ event, onDismiss }: EventAnnouncementProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const style = EVENT_STYLES[event.type];
  const civColor = event.civId ? CIV_COLORS[event.civId]?.primary : undefined;
  const secondaryCivColor = event.secondaryCivId ? CIV_COLORS[event.secondaryCivId]?.primary : undefined;

  useEffect(() => {
    // Trigger entrance animation
    const enterTimer = setTimeout(() => setIsVisible(true), 50);

    // Auto-dismiss after 2.5 seconds
    const dismissTimer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onDismiss, 300); // Wait for exit animation
    }, 2500);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(dismissTimer);
    };
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      aria-live="assertive"
    >
      {/* Backdrop flash effect */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          isVisible && !isExiting ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background: `radial-gradient(ellipse at center, ${
            event.type === 'war_declared' ? 'rgba(220, 38, 38, 0.15)' :
            event.type === 'victory' ? 'rgba(234, 179, 8, 0.2)' :
            event.type === 'golden_age' ? 'rgba(251, 146, 60, 0.15)' :
            'rgba(0, 0, 0, 0.3)'
          } 0%, transparent 70%)`
        }}
      />

      {/* Main announcement card */}
      <div
        className={`
          relative bg-gradient-to-r ${style.bgGradient}
          ${style.borderColor} border-2
          rounded-lg px-12 py-8
          shadow-2xl ${style.glowColor}
          backdrop-blur-md
          transform transition-all duration-300 ease-out
          ${isVisible && !isExiting
            ? 'scale-100 opacity-100 translate-y-0'
            : 'scale-75 opacity-0 -translate-y-8'
          }
        `}
      >
        {/* Decorative corner accents */}
        <div className={`absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 ${style.borderColor} rounded-tl-lg`} />
        <div className={`absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 ${style.borderColor} rounded-tr-lg`} />
        <div className={`absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 ${style.borderColor} rounded-bl-lg`} />
        <div className={`absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 ${style.borderColor} rounded-br-lg`} />

        {/* Icon */}
        <div className="text-center mb-2">
          <span
            className="text-4xl animate-bounce"
            style={{ animationDuration: '1s', animationIterationCount: '2' }}
          >
            {style.icon}
          </span>
        </div>

        {/* Title */}
        <h2
          className={`
            text-4xl md:text-5xl font-black tracking-wider text-center
            ${style.textColor}
            drop-shadow-lg
            ${event.type === 'victory' ? 'animate-pulse' : ''}
          `}
          style={{
            textShadow: '0 0 20px currentColor, 0 4px 8px rgba(0,0,0,0.5)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {event.title}
        </h2>

        {/* Subtitle with civ colors */}
        {event.subtitle && (
          <p
            className="text-xl md:text-2xl text-center mt-3 font-semibold tracking-wide"
            style={{
              color: 'rgba(255,255,255,0.9)',
              textShadow: '0 2px 4px rgba(0,0,0,0.5)',
            }}
          >
            {event.type === 'war_declared' && civColor && secondaryCivColor ? (
              <>
                <span style={{ color: civColor }}>{event.subtitle?.split(' vs ')[0]}</span>
                <span className="text-gray-400 mx-2">vs</span>
                <span style={{ color: secondaryCivColor }}>{event.subtitle?.split(' vs ')[1]}</span>
              </>
            ) : (
              <span style={{ color: civColor || 'inherit' }}>{event.subtitle}</span>
            )}
          </p>
        )}

        {/* Animated underline */}
        <div
          className={`
            mt-4 h-1 mx-auto rounded-full
            transition-all duration-500 delay-200
            ${isVisible && !isExiting ? 'w-3/4' : 'w-0'}
          `}
          style={{
            background: `linear-gradient(90deg, transparent, ${
              civColor || 'rgba(255,255,255,0.6)'
            }, transparent)`,
          }}
        />
      </div>
    </div>
  );
}
