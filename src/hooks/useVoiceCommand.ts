'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface VoiceResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  durationMs: number;
}

export type VoiceErrorCode =
  | 'not-allowed'
  | 'audio-capture'
  | 'no-speech'
  | 'aborted'
  | 'network'
  | 'service-not-allowed'
  | 'language-not-supported'
  | 'insecure-context'
  | 'unsupported'
  | 'start-failed'
  | 'unknown';

export function useVoiceCommand(opts: { lang?: string; continuous?: boolean } = {}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState<VoiceErrorCode | null>(null);
  const recognitionRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const onResultRef = useRef<((r: VoiceResult) => void) | null>(null);
  const gotResultRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      console.warn('[voice] SpeechRecognition not available — use Chrome/Edge.');
      setSupported(false);
      setError('unsupported');
      return;
    }
    if (!window.isSecureContext) {
      console.warn('[voice] Insecure context — Web Speech API requires HTTPS or localhost.');
      setSupported(false);
      setError('insecure-context');
      return;
    }
    setSupported(true);

    const rec = new SR();
    rec.lang = opts.lang ?? 'en-US';
    rec.continuous = opts.continuous ?? false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onstart = () => {
      console.log('[voice] recognition started, lang=', rec.lang);
      gotResultRef.current = false;
    };
    rec.onaudiostart = () => console.log('[voice] mic capture started');
    rec.onspeechstart = () => console.log('[voice] speech detected');
    rec.onspeechend = () => console.log('[voice] speech ended');

    rec.onresult = (e: any) => {
      gotResultRef.current = true;
      const last = e.results[e.results.length - 1];
      const t = last[0].transcript;
      const c = last[0].confidence ?? 0;
      setTranscript(t);
      setConfidence(c);
      console.log('[voice] result:', { transcript: t, confidence: c, isFinal: last.isFinal });
      if (last.isFinal && onResultRef.current) {
        onResultRef.current({
          transcript: t,
          confidence: c,
          isFinal: true,
          durationMs: Date.now() - startTimeRef.current,
        });
      }
    };

    rec.onerror = (e: any) => {
      const code = (e?.error as VoiceErrorCode) ?? 'unknown';
      console.error('[voice] error:', code, e);
      setError(code);
      setListening(false);
    };

    rec.onend = () => {
      console.log('[voice] recognition ended (gotResult=', gotResultRef.current, ')');
      setListening(false);
    };

    recognitionRef.current = rec;
    return () => {
      try { rec.stop(); } catch {}
    };
  }, [opts.lang, opts.continuous]);

  const start = useCallback((cb?: (r: VoiceResult) => void) => {
    const rec = recognitionRef.current;
    if (!rec) {
      console.warn('[voice] start() called before recognition ready');
      return;
    }
    onResultRef.current = cb ?? null;
    startTimeRef.current = Date.now();
    setTranscript('');
    setError(null);
    try {
      rec.start();
      setListening(true);
    } catch (e: any) {
      // InvalidStateError = already started; otherwise real failure
      console.error('[voice] start() threw:', e?.name, e?.message);
      if (e?.name !== 'InvalidStateError') {
        setError('start-failed');
        setListening(false);
      }
    }
  }, []);

  const stop = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false);
  }, []);

  return { supported, listening, transcript, confidence, error, start, stop };
}
