'use client';

import { useEffect, useState } from 'react';
import { Loader2, Mic, MicOff, Volume2 } from 'lucide-react';
import { useVoskRecognition } from '@/hooks/useVoskRecognition';
import type { VoiceErrorCode } from '@/hooks/useVoiceCommand';
import { parseVoiceCommand } from '@/lib/voiceParser';
import { inferEmotionFromVoice } from '@/lib/psychoAnalyzer';
import { useGameStore } from '@/store/gameStore';
import { useLanguage } from './LanguageProvider';
import type { TranslationKey } from '@/lib/i18n';
import toast from 'react-hot-toast';

interface Props {
  lang?: string;
  disabled?: boolean;
  /**
   * If set, voice can only execute moves for this colour, and only when it is
   * its turn. Online play passes 'w' or 'b'; local hot-seat leaves it null.
   */
  playerSide?: 'w' | 'b' | null;
  onMove?: (move: { from: string; to: string }) => void;
  onUndo?: () => number;
  hotkey?: string;
}

const ERROR_KEY: Record<VoiceErrorCode, TranslationKey> = {
  'not-allowed': 'voice.error.not-allowed',
  'audio-capture': 'voice.error.audio-capture',
  'no-speech': 'voice.error.no-speech',
  'aborted': 'voice.error.aborted',
  'network': 'voice.error.network',
  'service-not-allowed': 'voice.error.service-not-allowed',
  'language-not-supported': 'voice.error.language-not-supported',
  'insecure-context': 'voice.error.insecure-context',
  'unsupported': 'voice.error.unsupported',
  'start-failed': 'voice.error.start-failed',
  'unknown': 'voice.error.unknown',
};

export default function VoiceControl({ lang, disabled, playerSide, onMove, onUndo, hotkey = 'v' }: Props) {
  const { locale, t } = useLanguage();
  const effectiveLang = lang ?? (locale === 'ru' ? 'ru-RU' : 'en-US');

  const { supported, listening, transcript, confidence, error, modelStatus, start, stop } =
    useVoskRecognition({ lang: effectiveLang });
  const { chess, makeMove, isGameOver, undo: storeUndo } = useGameStore();
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    if (!error) return;
    const key = ERROR_KEY[error] ?? 'voice.error.unknown';
    if (error === 'no-speech' || error === 'aborted') toast(t(key));
    else toast.error(t(key));
  }, [error, t]);

  const handleResult = (transcriptText: string, durationMs: number, voiceConf: number) => {
    const parsed = parseVoiceCommand(transcriptText, chess);
    const emotion = inferEmotionFromVoice({ transcript: transcriptText, durationMs, confidence: voiceConf });
    setHistory((h) => [transcriptText, ...h].slice(0, 5));

    // In online play, refuse voice moves when it isn't the player's turn —
    // otherwise opponents could whisper into your mic and move for you, and the
    // SAN parser would happily resolve "e2 e4" against the opponent's pieces.
    const isMoveLike = parsed.type === 'move' || parsed.type === 'castle-k' || parsed.type === 'castle-q';
    if (playerSide && isMoveLike && chess.turn() !== playerSide) {
      toast.error(t('online.notYourTurn'));
      return;
    }

    if (parsed.type === 'move' && parsed.from && parsed.to) {
      const ok = makeMove({ from: parsed.from, to: parsed.to, promotion: 'q' }, emotion, voiceConf);
      if (ok) {
        toast.success(`🎙️ ${parsed.from} → ${parsed.to}`);
        onMove?.({ from: parsed.from, to: parsed.to });
      } else {
        toast.error(t('voice.illegal'));
      }
    } else if (parsed.type === 'castle-k') {
      const ok = makeMove({ from: 'e1', to: 'g1' }, emotion, voiceConf) || makeMove({ from: 'e8', to: 'g8' }, emotion, voiceConf);
      if (ok) toast.success(t('voice.castleK')); else toast.error(t('voice.cantCastle'));
    } else if (parsed.type === 'castle-q') {
      const ok = makeMove({ from: 'e1', to: 'c1' }, emotion, voiceConf) || makeMove({ from: 'e8', to: 'c8' }, emotion, voiceConf);
      if (ok) toast.success(t('voice.castleQ')); else toast.error(t('voice.cantCastle'));
    } else if (parsed.type === 'resign') {
      toast(`${t('voice.resigned')} 🏳️`);
    } else if (parsed.type === 'draw') {
      toast(`${t('voice.draw')} 🤝`);
    } else if (parsed.type === 'undo') {
      const popped = onUndo ? onUndo() : storeUndo(1);
      if (popped > 0) toast.success(`↩️ ${t('voice.undone')}`);
      else toast(t('voice.nothingToUndo'));
    } else {
      toast.error(`${t('voice.cantParse')} "${transcriptText}"`);
    }
  };

  const handleStart = () => {
    if (disabled || isGameOver || listening) return;
    start((res) => handleResult(res.transcript, res.durationMs, res.confidence));
  };

  // Global hotkey (V by default)
  useEffect(() => {
    if (!supported) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== hotkey.toLowerCase()) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      if (listening) stop();
      else handleStart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported, listening, hotkey, isGameOver, disabled, chess]);

  if (!supported) {
    return (
      <div className="card text-sm">
        <div className="flex items-center gap-2 text-amber-500"><MicOff className="w-4 h-4" /> {t('voice.notSupported')}</div>
        <p className="text-xs mt-2 text-gray-500">{t('voice.useBrowser')}</p>
      </div>
    );
  }

  const modelLoading = modelStatus === 'loading';
  const modelMissing = modelStatus === 'missing';
  const modelError = modelStatus === 'error';

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2"><Volume2 className="w-4 h-4" /> {t('voice.title')}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${listening ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>
          {listening ? t('voice.listening') : t('voice.idle')}
        </span>
      </div>

      <button
        onClick={listening ? stop : handleStart}
        disabled={disabled || modelLoading || modelMissing}
        className={`w-full btn ${listening ? 'bg-red-500/90 text-white' : 'btn-primary'} flex items-center justify-center gap-2 disabled:opacity-60`}
      >
        {modelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        {modelLoading ? t('voice.model.loading') : listening ? t('voice.stop') : t('voice.speak')}
        <kbd className="ml-2 px-1.5 py-0.5 rounded bg-black/20 text-[10px] font-mono uppercase">{hotkey}</kbd>
      </button>

      {modelMissing && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-amber-500/10 text-xs text-amber-500">
          {t('voice.model.missing')}
        </div>
      )}
      {modelError && (
        <div className="mt-2 text-xs text-red-400">{t('voice.model.error')}</div>
      )}
      {modelStatus === 'ready' && !listening && (
        <div className="mt-2 text-[11px] text-emerald-500">✓ {t('voice.model.ready')}</div>
      )}

      {transcript && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-black/5 dark:bg-white/5 text-sm">
          <span className="opacity-60 text-xs">{t('voice.youSaid')}</span> {transcript}
          {confidence > 0 && <span className="ml-2 text-xs opacity-60">({Math.round(confidence * 100)}%)</span>}
        </div>
      )}

      <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        {t('voice.tryHint')} <span className="font-mono">&quot;e2 e4&quot;</span>, <span className="font-mono">&quot;конь эф три&quot;</span>, <span className="font-mono">&quot;короткая рокировка&quot;</span>
      </div>

      {history.length > 0 && (
        <div className="mt-3 text-xs space-y-1 opacity-70">
          {history.map((h, i) => <div key={i}>· {h}</div>)}
        </div>
      )}
    </div>
  );
}
