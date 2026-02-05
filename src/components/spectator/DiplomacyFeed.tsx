'use client';

import React, { useRef, useEffect } from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { CIV_COLORS, DiplomacyMessage } from '@/games/civ/types';

const TYPE_ICONS: Record<DiplomacyMessage['type'], string> = {
  message: '',
  trade_proposal: '[Trade] ',
  alliance_proposal: '[Alliance] ',
  war_declaration: '[WAR] ',
  peace_offer: '[Peace] ',
};

const TYPE_STYLES: Record<DiplomacyMessage['type'], string> = {
  message: 'border-gray-600',
  trade_proposal: 'border-yellow-600',
  alliance_proposal: 'border-green-600',
  war_declaration: 'border-red-600',
  peace_offer: 'border-blue-600',
};

function MessageCard({ msg }: { msg: DiplomacyMessage }) {
  const fromColor = CIV_COLORS[msg.from] ?? { primary: '#888', secondary: '#CCC', label: msg.from };
  const toLabel = msg.to === 'all' ? 'All' : CIV_COLORS[msg.to]?.label || msg.to;

  return (
    <div className={`px-3 py-2 border-l-2 ${TYPE_STYLES[msg.type]} bg-gray-800/50 rounded-r`}>
      <div className="flex items-center gap-2 text-xs mb-1">
        <span className="font-bold" style={{ color: fromColor.primary }}>
          {fromColor.label}
        </span>
        <span className="text-gray-500">-&gt;</span>
        <span className="text-gray-400">{toLabel}</span>
        {msg.to !== 'all' && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-gray-700 rounded text-gray-400">PRIVATE</span>
        )}
        <span className="text-gray-600 text-[10px]">T{msg.turn}</span>
      </div>
      <div className="text-sm text-gray-200">
        <span className="text-gray-400">{TYPE_ICONS[msg.type]}</span>
        {msg.content}
      </div>
      {msg.response && (
        <div className={`text-xs mt-1 ${msg.response === 'accepted' ? 'text-green-400' : 'text-red-400'}`}>
          {msg.response === 'accepted' ? 'Accepted' : 'Rejected'}
        </div>
      )}
    </div>
  );
}

export function DiplomacyFeed() {
  const { state } = useCivGame();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.diplomacyLog.length]);

  if (state.diplomacyLog.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm italic px-4">
        No diplomatic exchanges yet. The game begins in silence...
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2 scrollbar-thin">
      {state.diplomacyLog.map(msg => (
        <MessageCard key={msg.id} msg={msg} />
      ))}
    </div>
  );
}
