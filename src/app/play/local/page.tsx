'use client';

import { useEffect } from 'react';
import ChessBoard from '@/components/ChessBoard';
import GameInfo from '@/components/GameInfo';
import MoveHistory from '@/components/MoveHistory';
import VoiceControl from '@/components/VoiceControl';
import AICoach from '@/components/AICoach';
import PsychoReport from '@/components/PsychoReport';
import { useGameStore } from '@/store/gameStore';
import { RefreshCw } from 'lucide-react';

export default function LocalPlayPage() {
  const { reset, isGameOver, result } = useGameStore();

  useEffect(() => {
    reset();
  }, [reset]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-display font-bold">Local Duel</h1>
        <button onClick={reset} className="btn-ghost flex items-center gap-2"><RefreshCw className="w-4 h-4" /> New game</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          <ChessBoard />
          {isGameOver && <div className="card text-center text-lg font-semibold">Game over · {result}</div>}
        </div>
        <div className="space-y-4">
          <GameInfo white="Player 1" black="Player 2" />
          <VoiceControl />
          <MoveHistory />
          <PsychoReport />
          <AICoach white="Player 1" black="Player 2" result={result ?? '*'} />
        </div>
      </div>
    </div>
  );
}
