import { Chess, Square } from 'chess.js';

const PIECE_MAP: Record<string, string> = {
  king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: '',
  король: 'K', ферзь: 'Q', королева: 'Q', ладья: 'R', слон: 'B', конь: 'N', пешка: '',
};

const FILE_WORDS: Record<string, string> = {
  a: 'a', b: 'b', c: 'c', d: 'd', e: 'e', f: 'f', g: 'g', h: 'h',
  alpha: 'a', bravo: 'b', charlie: 'c', delta: 'd', echo: 'e', foxtrot: 'f', golf: 'g', hotel: 'h',
  ay: 'a', bee: 'b', cee: 'c', dee: 'd', ee: 'e', eff: 'f', gee: 'g', aitch: 'h',
  // Russian
  'а': 'a', 'бэ': 'b', 'цэ': 'c', 'дэ': 'd', 'е': 'e', 'эф': 'f', 'жэ': 'g', 'аш': 'h',
};

const RANK_WORDS: Record<string, string> = {
  one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8',
  один: '1', два: '2', три: '3', четыре: '4', пять: '5', шесть: '6', семь: '7', восемь: '8',
};

export interface ParsedVoiceMove {
  type: 'move' | 'castle-k' | 'castle-q' | 'resign' | 'draw' | 'unknown';
  from?: string;
  to?: string;
  promotion?: string;
  piece?: string;
  raw: string;
}

export function parseVoiceCommand(transcript: string, chess: Chess): ParsedVoiceMove {
  const raw = transcript.toLowerCase().trim();
  if (!raw) return { type: 'unknown', raw };

  if (/(short.?castle|king.?side castle|короткая рокировка|o-?o\b)/.test(raw)) {
    return { type: 'castle-k', raw };
  }
  if (/(long.?castle|queen.?side castle|длинная рокировка|o-?o-?o\b)/.test(raw)) {
    return { type: 'castle-q', raw };
  }
  if (/(resign|сдаюсь)/.test(raw)) return { type: 'resign', raw };
  if (/(draw|ничья)/.test(raw)) return { type: 'draw', raw };

  // Try direct algebraic notation match: e.g. "e2 e4", "Nf3", "e4"
  const algebraicMatch = raw.match(/([a-h][1-8])\s*[-x to]*\s*([a-h][1-8])/i);
  if (algebraicMatch) {
    return { type: 'move', from: algebraicMatch[1], to: algebraicMatch[2], raw };
  }

  // Try SAN-style: "knight to f3", "queen takes e5"
  const tokens = raw
    .replace(/[.,]/g, ' ')
    .replace(/\bto\b|\btakes\b|\bна\b|\bбьёт\b|\bбьет\b|\bвзять\b/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  let piece = '';
  let file = '';
  let rank = '';
  for (const t of tokens) {
    if (PIECE_MAP[t] !== undefined) piece = PIECE_MAP[t];
    else if (FILE_WORDS[t]) file = FILE_WORDS[t];
    else if (RANK_WORDS[t]) rank = RANK_WORDS[t];
    else if (/^[a-h]$/.test(t)) file = t;
    else if (/^[1-8]$/.test(t)) rank = t;
    else if (/^[a-h][1-8]$/.test(t)) { file = t[0]; rank = t[1]; }
  }

  if (!file || !rank) return { type: 'unknown', raw };
  const target = (file + rank) as Square;

  const candidates = chess.moves({ verbose: true }).filter((m) => {
    if (m.to !== target) return false;
    if (piece) {
      return m.piece.toUpperCase() === piece;
    }
    return true;
  });

  if (candidates.length === 1) {
    return { type: 'move', from: candidates[0].from, to: candidates[0].to, piece: candidates[0].piece, raw };
  }
  if (candidates.length > 1) {
    // Ambiguous — pick first; UI should show alternatives
    return { type: 'move', from: candidates[0].from, to: candidates[0].to, piece: candidates[0].piece, raw };
  }
  return { type: 'unknown', raw };
}

export function describeMoveSpoken(san: string): string {
  return san.replace(/N/g, 'Knight ').replace(/B/g, 'Bishop ').replace(/R/g, 'Rook ').replace(/Q/g, 'Queen ').replace(/K/g, 'King ');
}
