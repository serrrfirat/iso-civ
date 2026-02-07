import React from 'react';

interface IconProps {
  className?: string;
}

// Chat bubbles - Diplomacy (blue)
export function DiplomacyIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 9h8" />
      <path d="M8 13h4" />
    </svg>
  );
}

// Flask - Tech Tree (emerald)
export function TechIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6" />
      <path d="M10 3v6.5L4 18a1 1 0 0 0 .87 1.5h14.26A1 1 0 0 0 20 18l-6-8.5V3" />
    </svg>
  );
}

// Building columns - Cities (amber)
export function CitiesIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="10" width="4" height="10" rx="0.5" />
      <rect x="10" y="6" width="4" height="14" rx="0.5" />
      <rect x="16" y="10" width="4" height="10" rx="0.5" />
      <path d="M2 20h20" />
      <path d="M6 4l6-2 6 2" />
    </svg>
  );
}

// Shield + sword - Units (red)
export function UnitsIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L4 7v5c0 5.25 3.4 10.15 8 11.5 4.6-1.35 8-6.25 8-11.5V7l-8-5z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

// Clock - Events (purple)
export function EventsIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

// Theater masks - Culture (violet)
export function CultureHudIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="11" r="7" />
      <path d="M7 9.5a1 1 0 0 1 1 0" />
      <path d="M10 9.5a1 1 0 0 1 1 0" />
      <path d="M7 13c.5.5 1.5 1 2.5 1s2-.5 2.5-1" />
      <path d="M15 5a7 7 0 0 1 0 12" />
    </svg>
  );
}

// Globe - World Tracker (teal)
export function WorldTrackerIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
