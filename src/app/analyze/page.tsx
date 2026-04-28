'use client';

import { useState } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '@/components/ChessBoard';
import { useGameStore } from '@/store/gameStore';
import { useStockfish } from '@/hooks/useStockfish';
import { evalToText } from '@/lib/chessUtils';
import toast from 'react-hot-toast';

export default function AnalyzePage() {
  const { loadPgn, loadFen, fen } = useGameStore();
  const { ready, evaluate } = useStockfish();
  const [pgn, setPgn] = useState('');
  const [evalCp, setEvalCp] = useState<number | null>(null);
  const [evalMate, setEvalMate] = useState<number | null>(null);
  const [coach, setCoach] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const importPgn = () => {
    try {
      const c = new Chess();
      c.loadPgn(pgn);
      loadPgn(pgn);
      toast.success('PGN loaded');
    } catch (e: any) {
      toast.error('Invalid PGN');
    }
  };

  const evalPos = async () => {
    if (!ready) return toast.error('Engine not ready');
    const bm = await evaluate(fen, 16);
    setEvalCp(bm.cp);
    setEvalMate(bm.mate);
  };

  const askCoach = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pgn, fen }),
      });
      const j = await res.json();
      setCoach(j.analysis ?? 'No response');
    } catch {
      setCoach('Coach unreachable');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-display font-bold mb-6">Game Analyzer</h1>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        <div className="space-y-4">
          <ChessBoard />
          <div className="card">
            <h3 className="font-semibold mb-2">Stockfish evaluation</h3>
            <div className="flex items-center gap-3">
              <button onClick={evalPos} className="btn-primary text-sm">Evaluate</button>
              <span className="font-mono text-lg">{evalToText(evalCp, evalMate, 'w')}</span>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold mb-2">Import PGN</h3>
            <textarea value={pgn} onChange={(e) => setPgn(e.target.value)} className="input min-h-[160px] font-mono text-xs" placeholder="Paste PGN here…" />
            <button onClick={importPgn} className="btn-primary mt-3 w-full">Load</button>
          </div>
          <div className="card">
            <h3 className="font-semibold mb-2">AI Coach review</h3>
            <button onClick={askCoach} disabled={loading} className="btn-primary w-full">{loading ? 'Analyzing…' : 'Ask the coach'}</button>
            {coach && <p className="mt-3 text-sm whitespace-pre-line">{coach}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
