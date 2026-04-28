import { Chess, Square } from 'chess.js';

export function squaresOnBoard(): Square[] {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
  const out: Square[] = [];
  for (const r of ranks) for (const f of files) out.push((f + r) as Square);
  return out;
}

export function legalMovesFrom(chess: Chess, square: Square) {
  return chess.moves({ square, verbose: true });
}

export function pgnHeaders(opts: { white: string; black: string; result?: string; site?: string }) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  return [
    ['Event', 'PsychoVoice Match'],
    ['Site', opts.site ?? 'PsychoVoice Chess'],
    ['Date', date],
    ['White', opts.white],
    ['Black', opts.black],
    ['Result', opts.result ?? '*'],
  ];
}

export function buildPgn(moves: { san: string }[], headers: string[][]) {
  const head = headers.map(([k, v]) => `[${k} "${v}"]`).join('\n');
  const body = moves
    .map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m.san}` : m.san))
    .join(' ');
  return `${head}\n\n${body}`;
}

export function evalToText(cp: number | null, mate: number | null, turn: 'w' | 'b'): string {
  if (mate !== null) return `Mate in ${Math.abs(mate)}`;
  if (cp === null) return '0.0';
  const score = (turn === 'w' ? cp : -cp) / 100;
  return (score > 0 ? '+' : '') + score.toFixed(2);
}
