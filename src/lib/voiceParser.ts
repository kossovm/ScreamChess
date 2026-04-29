import { Chess, Square } from 'chess.js';

const PIECE_MAP: Record<string, string> = {
  king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: '',
  // Russian (full and common Vosk variants)
  король: 'K', королем: 'K',
  ферзь: 'Q', ферзем: 'Q', королева: 'Q',
  ладья: 'R', ладьей: 'R', ладью: 'R',
  слон: 'B', слоном: 'B',
  конь: 'N', конём: 'N', конем: 'N', коня: 'N', конь_: 'N',
  пешка: '', пешкой: '', пешку: '', пешки: '',
};

// File letters — every alias I've seen Vosk produce.
// English letters, NATO phonetics, and Russian letter spellings.
const FILE_WORDS: Record<string, string> = {
  // English
  a: 'a', b: 'b', c: 'c', d: 'd', e: 'e', f: 'f', g: 'g', h: 'h',
  alpha: 'a', bravo: 'b', charlie: 'c', delta: 'd', echo: 'e',
  foxtrot: 'f', golf: 'g', hotel: 'h',
  ay: 'a', bee: 'b', cee: 'c', dee: 'd', ee: 'e', eff: 'f', gee: 'g', aitch: 'h',
  // Russian — file 'a'
  'а': 'a', 'эй': 'a', 'я': 'a', 'ай': 'a',
  // file 'b'
  'бэ': 'b', 'бе': 'b', 'би': 'b', 'бы': 'b', 'би́': 'b',
  // file 'c'
  'цэ': 'c', 'це': 'c', 'си': 'c', 'цы': 'c',
  // file 'd'
  'дэ': 'd', 'де': 'd', 'ди': 'd', 'ды': 'd',
  // file 'e' — Vosk often hears it as "и", "ей", "е", "эй"
  'е': 'e', 'и': 'e', 'ей': 'e', 'еи': 'e', 'еа': 'e', 'эа': 'e',
  // file 'f'
  'эф': 'f', 'еф': 'f', 'иф': 'f', 'ыф': 'f',
  // file 'g'
  'жэ': 'g', 'же': 'g', 'ге': 'g', 'гэ': 'g', 'джи': 'g', 'ги': 'g', 'джей': 'g',
  // file 'h'
  'аш': 'h', 'ха': 'h', 'аж': 'h', 'эйч': 'h', 'хэ': 'h', 'ач': 'h',
};

const RANK_WORDS: Record<string, string> = {
  // English
  one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8',
  // Russian — including common Vosk mishearings
  один: '1', одна: '1',
  два: '2', две: '2',
  три: '3', трю: '3', тре: '3',
  четыре: '4', чытыре: '4',
  пять: '5', пят: '5',
  шесть: '6', шест: '6', сэкс: '6', секс: '6',
  семь: '7', сем: '7',
  восемь: '8', восем: '8',
};

const FILLER_WORDS = new Set([
  'на', 'ход', 'ходи', 'походи', 'идет', 'идёт', 'идти', 'к', 'ко', 'до', 'из',
  'по', 'там', 'это', 'есть', 'то', 'ту', 'мы', 'ну', 'вот', 'ой', 'ах',
  'давай', 'пожалуйста', 'please', 'move', 'go',
]);

// Some letters double as Russian filler words: 'и' → file 'e', 'я' → file 'a'.
// These are resolved contextually below: a duplicate file token is treated as filler.

export interface ParsedVoiceMove {
  type: 'move' | 'castle-k' | 'castle-q' | 'resign' | 'draw' | 'unknown';
  from?: string;
  to?: string;
  promotion?: string;
  piece?: string;
  raw: string;
}

function isCastleK(s: string) {
  return /(short.?castle|king.?side|короткая рокировка|короткой рокировк|o-?o(?!-)|0-?0(?!-))/.test(s);
}
function isCastleQ(s: string) {
  return /(long.?castle|queen.?side|длинная рокировка|длинной рокировк|o-?o-?o|0-?0-?0)/.test(s);
}

