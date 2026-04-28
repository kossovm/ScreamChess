// Helper: build a stockfish worker that imports the engine from a CDN.
// Used by `useStockfish` hook. Exposed here for tests / non-React callers.

export const STOCKFISH_CDN = 'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js';

export function createStockfishWorker(): Worker {
  const blob = new Blob([`importScripts('${STOCKFISH_CDN}');`], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
}

export function uciToMove(uci: string): { from: string; to: string; promotion?: string } | null {
  if (!uci || uci === '(none)') return null;
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : undefined,
  };
}
