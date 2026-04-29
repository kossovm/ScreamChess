import { NextRequest, NextResponse } from 'next/server';
import { generateText, hasGeminiKey } from '@/lib/gemini';

export const runtime = 'edge';

type EngineMove = {
  ply: number;
  san: string;
  thinkMs: number;
  engine?: {
    bestSan: string;
    cpBefore: number | null;
    mateBefore: number | null;
    cpAfter: number | null;
    mateAfter: number | null;
    deltaCp: number | null;
    classification: 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
  };
};

type FinalEngine = {
  sideToMove: 'w' | 'b';
  bestSan: string;
  bestUci: string;
  cp: number | null;
  mate: number | null;
};

type Locale = 'en' | 'ru';

function topMistakes(moves: EngineMove[], n: number) {
  return [...moves]
    .filter((m) => m.engine && (m.engine.classification === 'mistake' || m.engine.classification === 'blunder' || m.engine.classification === 'inaccuracy'))
    .sort((a, b) => (b.engine?.deltaCp ?? 0) - (a.engine?.deltaCp ?? 0))
    .slice(0, n);
}

function bestMoves(moves: EngineMove[], n: number) {
  return moves
    .filter((m) => m.engine?.classification === 'best' && (m.engine?.deltaCp ?? 0) === 0)
    .slice(0, n);
}

function offlineMessage(list: EngineMove[], locale: Locale) {
  const avgSec = list.length ? Math.round(list.reduce((a, m) => a + m.thinkMs, 0) / list.length / 1000) : 0;
  if (locale === 'ru') {
    return (
      'AI-тренер офлайн (GEMINI_API_KEY не задан).\n\n' +
      'Быстрая статистика:\n' +
      `· Всего ходов: ${list.length}\n` +
      `· Среднее время на ход: ${avgSec}с\n` +
      '· Добавь GEMINI_API_KEY в .env.local, чтобы включить тренера.'
    );
  }
  return (
    'AI Coach is offline (GEMINI_API_KEY not set).\n\n' +
    'Quick heuristics:\n' +
    `· Total moves: ${list.length}\n` +
    `· Average think time: ${avgSec}s\n` +
    '· Add GEMINI_API_KEY in .env.local to unlock the LLM coach.'
  );
}

