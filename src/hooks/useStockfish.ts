'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface BestMove {
  from: string;
  to: string;
  promotion?: string;
  uci: string;
  cp: number | null;
  mate: number | null;
  depth: number;
}

const STOCKFISH_CDN = 'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js';

export function useStockfish() {
  const workerRef = useRef<Worker | null>(null);
  const [ready, setReady] = useState(false);
  const resolveRef = useRef<((bm: BestMove) => void) | null>(null);
  const lastInfoRef = useRef<{ cp: number | null; mate: number | null; depth: number }>({ cp: null, mate: null, depth: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let worker: Worker | null = null;
    try {
      // Build a worker that imports the CDN-hosted stockfish.js.
      const blob = new Blob([`importScripts('${STOCKFISH_CDN}');`], { type: 'application/javascript' });
      worker = new Worker(URL.createObjectURL(blob));
    } catch (e) {
      console.error('Stockfish init failed', e);
      return;
    }

    worker.onmessage = (ev: MessageEvent) => {
      const line = typeof ev.data === 'string' ? ev.data : '';
      if (line === 'uciok' || line.startsWith('readyok')) {
        setReady(true);
        return;
      }
      if (line.startsWith('info')) {
        const cp = line.match(/score cp (-?\d+)/);
        const mate = line.match(/score mate (-?\d+)/);
        const depth = line.match(/depth (\d+)/);
        lastInfoRef.current = {
          cp: cp ? parseInt(cp[1], 10) : lastInfoRef.current.cp,
          mate: mate ? parseInt(mate[1], 10) : null,
          depth: depth ? parseInt(depth[1], 10) : lastInfoRef.current.depth,
        };
      }
      if (line.startsWith('bestmove')) {
        const parts = line.split(' ');
        const uci = parts[1] || '';
        if (uci && uci !== '(none)' && resolveRef.current) {
          const from = uci.slice(0, 2);
          const to = uci.slice(2, 4);
          const promotion = uci.length > 4 ? uci[4] : undefined;
          resolveRef.current({
            from, to, promotion, uci,
            cp: lastInfoRef.current.cp,
            mate: lastInfoRef.current.mate,
            depth: lastInfoRef.current.depth,
          });
          resolveRef.current = null;
        }
      }
    };

    worker.postMessage('uci');
    worker.postMessage('isready');
    workerRef.current = worker;

    return () => {
      try { worker?.terminate(); } catch {}
    };
  }, []);

  const setSkill = useCallback((level: number) => {
    workerRef.current?.postMessage(`setoption name Skill Level value ${Math.max(0, Math.min(20, level))}`);
  }, []);

  const findBestMove = useCallback((fen: string, opts: { depth?: number; movetime?: number; level?: number } = {}) => {
    return new Promise<BestMove>((resolve) => {
      if (!workerRef.current) return resolve({ from: '', to: '', uci: '', cp: null, mate: null, depth: 0 });
      if (typeof opts.level === 'number') {
        workerRef.current.postMessage(`setoption name Skill Level value ${Math.max(0, Math.min(20, opts.level))}`);
      }
      resolveRef.current = resolve;
      lastInfoRef.current = { cp: null, mate: null, depth: 0 };
      workerRef.current.postMessage('ucinewgame');
      workerRef.current.postMessage(`position fen ${fen}`);
      if (opts.movetime) workerRef.current.postMessage(`go movetime ${opts.movetime}`);
      else workerRef.current.postMessage(`go depth ${opts.depth ?? 12}`);
    });
  }, []);

  const evaluate = useCallback((fen: string, depth = 14) => findBestMove(fen, { depth }), [findBestMove]);

  const stop = useCallback(() => workerRef.current?.postMessage('stop'), []);

  return { ready, findBestMove, evaluate, setSkill, stop };
}
