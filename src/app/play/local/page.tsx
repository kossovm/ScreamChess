'use client';

import { useEffect } from 'react';
import ChessBoard from '@/components/ChessBoard';
import GameInfo from '@/components/GameInfo';
import MoveHistory from '@/components/MoveHistory';
import VoiceControl from '@/components/VoiceControl';
import AICoach from '@/components/AICoach';
import PsychoReport from '@/components/PsychoReport';
import { useGameStore } from '@/store/gameStore';
import { useT } from '@/components/LanguageProvider';
import { RefreshCw, Undo2 } from 'lucide-react';

export default function LocalPlayPage() {
  const { reset, isGameOver, result, history, undo } = useGameStore();
  const t = useT();

  useEffect(() => {
    reset();
  }, [reset]);

  const p1 = t('play.local.player1');
  const p2 = t('play.local.player2');

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-display font-bold">{t('play.local.title')}</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => undo(1)} disabled={history.length === 0} className="btn-ghost flex items-center gap-2 disabled:opacity-50"><Undo2 className="w-4 h-4" /> {t('play.undo')}</button>
          <button onClick={reset} className="btn-ghost flex items-center gap-2"><RefreshCw className="w-4 h-4" /> {t('play.newGame')}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          <ChessBoard />
          {isGameOver && <div className="card text-center text-lg font-semibold">{t('play.gameOver')} · {result}</div>}
        </div>
        <div className="space-y-4">
          <GameInfo white={p1} black={p2} />
          <VoiceControl onUndo={() => undo(1)} />
          <MoveHistory />
          <PsychoReport side="both" whiteName={p1} blackName={p2} />
          <AICoach white={p1} black={p2} result={result ?? '*'} />
        </div>
      </div>
    </div>
  );
}
