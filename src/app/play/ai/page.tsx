'use client';

import { useEffect, useRef, useState } from 'react';
import ChessBoard from '@/components/ChessBoard';
import GameInfo from '@/components/GameInfo';
import MoveHistory from '@/components/MoveHistory';
import VoiceControl from '@/components/VoiceControl';
import AICoach from '@/components/AICoach';
import PsychoReport from '@/components/PsychoReport';
import { useGameStore } from '@/store/gameStore';
import { useStockfish } from '@/hooks/useStockfish';
import { RefreshCw, Cpu } from 'lucide-react';

const LEVEL_TO_SKILL = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
const LEVEL_TO_DEPTH = [4, 5, 6, 7, 8, 10, 12, 14, 16, 18, 20];

export default function AIPlayPage() {
  const { fen, makeMove, reset, chess, isGameOver, result, history } = useGameStore();
  const { ready, findBestMove, evaluate, stop } = useStockfish();
  const [level, setLevel] = useState(3);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [evalCp, setEvalCp] = useState<number | null>(null);
  const [evalMate, setEvalMate] = useState<number | null>(null);
  const thinkingRef = useRef(false);

  useEffect(() => {
    reset();
  }, [reset]);

  useEffect(() => {
    if (!ready || isGameOver) return;
    const aiSide = orientation === 'white' ? 'b' : 'w';
    if (chess.turn() !== aiSide) {
      // Update eval for human-side position too
      evaluate(fen, 12).then((bm) => {
        setEvalCp(bm.cp);
        setEvalMate(bm.mate);
      });
      return;
    }
    if (thinkingRef.current) return;
    thinkingRef.current = true;
    findBestMove(fen, { level: LEVEL_TO_SKILL[level], depth: LEVEL_TO_DEPTH[level] }).then((bm) => {
      thinkingRef.current = false;
      if (bm.from && bm.to) {
        setEvalCp(bm.cp);
        setEvalMate(bm.mate);
        makeMove({ from: bm.from, to: bm.to, promotion: bm.promotion ?? 'q' });
      }
    });
  }, [fen, ready, isGameOver, orientation, level, chess, findBestMove, evaluate, makeMove]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
        <h1 className="text-3xl font-display font-bold flex items-center gap-2">
          <Cpu className="w-7 h-7 text-accent-500" /> vs Stockfish
        </h1>
        <div className="flex items-center gap-3">
          <label className="text-sm flex items-center gap-2">
            Level
            <select value={level} onChange={(e) => setLevel(Number(e.target.value))} className="input py-1.5 text-sm w-20">
              {Array.from({ length: 11 }).map((_, i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </label>
          <button onClick={() => { reset(); setOrientation((o) => (o === 'white' ? 'black' : 'white')); }} className="btn-ghost text-sm">
            Switch sides
          </button>
          <button onClick={() => { stop(); reset(); }} className="btn-ghost flex items-center gap-2"><RefreshCw className="w-4 h-4" /> New</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          <ChessBoard orientation={orientation} />
          {!ready && <div className="text-center text-sm text-gray-500">Loading Stockfish engine…</div>}
          {isGameOver && <div className="card text-center text-lg font-semibold">Game over · {result}</div>}
        </div>
        <div className="space-y-4">
          <GameInfo white={orientation === 'white' ? 'You' : 'Stockfish'} black={orientation === 'white' ? 'Stockfish' : 'You'} evalCp={evalCp} evalMate={evalMate} />
          <VoiceControl />
          <MoveHistory />
          <PsychoReport />
          <AICoach
            white={orientation === 'white' ? 'You' : `Stockfish lvl ${level}`}
            black={orientation === 'white' ? `Stockfish lvl ${level}` : 'You'}
            result={result ?? '*'}
          />
        </div>
      </div>
    </div>
  );
}