function buildEngineFinalLine(finalEngine: FinalEngine | undefined, locale: Locale) {
  if (!finalEngine) return '';
  if (locale === 'ru') {
    return `Финальная позиция (ход ${finalEngine.sideToMove === 'w' ? 'белых' : 'чёрных'}): движок рекомендует ${finalEngine.bestSan}, оценка ${
      finalEngine.mate !== null
        ? `мат в ${Math.abs(finalEngine.mate)} (${finalEngine.mate > 0 ? 'в пользу того, кто ходит' : 'против'})`
        : finalEngine.cp !== null
        ? `${(finalEngine.cp / 100).toFixed(2)} (с точки зрения белых)`
        : 'неизвестно'
    }.`;
  }
  return `Final position (${finalEngine.sideToMove === 'w' ? 'White' : 'Black'} to move): engine recommends ${finalEngine.bestSan}, eval ${
    finalEngine.mate !== null
      ? `mate in ${Math.abs(finalEngine.mate)} (${finalEngine.mate > 0 ? 'for the side to move' : 'against'})`
      : finalEngine.cp !== null
      ? `${(finalEngine.cp / 100).toFixed(2)} (from White's POV)`
      : 'unknown'
  }.`;
}

function buildPromptRu(args: {
  pgn?: string;
  fen?: string;
  finalEngine?: FinalEngine;
  compact: unknown;
  mistakes: EngineMove[];
  goods: EngineMove[];
}) {
  const { pgn, fen, finalEngine, compact, mistakes, goods } = args;
  return `Ты — шахматный тренер, который объясняет партию ученику простым человеческим языком. У тебя есть данные движка Stockfish — используй ТОЛЬКО их, никогда не выдумывай ходы и варианты, которых нет в данных.

PGN:
${pgn ?? '(нет)'}

Финальный FEN: ${fen ?? '(нет)'}

${buildEngineFinalLine(finalEngine, 'ru')}

Ходы (san=сыгранный ход; e.best=что предлагал движок; cpB=оценка до хода в сантипешках с точки зрения белых; cpA=после; d=сколько сантипешек потерял ходивший; k=класс хода; t=время в секундах):
${JSON.stringify(compact).slice(0, 8000)}

Топ ошибок партии (отсортировано по потере сантипешек):
${JSON.stringify(mistakes.map((m) => ({ ход: m.ply, сыграно: m.san, движок_советовал: m.engine?.bestSan, потеря_cp: m.engine?.deltaCp, класс: m.engine?.classification }))).slice(0, 1500)}

Сильные ходы (полностью совпали с движком):
${JSON.stringify(goods.map((m) => ({ ход: m.ply, сыграно: m.san }))).slice(0, 800)}

ЖЁСТКИЕ ПРАВИЛА:
- Все ходы пиши строго так, как они в данных (san, e.best). Никогда не придумывай новые ходы — это нелегальные ходы и ученик потеряет к тебе доверие.
- Не вставляй абстрактные «дриллы» вроде «потренируйся в тактике». Каждый совет должен быть привязан к конкретному ходу или плану из ЭТОЙ партии.
- Пиши на русском, как разговариваешь с другом за чашкой чая. Без markdown-заголовков, без bullet-списков по 5 пунктов.

Структура ответа (примерно 220-280 слов):

**Что было хорошо.** 1-2 конкретных момента — назови ход и объясни в одной фразе, почему это было сильно. Если хороших моментов мало — честно скажи.

**Где сломалось.** Разбери 2 главные ошибки из списка выше. Для каждой — в проза-форме (без буллетов) объясни: что ты сделал, в чём беда (потерянная фигура / темп / защита короля / тактика), и что было правильно с цитатой движка. Цифру потери (d) переведи в человеческий язык: 200+ — «зевок», 90-200 — «серьёзная неточность», 30-90 — «можно было лучше».

**Следующий ход.** Опираясь на финальную позицию и рекомендацию движка (${finalEngine?.bestSan ?? '—'}): объясни, ЗАЧЕМ этот ход, какой план он начинает, какой вектор атаки/обороны развивать дальше. Не просто «играй ${finalEngine?.bestSan ?? 'X'}», а с обоснованием. 2-3 предложения.

**Психология.** Найди в данных моменты, где время хода (t) было меньше 2.5с И ход классифицирован как mistake/blunder — это импульсивные сбои. Назови один такой момент конкретно. Если их нет — отметь, что игрок держался спокойно.`;
}

function buildPromptEn(args: {
  pgn?: string;
  fen?: string;
  finalEngine?: FinalEngine;
  compact: unknown;
  mistakes: EngineMove[];
  goods: EngineMove[];
}) {
  const { pgn, fen, finalEngine, compact, mistakes, goods } = args;
  return `You are a chess coach explaining the game to your student in plain, human language. You have Stockfish engine data — use ONLY what's provided. Never invent moves or lines not in the data.

PGN:
${pgn ?? '(none)'}

Final FEN: ${fen ?? '(none)'}

${buildEngineFinalLine(finalEngine, 'en')}

Per-move data (san=played; e.best=engine's preferred move; cpB=centipawns before from White's POV; cpA=after; d=centipawns lost by the mover; k=classification; t=think seconds):
${JSON.stringify(compact).slice(0, 8000)}

Top engine-flagged mistakes (sorted by centipawn loss):
${JSON.stringify(mistakes.map((m) => ({ ply: m.ply, played: m.san, engine_preferred: m.engine?.bestSan, cp_lost: m.engine?.deltaCp, kind: m.engine?.classification }))).slice(0, 1500)}

Strong moves (matched engine exactly):
${JSON.stringify(goods.map((m) => ({ ply: m.ply, played: m.san }))).slice(0, 800)}

HARD RULES:
- Quote every move EXACTLY as it appears in "san" or "e.best". Never type a move not in this data — those would be illegal and you'd lose your student's trust.
- No abstract "drills" like "practice tactics". Every suggestion must be tied to a concrete move or plan from THIS game.
- Plain English, like talking to a friend over coffee. No markdown headers, no five-bullet lists.

Structure (about 220-280 words):

**What went well.** 1-2 concrete moments — name the move and say in one sentence why it was strong. If there's little to praise, be honest.

**Where it broke.** Walk through the top 2 mistakes from the list above. For each, in prose: what you played, what the damage was (lost piece / tempo / king safety / missed tactic), and what was correct (cite engine). Translate the centipawn loss (d) to plain words: 200+ = "blunder", 90-200 = "serious inaccuracy", 30-90 = "could be better".

**Next move.** Based on the final position and the engine's recommendation (${finalEngine?.bestSan ?? '—'}): explain WHY this move, what plan it starts, which attack/defence vector to develop next. Not just "play ${finalEngine?.bestSan ?? 'X'}", but the reasoning behind it. 2-3 sentences.

**Psychology.** Find moments where think time (t) was under 2.5s AND the move is mistake/blunder — those are impulsive slips. Name one specifically. If there are none, note the player kept their head.`;
}

export async function POST(req: NextRequest) {
  const { pgn, fen, moves, finalEngine, locale } = (await req.json()) as {
    pgn?: string;
    fen?: string;
    moves?: EngineMove[];
    finalEngine?: FinalEngine;
    locale?: Locale;
  };
  const list = moves ?? [];
  const lc: Locale = locale === 'ru' ? 'ru' : 'en';

  if (!hasGeminiKey()) {
    return NextResponse.json({ analysis: offlineMessage(list, lc) });
  }

  const hasEngineData = list.some((m) => m.engine);
  const mistakes = hasEngineData ? topMistakes(list, 3) : [];
  const goods = hasEngineData ? bestMoves(list, 5) : [];

  const compact = list.map((m) => ({
    p: m.ply,
    san: m.san,
    t: Math.round(m.thinkMs / 100) / 10,
    e: m.engine
      ? {
          best: m.engine.bestSan,
          cpB: m.engine.cpBefore,
          cpA: m.engine.cpAfter,
          d: m.engine.deltaCp,
          k: m.engine.classification,
        }
      : undefined,
  }));

  try {
    const prompt = hasEngineData
      ? lc === 'ru'
        ? buildPromptRu({ pgn, fen, finalEngine, compact, mistakes, goods })
        : buildPromptEn({ pgn, fen, finalEngine, compact, mistakes, goods })
      : lc === 'ru'
      ? `Ты — шахматный тренер. Анализируй партию по PGN. Данных движка нет, поэтому НЕ называй конкретных «лучших ходов» с уверенностью — говори про планы и темы.\n\nPGN:\n${pgn ?? '(нет)'}\n\nХоды: ${JSON.stringify(list).slice(0, 4000)}\n\nДай разбор на русском (~180 слов): что было хорошо тематически, где общие проблемы, и общий совет. Без выдуманных вариантов.`
      : `You are a chess coach. Analyze this game from PGN only — no engine data is available, so DO NOT name specific "best moves" with confidence; speak in patterns and themes.\n\nPGN:\n${pgn ?? '(none)'}\n\nPer-move data: ${JSON.stringify(list).slice(0, 4000)}\n\nWrite a review in English (~180 words): tactical themes (no invented variations), psychological patterns from think times, and 3 actionable habits. Plain text.`;

    const system = lc === 'ru'
      ? 'Ты шахматный тренер, который пересказывает вывод движка Stockfish ученику. Пишешь на русском, простым языком, без воды. Никогда не придумываешь ходы — только цитируешь данные.'
      : 'You are a chess coach who interprets Stockfish engine output for a student. Write in plain English, no fluff. Never invent moves — quote only what is in the data.';

    const analysis = await generateText(prompt, {
      system,
      temperature: 0.4,
      maxOutputTokens: 1800,
    });

    return NextResponse.json({ analysis: analysis || (lc === 'ru' ? 'Нет анализа.' : 'No analysis.') });
  } catch (e: any) {
    const prefix = lc === 'ru' ? 'Ошибка тренера' : 'Coach error';
    return NextResponse.json({ analysis: `${prefix}: ${e?.message ?? 'unknown'}` }, { status: 200 });
  }
}
