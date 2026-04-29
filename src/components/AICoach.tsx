'use client';

import { useState } from 'react';
import { Chess } from 'chess.js';
import { useGameStore } from '@/store/gameStore';
import { useStockfish } from '@/hooks/useStockfish';
import { useLanguage } from './LanguageProvider';
import { Loader2, Sparkles } from 'lucide-react';
import { buildPgn, pgnHeaders } from '@/lib/chessUtils';

interface Props {
  white: string;
  black: string;
  result?: string;
}

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

type EngineMove = {
  ply: number;
  san: string;
  thinkMs: number;
  emotion?: unknown;
  engine: {
    bestSan: string;
    bestUci: string;
    cpBefore: number | null;
    mateBefore: number | null;
    cpAfter: number | null;
    mateAfter: number | null;
    deltaCp: number | null;
    classification: 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
  };
};

function classify(deltaCp: number | null, mateLost: boolean): EngineMove['engine']['classification'] {
  if (mateLost) return 'blunder';
  if (deltaCp === null) return 'good';
  if (deltaCp < 30) return 'best';
  if (deltaCp < 90) return 'good';
  if (deltaCp < 200) return 'inaccuracy';
  if (deltaCp < 400) return 'mistake';
  return 'blunder';
}

export default function AICoach({ white, black, result }: Props) {
  const { history } = useGameStore();
  const { ready, findBestMove } = useStockfish();
  const { locale, t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);

  const run = async () => {
    if (history.length === 0) return;
    setLoading(true);
    setAnalysis(null);
    try {
      const enriched: EngineMove[] = [];
      setProgress({ done: 0, total: history.length });

      for (let i = 0; i < history.length; i++) {
        const fenBefore = i === 0 ? STARTING_FEN : history[i - 1].fen;
        const fenAfter = history[i].fen;

        const beforeEval = await findBestMove(fenBefore, { movetime: 180 });
        const afterEval = await findBestMove(fenAfter, { movetime: 120 });

        // best move SAN at fen-before
        let bestSan = beforeEval.uci;
        try {
          const probe = new Chess(fenBefore);
          const mv = probe.move({ from: beforeEval.from, to: beforeEval.to, promotion: beforeEval.promotion as any });
          if (mv) bestSan = mv.san;
        } catch {}

        // cp signs are from side-to-move POV. Normalize to "white better = +".
        const sideBefore = fenBefore.split(' ')[1] as 'w' | 'b';
        const sideAfter = fenAfter.split(' ')[1] as 'w' | 'b';
        const cpBeforeWhite = beforeEval.cp !== null ? (sideBefore === 'w' ? beforeEval.cp : -beforeEval.cp) : null;
        const cpAfterWhite = afterEval.cp !== null ? (sideAfter === 'w' ? afterEval.cp : -afterEval.cp) : null;

        // delta from the mover's POV (positive = move worsened position for mover)
        let deltaCp: number | null = null;
        if (cpBeforeWhite !== null && cpAfterWhite !== null) {
          const sign = sideBefore === 'w' ? 1 : -1;
          deltaCp = (cpBeforeWhite - cpAfterWhite) * sign;
        }
        const mateLost = beforeEval.mate !== null && beforeEval.mate > 0 && (afterEval.mate === null || (afterEval.mate !== null && afterEval.mate < 0));

        enriched.push({
          ply: history[i].ply,
          san: history[i].san,
          thinkMs: history[i].thinkMs,
          emotion: history[i].emotion,
          engine: {
            bestSan,
            bestUci: beforeEval.uci,
            cpBefore: cpBeforeWhite,
            mateBefore: beforeEval.mate,
            cpAfter: cpAfterWhite,
            mateAfter: afterEval.mate,
            deltaCp,
            classification: classify(deltaCp, mateLost),
          },
        });
        setProgress({ done: i + 1, total: history.length });
      }

      const pgn = buildPgn(history.map((h) => ({ san: h.san })), pgnHeaders({ white, black, result }));
      const finalFen = history[history.length - 1].fen;

      // Deeper analysis of the final position for the "next move" suggestion.
      const finalEval = await findBestMove(finalFen, { movetime: 600 });
      let finalBestSan = finalEval.uci;
      try {
        const probe = new Chess(finalFen);
        const mv = probe.move({ from: finalEval.from, to: finalEval.to, promotion: finalEval.promotion as any });
        if (mv) finalBestSan = mv.san;
      } catch {}
      const sideToMove = finalFen.split(' ')[1] as 'w' | 'b';
      const cpFinalWhite = finalEval.cp !== null ? (sideToMove === 'w' ? finalEval.cp : -finalEval.cp) : null;
      const finalEngine = {
        sideToMove,
        bestSan: finalBestSan,
        bestUci: finalEval.uci,
        cp: cpFinalWhite,
        mate: finalEval.mate,
      };

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pgn, fen: finalFen, moves: enriched, finalEngine, locale }),
      });
      const j = await res.json();
      setAnalysis(j.analysis ?? 'No analysis available.');
    } catch (e: any) {
      setAnalysis(`${t('coach.error')} (${e?.message ?? 'error'})`);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent-500" /> {t('coach.title')}
        </h3>
        <button onClick={run} disabled={loading || history.length === 0 || !ready} className="btn-primary text-sm py-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : ready ? t('coach.run') : t('coach.engineLoading')}
        </button>
      </div>
      {loading && progress && (
        <div className="text-xs text-gray-500 mb-2">
          {t('coach.progress', { done: progress.done, total: progress.total })}
        </div>
      )}
      {analysis ? (
        <div className="text-sm whitespace-pre-line leading-relaxed">{analysis}</div>
      ) : (
        !loading && <p className="text-sm text-gray-500">{t('coach.empty')}</p>
      )}
    </div>
  );
}