export function parseVoiceCommand(transcript: string, chess: Chess): ParsedVoiceMove {
  const raw = transcript.toLowerCase().trim();
  if (!raw) return { type: 'unknown', raw };

  if (isCastleK(raw)) return { type: 'castle-k', raw };
  if (isCastleQ(raw)) return { type: 'castle-q', raw };
  if (/(resign|сдаюсь|сдаемся|сдаёмся)/.test(raw)) return { type: 'resign', raw };
  if (/(draw|ничья|ничью)/.test(raw)) return { type: 'draw', raw };

  // Direct algebraic notation: "e2 e4", "Nf3", "e2-e4"
  const algebraicMatch = raw.match(/([a-h])\s*([1-8])\s*[-x→to]*\s*([a-h])\s*([1-8])/i);
  if (algebraicMatch) {
    return {
      type: 'move',
      from: (algebraicMatch[1] + algebraicMatch[2]).toLowerCase(),
      to: (algebraicMatch[3] + algebraicMatch[4]).toLowerCase(),
      raw,
    };
  }
  const targetOnly = raw.match(/\b([a-h])\s*([1-8])\b/i);

  // Tokenize: replace punctuation with spaces, drop transition words like "to" / "takes" / "на" / "бьёт".
  const tokens = raw
    .replace(/[.,!?:;]/g, ' ')
    .replace(/\b(to|takes|x|→|→|на|бьёт|бьет|бьёшь|взять|берет|берём|берем)\b/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  let piece = '';
  const files: string[] = [];
  const ranks: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    // exact piece word
    if (PIECE_MAP[t] !== undefined) {
      piece = PIECE_MAP[t];
      continue;
    }
    // exact square e.g. "e4"
    const sq = t.match(/^([a-h])([1-8])$/);
    if (sq) {
      files.push(sq[1]);
      ranks.push(sq[2]);
      continue;
    }
    // single file letter
    if (/^[a-h]$/.test(t)) { files.push(t); continue; }
    // single rank digit
    if (/^[1-8]$/.test(t)) { ranks.push(t); continue; }
    // file word
    if (FILE_WORDS[t]) {
      // 'и' (→ e) and 'я' (→ a) double as Russian filler words. If we've already
      // collected enough files, treat the extra as filler instead of pushing.
      const isAmbiguous = t === 'и' || t === 'я';
      if (isAmbiguous && files.length >= 2) continue;
      files.push(FILE_WORDS[t]);
      continue;
    }
    // rank word
    if (RANK_WORDS[t]) {
      ranks.push(RANK_WORDS[t]);
      continue;
    }
    // filler — skip
    if (FILLER_WORDS.has(t)) continue;
    // unrecognized token — ignore
  }

  // Decide intent based on what we collected:
  // 2 files + 2 ranks → from-to
  // 1 file + 1 rank   → target square (find the unique legal move that lands there)
  // 1 file + 2 ranks  → assume file-rank pair, drop the extra rank (likely a Vosk fragment)
  // 2 files + 1 rank  → similar: pick the file closest to the rank by index

  let from: string | undefined;
  let to: string | undefined;

  if (files.length >= 2 && ranks.length >= 2) {
    from = files[0] + ranks[0];
    to = files[1] + ranks[1];
  } else if (files.length >= 1 && ranks.length >= 1) {
    to = files[files.length - 1] + ranks[ranks.length - 1];
  } else if (targetOnly) {
    to = (targetOnly[1] + targetOnly[2]).toLowerCase();
  }

  if (!to) return { type: 'unknown', raw };

  // If we have explicit from-to, return it directly.
  if (from && /^[a-h][1-8]$/.test(from) && /^[a-h][1-8]$/.test(to)) {
    return { type: 'move', from, to, raw };
  }

  // Otherwise resolve target → from via legal moves.
  if (!/^[a-h][1-8]$/.test(to)) return { type: 'unknown', raw };
  const target = to as Square;
  const candidates = chess.moves({ verbose: true }).filter((m) => {
    if (m.to !== target) return false;
    if (piece) return m.piece.toUpperCase() === piece;
    return true;
  });

  if (candidates.length >= 1) {
    return { type: 'move', from: candidates[0].from, to: candidates[0].to, piece: candidates[0].piece, raw };
  }
  return { type: 'unknown', raw };
}

export function describeMoveSpoken(san: string): string {
  return san.replace(/N/g, 'Knight ').replace(/B/g, 'Bishop ').replace(/R/g, 'Rook ').replace(/Q/g, 'Queen ').replace(/K/g, 'King ');
}
