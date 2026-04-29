'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceErrorCode } from './useVoiceCommand';

interface VoiceResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  durationMs: number;
}

export type VoskModelStatus = 'idle' | 'loading' | 'ready' | 'error' | 'missing';

// Models are expected at /public/vosk-models/. Run `npm run setup:vosk` to fetch them.
// You can override these via NEXT_PUBLIC_VOSK_MODEL_EN / _RU env vars.
const MODEL_URLS: Record<string, string> = {
  en: process.env.NEXT_PUBLIC_VOSK_MODEL_EN || '/vosk-models/vosk-model-small-en-us-0.15.tar.gz',
  ru: process.env.NEXT_PUBLIC_VOSK_MODEL_RU || '/vosk-models/vosk-model-small-ru-0.22.tar.gz',
};

function pickModelUrl(lang?: string) {
  const l = (lang || 'en').toLowerCase();
  if (l.startsWith('ru')) return MODEL_URLS.ru;
  return MODEL_URLS.en;
}

export function useVoskRecognition(opts: { lang?: string } = {}) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [confidence] = useState(0.85); // Vosk doesn't expose per-result confidence
  const [error, setError] = useState<VoiceErrorCode | null>(null);
  const [modelStatus, setModelStatus] = useState<VoskModelStatus>('idle');

  const modelRef = useRef<any>(null);
  const recRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const onResultRef = useRef<((r: VoiceResult) => void) | null>(null);
  const currentLangRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.isSecureContext) {
      setSupported(false);
      setError('insecure-context');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setSupported(false);
      setError('audio-capture');
      return;
    }
  }, []);

  const ensureModel = useCallback(async () => {
    if (modelRef.current && currentLangRef.current === opts.lang) return modelRef.current;
    try {
      // dispose old model if language changed
      if (modelRef.current && currentLangRef.current !== opts.lang) {
        try { modelRef.current.terminate?.(); } catch {}
        modelRef.current = null;
      }
      setModelStatus('loading');
      console.log('[vosk] loading model for', opts.lang);
      const url = pickModelUrl(opts.lang);

      // Probe HEAD first so we can distinguish "not installed locally" from a deeper error.
      try {
        const probe = await fetch(url, { method: 'HEAD' });
        if (probe.status === 404) {
          console.error('[vosk] model file 404 at', url, '— run `npm run setup:vosk`');
          setModelStatus('missing');
          throw new Error('model-not-installed');
        }
      } catch (probeErr: any) {
        if (probeErr?.message === 'model-not-installed') throw probeErr;
        // network/CORS errors on HEAD — fall through to createModel which gives a richer error
      }

      const { createModel } = await import('vosk-browser');
      const model = await createModel(url);
      modelRef.current = model;
      currentLangRef.current = opts.lang;
      setModelStatus('ready');
      console.log('[vosk] model ready');
      return model;
    } catch (e: any) {
      console.error('[vosk] model load failed:', e);
      if (e?.message !== 'model-not-installed') setModelStatus('error');
      setError('network');
      throw e;
    }
  }, [opts.lang]);

  const cleanupAudio = useCallback(() => {
    try { processorRef.current?.disconnect(); } catch {}
    try { sourceRef.current?.disconnect(); } catch {}
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    try { audioCtxRef.current?.close(); } catch {}
    processorRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;
  }, []);

  const start = useCallback(async (cb?: (r: VoiceResult) => void) => {
    onResultRef.current = cb ?? null;
    startTimeRef.current = Date.now();
    setTranscript('');
    setError(null);

    let model: any;
    try {
      model = await ensureModel();
    } catch {
      setListening(false);
      return;
    }

    try {
      const recognizer = new model.KaldiRecognizer(16000);
      recognizer.setWords?.(true);
      recognizer.on('result', (msg: any) => {
        const text: string = msg?.result?.text ?? '';
        console.log('[vosk] result:', text);
        if (!text) return;
        setTranscript(text);
        if (onResultRef.current) {
          onResultRef.current({
            transcript: text,
            confidence: 0.85,
            isFinal: true,
            durationMs: Date.now() - startTimeRef.current,
          });
        }
      });
      recognizer.on('partialresult', (msg: any) => {
        const partial: string = msg?.result?.partial ?? '';
        if (partial) setTranscript(partial);
      });
      recRef.current = recognizer;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (event) => {
        try {
          recognizer.acceptWaveform(event.inputBuffer);
        } catch (e) {
          console.error('[vosk] acceptWaveform error:', e);
        }
      };
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(audioCtx.destination);

      setListening(true);
      console.log('[vosk] listening, sampleRate=', audioCtx.sampleRate);
    } catch (e: any) {
      console.error('[vosk] start failed:', e);
      const code: VoiceErrorCode = e?.name === 'NotAllowedError' ? 'not-allowed'
        : e?.name === 'NotFoundError' ? 'audio-capture'
        : 'start-failed';
      setError(code);
      setListening(false);
      cleanupAudio();
    }
  }, [ensureModel, cleanupAudio]);

  const stop = useCallback(() => {
    cleanupAudio();
    try {
      const finalText = recRef.current?.finalResult?.()?.text;
      if (finalText && onResultRef.current) {
        onResultRef.current({
          transcript: finalText,
          confidence: 0.85,
          isFinal: true,
          durationMs: Date.now() - startTimeRef.current,
        });
      }
    } catch {}
    try { recRef.current?.remove?.(); } catch {}
    recRef.current = null;
    setListening(false);
  }, [cleanupAudio]);

  useEffect(() => () => {
    cleanupAudio();
    try { modelRef.current?.terminate?.(); } catch {}
  }, [cleanupAudio]);

  return { supported, listening, transcript, confidence, error, modelStatus, start, stop };
}
