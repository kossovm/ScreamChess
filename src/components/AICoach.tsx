'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { Loader2, Sparkles } from 'lucide-react';
import { buildPgn, pgnHeaders } from '@/lib/chessUtils';

interface Props {
  white: string;
  black: string;
  result?: string;
}

export default function AICoach({ white, black, result }: Props) {
  const { history } = useGameStore();
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);

  const run = async () => {
    if (history.length === 0) return;
    setLoading(true);
    try {
      const pgn = buildPgn(history.map((h) => ({ san: h.san })), pgnHeaders({ white, black, result }));
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pgn, moves: history }),
      });
      const j = await res.json();
      setAnalysis(j.analysis ?? 'No analysis available.');
    } catch (e: any) {
      setAnalysis(`Couldn't reach the coach right now. (${e?.message ?? 'error'})`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent-500" /> AI Coach
        </h3>
        <button onClick={run} disabled={loading || history.length === 0} className="btn-primary text-sm py-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Analyze game'}
        </button>
      </div>
      {analysis ? (
        <div className="text-sm whitespace-pre-line leading-relaxed">{analysis}</div>
      ) : (
        <p className="text-sm text-gray-500">Finish a game and click Analyze to get a coach review.</p>
      )}
    </div>
  );
}
