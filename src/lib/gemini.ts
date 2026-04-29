type GeminiOptions = {
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
  model?: string;
};

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const FALLBACK_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
];

export class GeminiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function callOnce(model: string, apiKey: string, body: object) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    let code = 'UNKNOWN';
    let msg = raw.slice(0, 400);
    try {
      const parsed = JSON.parse(raw);
      code = parsed?.error?.status || code;
      msg = parsed?.error?.message || msg;
    } catch {}
    throw new GeminiError(res.status, code, `[${model}] ${res.status} ${code}: ${msg}`);
  }

  const data: any = await res.json();
  const candidate = data?.candidates?.[0];
  const text = candidate?.content?.parts?.map((p: any) => p?.text ?? '').join('') ?? '';
  const finish = candidate?.finishReason;
  if (finish && finish !== 'STOP' && finish !== 'MODEL_LENGTH') {
    if (finish === 'MAX_TOKENS') {
      return text.trim() + '\n\n[truncated: hit max output tokens]';
    }
    if (finish === 'SAFETY' || finish === 'RECITATION' || finish === 'BLOCKLIST') {
      throw new GeminiError(200, finish, `[${model}] response blocked: ${finish}`);
    }
  }
  return text.trim();
}

export async function generateText(prompt: string, opts: GeminiOptions = {}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxOutputTokens ?? 1024,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
  if (opts.system) {
    body.systemInstruction = { parts: [{ text: opts.system }] };
  }

  const primary = opts.model ?? DEFAULT_MODEL;
  const chain = [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];

  const errors: GeminiError[] = [];
  for (const model of chain) {
    try {
      return await callOnce(model, apiKey, body);
    } catch (e) {
      if (e instanceof GeminiError) {
        errors.push(e);
        if (e.status === 429 || e.code === 'RESOURCE_EXHAUSTED' || e.status === 404) continue;
      }
      throw e;
    }
  }
  const quotaHit = errors.some((e) => e.status === 429 || e.code === 'RESOURCE_EXHAUSTED');
  if (quotaHit) {
    const tried = errors.map((e) => e.message.match(/^\[([^\]]+)\]/)?.[1] ?? '?').join(', ');
    throw new Error(`Gemini free-tier daily quota exhausted across all fallback models (${tried}). Wait ~24h, switch key, or enable billing.`);
  }
  throw errors[errors.length - 1] ?? new Error('Gemini: all models failed');
}

export function hasGeminiKey(): boolean {
  return !!process.env.GEMINI_API_KEY;
}
