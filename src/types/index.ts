export type Side = 'w' | 'b';

export interface MoveRecord {
  san: string;
  from: string;
  to: string;
  fen: string;
  thinkMs: number;
  voiceConfidence?: number;
  emotion?: VoiceEmotion;
  ply: number;
}

export interface VoiceEmotion {
  arousal: number; // 0..1
  valence: number; // -1..1
  hesitation: number; // 0..1
  confidence: number; // 0..1
  raw?: string;
}

export interface PsychoProfile {
  riskTolerance: number;
  cognitiveStyle: 'Intuitive Strategist' | 'Calculating Tactician' | 'Defensive Realist' | 'Aggressive Attacker' | 'Adaptive Hybrid';
  stressLevel: number;
  impulsivity: number;
  patience: number;
  adaptability: number;
  summary: string;
}

export interface GameRecord {
  id: string;
  userId?: string;
  pgn: string;
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  mode: 'local' | 'ai' | 'online';
  difficulty?: number;
  city?: string;
  createdAt: string;
  moves: MoveRecord[];
  profile?: PsychoProfile;
  ratingDelta?: number;
}

export interface LeaderEntry {
  id: string;
  username: string;
  rating: number;
  city?: string;
  country?: string;
  wins: number;
  losses: number;
  draws: number;
}
