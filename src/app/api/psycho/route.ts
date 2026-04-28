import { NextRequest, NextResponse } from 'next/server';
import { quickProfileFromMoves, aggregateEmotion } from '@/lib/psychoAnalyzer';
import OpenAI from 'openai';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const { moves } = await req.json();
  const emotion = aggregateEmotion(moves || []);
  const heuristic = quickProfileFromMoves({ moves: moves || [], emotionAvg: emotion });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ profile: heuristic, source: 'heuristic' });

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a behavioural psychologist creating a 2-paragraph "psychological passport" from chess move data and voice emotion signals. No medical claims. Tone: insightful, friendly.' },
        { role: 'user', content: `Move data: ${JSON.stringify(moves || []).slice(0, 5500)}\nEmotion average: ${JSON.stringify(emotion)}\nHeuristic profile: ${JSON.stringify(heuristic)}\n\nWrite the passport (max 180 words).` },
      ],
      temperature: 0.7,
      max_tokens: 350,
    });
    const summary = completion.choices[0]?.message?.content ?? heuristic.summary;
    return NextResponse.json({ profile: { ...heuristic, summary }, source: 'llm' });
  } catch (e: any) {
    return NextResponse.json({ profile: heuristic, source: 'heuristic', error: e?.message });
  }
}
