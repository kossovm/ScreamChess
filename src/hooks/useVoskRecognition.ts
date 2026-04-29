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
  const workletRef = useRef<AudioWorkletNode | null>(null);
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
    try { workletRef.current?.disconnect(); } catch {}
    try { workletRef.current?.port?.close(); } catch {}
    try { sourceRef.current?.disconnect(); } catch {}
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    try { audioCtxRef.current?.close(); } catch {}
    workletRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;
  }, []);

  const start = useCallback(async (cb?: (r: VoiceResult) => void) => {
    if (listening || streamRef.current) {
      console.warn('[vosk] start() ignored — already listening');
      return;
    }
    console.log('[vosk] start() invoked');
    onResultRef.current = cb ?? null;
    startTimeRef.current = Date.now();
    setTranscript('');
    setError(null);

    let model: any;
    try {
      console.log('[vosk] ensuring model…');
      model = await ensureModel();
    } catch (e) {
      console.error('[vosk] ensureModel failed', e);
      setListening(false);
      return;
    }

    try {
      console.log('[vosk] requesting mic…');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
      console.log('[vosk] mic granted, tracks:', stream.getAudioTracks().map((t) => t.label));
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      if (audioCtx.state === 'suspended') {
        console.log('[vosk] AudioContext suspended, resuming…');
        await audioCtx.resume();
      }
      console.log('[vosk] AudioContext state=', audioCtx.state, 'sampleRate=', audioCtx.sampleRate);

      // Recognizer rate MUST match the audio context rate (typically 48000 in Chrome).
      const recognizer = new model.KaldiRecognizer(audioCtx.sampleRate);
      recognizer.setWords?.(true);
      recognizer.on('result', (msg: any) => {
        const text: string = msg?.result?.text ?? '';
        console.log('[vosk] FINAL:', JSON.stringify(text));
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
        if (partial) {
          console.log('[vosk] partial:', partial);
          setTranscript(partial);
        }
      });
      recRef.current = recognizer;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      console.log('[vosk] loading audio worklet…');
      await audioCtx.audioWorklet.addModule('/audio-worklets/vosk-recorder.js');
      const worklet = new AudioWorkletNode(audioCtx, 'vosk-recorder', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 1,
        channelCountMode: 'explicit',
      });
      workletRef.current = worklet;

      let frameCount = 0;
      worklet.port.onmessage = (ev: MessageEvent<Float32Array>) => {
        const samples = ev.data;
        try {
          // Vosk wants an AudioBuffer; build a one-channel buffer from the Float32Array
          const audioBuffer = audioCtx.createBuffer(1, samples.length, audioCtx.sampleRate);
          audioBuffer.getChannelData(0).set(samples);
          recognizer.acceptWaveform(audioBuffer);
          frameCount++;
          if (frameCount === 5) console.log('[vosk] receiving audio frames OK');
        } catch (err) {
          console.error('[vosk] acceptWaveform error:', err);
        }
      };

      // The audio graph only pumps a node when its output reaches the destination.
      // Route worklet → muted gain → destination so the graph stays live without echo.
      const muted = audioCtx.createGain();
      muted.gain.value = 0;
      source.connect(worklet);
      worklet.connect(muted);
      muted.connect(audioCtx.destination);

      setListening(true);
      console.log('[vosk] pipeline live · sampleRate=', audioCtx.sampleRate);
    } catch (e: any) {
      console.error('[vosk] start failed:', e?.name, e?.message, e);
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
