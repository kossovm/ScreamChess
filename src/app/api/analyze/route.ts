import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const { pgn, fen, moves } = await req.json();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      analysis:
        'AI Coach is offline (OPENAI_API_KEY not set).\n\n' +
        'Quick heuristics:\n' +
        `· Total moves: ${moves?.length ?? 0}\n` +
        `· Average think time: ${moves?.length ? Math.round(moves.reduce((a: number, m: any) => a + m.thinkMs, 0) / moves.length / 1000) : 0}s\n` +
        '· Add OPENAI_API_KEY in .env.local to unlock the LLM coach.',
    });
  }

  try {
    const openai = new OpenAI({ apiKey });
    const prompt = `You are a world-class chess coach AND a behavioural psychologist.
Analyze the following game.

PGN:
${pgn ?? '(no pgn)'}

Current FEN: ${fen ?? '(none)'}

Per-move data (JSON, includes thinking time and voice emotion if available):
${JSON.stringify(moves ?? [], null, 0).slice(0, 6000)}

Output:
1. Tactical: 2 key turning points and the better continuations.
2. Psychological: stress signs (long hesitations, voice arousal), risk style, impulsive vs patient pattern.
3. Improvement: 3 concrete drills.
Keep the tone warm and concrete. Use plain text, no markdown headers.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You analyze chess games with both engine logic and emotional/behavioural psychology.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 700,
    });

    return NextResponse.json({ analysis: completion.choices[0]?.message?.content ?? 'No analysis.' });
  } catch (e: any) {
    return NextResponse.json({ analysis: `Coach error: ${e?.message ?? 'unknown'}` }, { status: 200 });
  }
}
