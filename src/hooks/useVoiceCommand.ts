'use client';

import { useEffect, useRef, useState } from 'react';

interface VoiceResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  durationMs: number;
}

export function useVoiceCommand(opts: { lang?: string; continuous?: boolean } = {}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const recognitionRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const onResultRef = useRef<((r: VoiceResult) => void) | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    setSupported(true);
    const rec = new SR();
    rec.lang = opts.lang ?? 'en-US';
    rec.continuous = opts.continuous ?? false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onresult = (e: any) => {
      const last = e.results[e.results.length - 1];
      const t = last[0].transcript;
      const c = last[0].confidence ?? 0;
      setTranscript(t);
      setConfidence(c);
      if (last.isFinal && onResultRef.current) {
        onResultRef.current({ transcript: t, confidence: c, isFinal: true, durationMs: Date.now() - startTimeRef.current });
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    return () => {
      try { rec.stop(); } catch {}
    };
  }, [opts.lang, opts.continuous]);

  const start = (cb?: (r: VoiceResult) => void) => {
    if (!recognitionRef.current) return;
    onResultRef.current = cb ?? null;
    startTimeRef.current = Date.now();
    setTranscript('');
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch {
      // already listening
    }
  };

  const stop = () => {
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false);
  };

  return { supported, listening, transcript, confidence, start, stop };
}
