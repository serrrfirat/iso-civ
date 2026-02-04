'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useCivGame } from '@/context/CivGameContext';

export function NarratorOverlay() {
  const { state } = useCivGame();
  const [displayedText, setDisplayedText] = useState('');
  const [visible, setVisible] = useState(false);
  const lastNarrationRef = useRef('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (state.currentNarration && state.currentNarration !== lastNarrationRef.current) {
      lastNarrationRef.current = state.currentNarration;
      setVisible(true);
      setDisplayedText('');

      // Typewriter effect
      let i = 0;
      const text = state.currentNarration;
      const interval = setInterval(() => {
        i++;
        setDisplayedText(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(interval);
          // Auto-dismiss after 4s
          timerRef.current = setTimeout(() => setVisible(false), 4000);
        }
      }, 30);

      return () => {
        clearInterval(interval);
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
  }, [state.currentNarration]);

  if (!visible || !displayedText) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 max-w-lg pointer-events-none z-10">
      <div className="bg-black/85 backdrop-blur-sm text-white px-6 py-4 rounded-lg border border-gray-600/50 shadow-2xl">
        <div className="text-sm italic leading-relaxed text-gray-100">
          {displayedText}
          <span className="animate-pulse text-gray-400">|</span>
        </div>
      </div>
    </div>
  );
}
