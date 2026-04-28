import type { MoveRecord, PsychoProfile } from '@/types';

interface AnalysisInput {
  moves: MoveRecord[];
  blunders?: number;
  inaccuracies?: number;
  averageThinkMs?: number;
  emotionAvg?: { arousal: number; valence: number; hesitation: number; confidence: number };
}

const STYLES: PsychoProfile['cognitiveStyle'][] = [
  'Intuitive Strategist',
  'Calculating Tactician',
  'Defensive Realist',
  'Aggressive Attacker',
  'Adaptive Hybrid',
];

export function quickProfileFromMoves(input: AnalysisInput): PsychoProfile {
  const moves = input.moves;
  if (!moves.length) {
    return {
      riskTolerance: 5,
      cognitiveStyle: 'Adaptive Hybrid',
      stressLevel: 0,
      impulsivity: 0,
      patience: 5,
      adaptability: 5,
      summary: 'Not enough data to build a profile yet.',
    };
  }
  const captures = moves.filter((m) => /x/.test(m.san)).length;
  const checks = moves.filter((m) => /\+/.test(m.san)).length;
  const promos = moves.filter((m) => /=/.test(m.san)).length;

  const fastMoves = moves.filter((m) => m.thinkMs < 2500).length;
  const slowMoves = moves.filter((m) => m.thinkMs > 15000).length;
  const avgThink = input.averageThinkMs ?? moves.reduce((a, m) => a + m.thinkMs, 0) / moves.length;

  const aggression = (captures + checks * 1.5 + promos) / moves.length;
  const riskTolerance = Math.max(1, Math.min(10, Math.round(aggression * 12 + (input.blunders ?? 0) * 0.4)));
  const impulsivity = Math.max(1, Math.min(10, Math.round((fastMoves / moves.length) * 10 + 1)));
  const patience = Math.max(1, Math.min(10, Math.round((slowMoves / moves.length) * 8 + (avgThink / 6000))));
  const stressLevel = Math.max(1, Math.min(10, Math.round((input.blunders ?? 0) * 1.5 + (input.emotionAvg?.arousal ?? 0.4) * 6)));
  const adaptability = Math.max(1, Math.min(10, 10 - Math.abs(impulsivity - patience)));

  let style: PsychoProfile['cognitiveStyle'] = 'Adaptive Hybrid';
  if (riskTolerance >= 7 && impulsivity >= 6) style = 'Aggressive Attacker';
  else if (patience >= 7 && riskTolerance <= 4) style = 'Defensive Realist';
  else if (impulsivity <= 4 && patience >= 6) style = 'Calculating Tactician';
  else if (impulsivity >= 6 && riskTolerance >= 5) style = 'Intuitive Strategist';

  const summary =
    `You played ${moves.length} moves with ${captures} captures and ${checks} checks. ` +
    `Average thinking time: ${(avgThink / 1000).toFixed(1)}s. ` +
    `Your style leans ${style.toLowerCase()}, with risk tolerance ${riskTolerance}/10 and stress level ${stressLevel}/10.`;

  return { riskTolerance, cognitiveStyle: style, stressLevel, impulsivity, patience, adaptability, summary };
}

export function aggregateEmotion(moves: MoveRecord[]): AnalysisInput['emotionAvg'] {
  const ems = moves.map((m) => m.emotion).filter(Boolean) as NonNullable<MoveRecord['emotion']>[];
  if (!ems.length) return { arousal: 0.4, valence: 0, hesitation: 0.3, confidence: 0.6 };
  const avg = (key: keyof NonNullable<MoveRecord['emotion']>) =>
    ems.reduce((a, e) => a + (typeof e[key] === 'number' ? (e[key] as number) : 0), 0) / ems.length;
  return {
    arousal: avg('arousal'),
    valence: avg('valence'),
    hesitation: avg('hesitation'),
    confidence: avg('confidence'),
  };
}

export function inferEmotionFromVoice(opts: { transcript: string; durationMs: number; confidence: number }): NonNullable<MoveRecord['emotion']> {
  const t = opts.transcript;
  const fillerCount = (t.match(/\b(uh|um|er|эээ|ну|типа)\b/gi) || []).length;
  const len = t.length;
  const wordsPerSec = (t.split(/\s+/).length / Math.max(opts.durationMs, 1)) * 1000;
  const arousal = Math.min(1, Math.max(0, wordsPerSec / 4));
  const hesitation = Math.min(1, fillerCount / 4 + (opts.durationMs > 5000 ? 0.4 : 0.1));
  const valence = /good|nice|let's|yes|gotcha|давай|отлично/i.test(t) ? 0.4
    : /no|miss|oh|нет|блин/i.test(t) ? -0.4 : 0;
  return {
    arousal,
    valence,
    hesitation,
    confidence: opts.confidence || 0.7,
    raw: t,
  };
}
