import { NextRequest, NextResponse } from 'next/server';
import { quickProfileFromMoves, aggregateEmotion } from '@/lib/psychoAnalyzer';
import { generateText, hasGeminiKey } from '@/lib/gemini';

export const runtime = 'edge';

type Locale = 'en' | 'ru';

export async function POST(req: NextRequest) {
  const { moves, locale } = (await req.json()) as { moves?: any[]; locale?: Locale };
  const lc: Locale = locale === 'ru' ? 'ru' : 'en';
  const emotion = aggregateEmotion(moves || []);
  const heuristic = quickProfileFromMoves({ moves: moves || [], emotionAvg: emotion });

  if (!hasGeminiKey()) return NextResponse.json({ profile: heuristic, source: 'heuristic' });

  try {
    const system = lc === 'ru'
      ? 'Ты — поведенческий психолог, который пишет «психологический паспорт» из 2 абзацев на основе шахматных ходов и голосовых эмоций. Без медицинских заявлений. Тон: проницательный, дружелюбный. Пиши на русском.'
      : 'You are a behavioural psychologist creating a 2-paragraph "psychological passport" from chess move data and voice emotion signals. No medical claims. Tone: insightful, friendly. Write in English.';

    const userPrompt = lc === 'ru'
      ? `Данные ходов: ${JSON.stringify(moves || []).slice(0, 5500)}\nСредние эмоции: ${JSON.stringify(emotion)}\nЭвристический профиль: ${JSON.stringify(heuristic)}\n\nНапиши паспорт (макс. 180 слов).`
      : `Move data: ${JSON.stringify(moves || []).slice(0, 5500)}\nEmotion average: ${JSON.stringify(emotion)}\nHeuristic profile: ${JSON.stringify(heuristic)}\n\nWrite the passport (max 180 words).`;

    const summary = await generateText(userPrompt, {
      system,
      temperature: 0.7,
      maxOutputTokens: 800,
    });
    return NextResponse.json({ profile: { ...heuristic, summary: summary || heuristic.summary }, source: 'llm' });
  } catch (e: any) {
    return NextResponse.json({ profile: heuristic, source: 'heuristic', error: e?.message });
  }
}
