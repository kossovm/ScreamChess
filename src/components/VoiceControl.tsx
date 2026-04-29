'use client';

import { useEffect, useState } from 'react';
import { Cloud, HardDrive, Loader2, Mic, MicOff, Volume2 } from 'lucide-react';
import { useVoiceCommand, type VoiceErrorCode } from '@/hooks/useVoiceCommand';
import { useVoskRecognition } from '@/hooks/useVoskRecognition';
import { parseVoiceCommand } from '@/lib/voiceParser';
import { inferEmotionFromVoice } from '@/lib/psychoAnalyzer';
import { useGameStore } from '@/store/gameStore';
import { useLanguage } from './LanguageProvider';
import type { TranslationKey } from '@/lib/i18n';
import toast from 'react-hot-toast';

interface Props {
  lang?: string;
  disabled?: boolean;
  onMove?: (move: { from: string; to: string }) => void;
  hotkey?: string;
}

type Engine = 'cloud' | 'local';

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

export default function VoiceControl({ lang, disabled, onMove, hotkey = 'v' }: Props) {
  const { locale, t } = useLanguage();
  const effectiveLang = lang ?? (locale === 'ru' ? 'ru-RU' : 'en-US');

  const [engine, setEngine] = useState<Engine>(() => {
    if (typeof window === 'undefined') return 'cloud';
    return ((localStorage.getItem('voice-engine') as Engine) ?? 'cloud');
  });

  // Both hooks always mounted; we just route start/stop to the active one.
  const cloud = useVoiceCommand({ lang: effectiveLang });
  const local = useVoskRecognition({ lang: effectiveLang });

  const active = engine === 'cloud' ? cloud : local;
  const { chess, makeMove, isGameOver } = useGameStore();
  const [history, setHistory] = useState<string[]>([]);

  const setEngineAndPersist = (e: Engine) => {
    setEngine(e);
    if (typeof window !== 'undefined') localStorage.setItem('voice-engine', e);
    // stop the inactive engine if it was running
    cloud.stop();
    local.stop();
  };

  // Surface errors via toast, only from the active engine
  useEffect(() => {
    if (!active.error) return;
    const key = ERROR_KEY[active.error] ?? 'voice.error.unknown';
    if (active.error === 'no-speech' || active.error === 'aborted') toast(t(key));
    else toast.error(t(key));
  }, [active.error, t]);

  const handleResult = (transcript: string, durationMs: number, voiceConf: number) => {
    const parsed = parseVoiceCommand(transcript, chess);
    const emotion = inferEmotionFromVoice({ transcript, durationMs, confidence: voiceConf });
    setHistory((h) => [transcript, ...h].slice(0, 5));

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
    } else {
      toast.error(`${t('voice.cantParse')} "${transcript}"`);
    }
  };

  const handleStart = () => {
    if (disabled || isGameOver || active.listening) return;
    active.start((res) => handleResult(res.transcript, res.durationMs, res.confidence));
  };

  // Global hotkey
  useEffect(() => {
    if (!active.supported) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== hotkey.toLowerCase()) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      if (active.listening) active.stop();
      else handleStart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.supported, active.listening, hotkey, isGameOver, disabled, chess, engine]);

  useEffect(() => () => { cloud.stop(); local.stop(); }, [cloud, local]);

  if (engine === 'cloud' && !cloud.supported) {
    return (
      <div className="card text-sm">
        <div className="flex items-center gap-2 text-amber-500"><MicOff className="w-4 h-4" /> {t('voice.notSupported')}</div>
        <p className="text-xs mt-2 text-gray-500">{t('voice.useBrowser')}</p>
      </div>
    );
  }

  const localLoading = engine === 'local' && local.modelStatus === 'loading';
  const localError = engine === 'local' && local.modelStatus === 'error';

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2"><Volume2 className="w-4 h-4" /> {t('voice.title')}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${active.listening ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>
          {active.listening ? t('voice.listening') : t('voice.idle')}
        </span>
      </div>

      {/* Engine toggle */}
      <div className="mb-3">
        <div className="text-xs text-gray-500 mb-1.5">{t('voice.engine.title')}</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setEngineAndPersist('cloud')}
            className={`text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
              engine === 'cloud' ? 'bg-primary-500 text-white' : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" /> {t('voice.engine.cloud')}
          </button>
          <button
            onClick={() => setEngineAndPersist('local')}
            className={`text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
              engine === 'local' ? 'bg-primary-500 text-white' : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" /> {t('voice.engine.local')}
          </button>
        </div>
        <p className="text-[11px] text-gray-500 mt-1.5">
          {engine === 'cloud' ? t('voice.engine.cloudHint') : t('voice.engine.localHint')}
        </p>
      </div>

      <button
        onClick={active.listening ? active.stop : handleStart}
        disabled={disabled || localLoading}
        className={`w-full btn ${active.listening ? 'bg-red-500/90 text-white' : 'btn-primary'} flex items-center justify-center gap-2 disabled:opacity-60`}
      >
        {localLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : active.listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        {localLoading ? t('voice.model.loading') : active.listening ? t('voice.stop') : t('voice.speak')}
        <kbd className="ml-2 px-1.5 py-0.5 rounded bg-black/20 text-[10px] font-mono uppercase">{hotkey}</kbd>
      </button>

      {engine === 'local' && local.modelStatus === 'missing' && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-amber-500/10 text-xs text-amber-500">
          {t('voice.model.missing')}
        </div>
      )}
      {localError && (
        <div className="mt-2 text-xs text-red-400">{t('voice.model.error')}</div>
      )}
      {engine === 'local' && local.modelStatus === 'ready' && !local.listening && (
        <div className="mt-2 text-[11px] text-emerald-500">✓ {t('voice.model.ready')}</div>
      )}

      {active.transcript && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-black/5 dark:bg-white/5 text-sm">
          <span className="opacity-60 text-xs">{t('voice.youSaid')}</span> {active.transcript}
          {active.confidence > 0 && <span className="ml-2 text-xs opacity-60">({Math.round(active.confidence * 100)}%)</span>}
        </div>
      )}

      <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        {t('voice.tryHint')} <span className="font-mono">&quot;e2 e4&quot;</span>, <span className="font-mono">&quot;knight to f3&quot;</span>, <span className="font-mono">&quot;short castle&quot;</span>
      </div>

      {history.length > 0 && (
        <div className="mt-3 text-xs space-y-1 opacity-70">
          {history.map((h, i) => <div key={i}>· {h}</div>)}
        </div>
      )}
    </div>
  );
}
