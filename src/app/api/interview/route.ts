import { NextRequest, NextResponse } from 'next/server';
import { generateText, hasGeminiKey } from '@/lib/gemini';
import { aggregateEmotion, quickProfileFromMoves } from '@/lib/psychoAnalyzer';

export const runtime = 'edge';

type Locale = 'en' | 'ru';

export async function POST(req: NextRequest) {
  const { moves, pgn, durationSec, locale } = (await req.json()) as {
    moves?: any[];
    pgn?: string;
    durationSec?: number;
    locale?: Locale;
  };
  const lc: Locale = locale === 'ru' ? 'ru' : 'en';
  const list = Array.isArray(moves) ? moves : [];
  const emotion = aggregateEmotion(list);
  const heuristic = quickProfileFromMoves({ moves: list, emotionAvg: emotion });

  // Aggregate stats the LLM should reason about, not invent
  const totalMoves = list.length;
  const fast = list.filter((m: any) => m.thinkMs < 2500).length;
  const slow = list.filter((m: any) => m.thinkMs > 15000).length;
  const avgMs = totalMoves ? Math.round(list.reduce((a: number, m: any) => a + m.thinkMs, 0) / totalMoves) : 0;
  const captures = list.filter((m: any) => /x/.test(m.san || '')).length;
  const checks = list.filter((m: any) => /\+/.test(m.san || '')).length;
  const voiced = list.filter((m: any) => m.emotion?.raw).length;

  if (!hasGeminiKey()) {
    return NextResponse.json({
      report:
        lc === 'ru'
          ? `HR-отчёт офлайн (нет GEMINI_API_KEY).\n\nЭвристика:\n· Ходов: ${totalMoves}\n· Импульсивных (<2.5с): ${fast}\n· Глубоких (>15с): ${slow}\n· Среднее время: ${(avgMs / 1000).toFixed(1)}с\n· Стиль: ${heuristic.cognitiveStyle}\n· Риск ${heuristic.riskTolerance}/10, стресс ${heuristic.stressLevel}/10`
          : `HR report offline (no GEMINI_API_KEY).\n\nHeuristics:\n· Moves: ${totalMoves}\n· Impulsive (<2.5s): ${fast}\n· Deep (>15s): ${slow}\n· Avg think: ${(avgMs / 1000).toFixed(1)}s\n· Style: ${heuristic.cognitiveStyle}\n· Risk ${heuristic.riskTolerance}/10, Stress ${heuristic.stressLevel}/10`,
      heuristic,
    });
  }

  const compact = list.map((m: any) => ({
    p: m.ply,
    san: m.san,
    t: Math.round((m.thinkMs ?? 0) / 100) / 10,
    voice: m.emotion?.raw
      ? { said: String(m.emotion.raw).slice(0, 80), arousal: m.emotion.arousal, hesitation: m.emotion.hesitation }
      : undefined,
  }));

  try {
    const promptRu = `Ты — поведенческий ассессор для HR. Перед тобой данные 5-минутного шахматного интервью кандидата. Цель — дать рекрутеру ясный портрет того, КАК человек принимает решения под лёгким давлением, а не оценить его шахматный уровень.

PGN:
${pgn ?? '(не приложен)'}

Длительность партии: ${durationSec ? Math.round(durationSec) + 'с' : 'неизвестно'}
Всего ходов: ${totalMoves}
Импульсивные ходы (<2.5с): ${fast} (${totalMoves ? Math.round((fast / totalMoves) * 100) : 0}%)
Глубокие раздумья (>15с): ${slow} (${totalMoves ? Math.round((slow / totalMoves) * 100) : 0}%)
Среднее время на ход: ${(avgMs / 1000).toFixed(1)}с
Взятий: ${captures} · Шахов: ${checks}
Озвученных ходов: ${voiced} из ${totalMoves}

Эвристический срез (округлённые шкалы 1-10): ${JSON.stringify({
      style: heuristic.cognitiveStyle,
      risk: heuristic.riskTolerance,
      stress: heuristic.stressLevel,
      impulse: heuristic.impulsivity,
      patience: heuristic.patience,
      adapt: heuristic.adaptability,
    })}

Ходы (p=ply, san=ход, t=время в сек., voice=что и как сказал, если был озвучен):
${JSON.stringify(compact).slice(0, 6500)}

Усреднённые голосовые сигналы за партию: ${JSON.stringify(emotion)}

ПРАВИЛА:
- Это HR-отчёт, не шахматный разбор. НЕ оценивай качество ходов и не предлагай «как сыграть лучше».
- Никогда не используй медицинские/диагностические формулировки. Не пиши «тревожное расстройство», «СДВГ», «низкий интеллект» и т.п. Это поведенческие наблюдения, не диагноз.
- Цитируй конкретные ходы и временные метрики ИЗ ДАННЫХ. Если приводишь пример — называй ход (например, «на ходу 14, 0.8с»).
- Не пиши «нанимать / не нанимать». Дай рекомендацию КОНТЕКСТА — для каких ролей подходит, для каких — менее.
- На русском, без markdown-заголовков, без bullet-списков по 7 пунктов. Лучше — 4 коротких абзаца с подзаголовками жирным.

Структура (≈300-360 слов):

**Стиль принятия решений.** 1 абзац. Импульсивный vs аналитический, опираясь на распределение времени. Цитируй: «64% ходов под 3 секунд» или «8 раз думал дольше 20с». Что это говорит о темпе мышления.

**Реакция на давление.** 1 абзац. Как менялось время и качество в трудных моментах (после взятий, шахов, длинных пауз противника). Если есть голос — упомяни тон и колебания. Конкретно — приведи 1-2 момента.

**Профиль риска и инициативы.** 1 абзац. Атакует первым или ждёт? Лезет в обмены или избегает? Как часто шёл на упрощения. Цифрами.

**Контекст использования.** 1 абзац. Для каких ролей этот тип принятия решений — сильный плюс (например, операционные роли, переговоры под давлением, аналитика). Где может быть минус (например, длинные стратегические циклы или работа в одиночку без обратной связи). Без вердикта «хороший/плохой кандидат».`;

    const promptEn = `You are a behavioural assessor for HR. You have data from a 5-minute chess interview with a candidate. Your goal is to give the recruiter a clear picture of HOW this person makes decisions under mild pressure, NOT to evaluate their chess skill.

PGN:
${pgn ?? '(not attached)'}

Game duration: ${durationSec ? Math.round(durationSec) + 's' : 'unknown'}
Total moves: ${totalMoves}
Impulsive moves (<2.5s): ${fast} (${totalMoves ? Math.round((fast / totalMoves) * 100) : 0}%)
Deep deliberation (>15s): ${slow} (${totalMoves ? Math.round((slow / totalMoves) * 100) : 0}%)
Avg think per move: ${(avgMs / 1000).toFixed(1)}s
Captures: ${captures} · Checks: ${checks}
Voiced moves: ${voiced} of ${totalMoves}

Heuristic profile (1-10 scales): ${JSON.stringify({
      style: heuristic.cognitiveStyle,
      risk: heuristic.riskTolerance,
      stress: heuristic.stressLevel,
      impulse: heuristic.impulsivity,
      patience: heuristic.patience,
      adapt: heuristic.adaptability,
    })}

Per-move data (p=ply, san=move, t=think seconds, voice=what was said if voiced):
${JSON.stringify(compact).slice(0, 6500)}

Average voice signals across the game: ${JSON.stringify(emotion)}

RULES:
- This is an HR report, not a chess review. DO NOT critique move quality or suggest better moves.
- Never use clinical or diagnostic language. No "anxiety disorder", "ADHD", "low intelligence". Behavioural observations only.
- Cite specific moves and timings FROM THE DATA. When you give an example, name the move (e.g., "on move 14, took 0.8s").
- Do NOT write "hire / don't hire". Give a CONTEXT recommendation — what kinds of roles fit this profile, what kinds may fit less.
- Plain English, no markdown headers, no seven-bullet lists. Prefer 4 short paragraphs with bold subheadings.

Structure (~300-360 words):

**Decision-making style.** 1 paragraph. Impulsive vs analytical based on time distribution. Quote: "64% of moves under 3 seconds" or "thought >20s on 8 occasions". What this tells you about pace of thought.

**Response to pressure.** 1 paragraph. How time and quality changed during hard moments (after captures, checks, long opponent pauses). If voice exists — mention tone and hesitations. Concrete — name 1-2 moments.

**Risk and initiative profile.** 1 paragraph. Attacks first or waits? Welcomes trades or avoids? How often simplified. Use numbers.

**Best-fit context.** 1 paragraph. What role types this decision-making style is a strong plus for (e.g., operational roles, pressure negotiations, analysis). Where it could be a minus (e.g., long strategic cycles, isolated work without feedback). No "good/bad candidate" verdict.`;

    const system = lc === 'ru'
      ? 'Ты — поведенческий HR-ассессор. Пишешь сжато, по существу, на основе данных. Без диагнозов и без шахматных советов.'
      : 'You are a behavioural HR assessor. You write concisely, evidence-based. No diagnoses, no chess coaching.';

    const report = await generateText(lc === 'ru' ? promptRu : promptEn, {
      system,
      temperature: 0.5,
      maxOutputTokens: 1800,
    });

    return NextResponse.json({ report: report || (lc === 'ru' ? 'Нет отчёта.' : 'No report.'), heuristic });
  } catch (e: any) {
    const prefix = lc === 'ru' ? 'Ошибка отчёта' : 'Report error';
    return NextResponse.json({ report: `${prefix}: ${e?.message ?? 'unknown'}`, heuristic }, { status: 200 });
  }
}
