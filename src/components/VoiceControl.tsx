'use client';

import { useEffect, useState } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { useVoiceCommand } from '@/hooks/useVoiceCommand';
import { parseVoiceCommand } from '@/lib/voiceParser';
import { inferEmotionFromVoice } from '@/lib/psychoAnalyzer';
import { useGameStore } from '@/store/gameStore';
import toast from 'react-hot-toast';

interface Props {
  lang?: string;
  disabled?: boolean;
  onMove?: (move: { from: string; to: string }) => void;
}

export default function VoiceControl({ lang = 'en-US', disabled, onMove }: Props) {
  const { supported, listening, transcript, confidence, start, stop } = useVoiceCommand({ lang });
  const { chess, makeMove, isGameOver } = useGameStore();
  const [history, setHistory] = useState<string[]>([]);

  const handleStart = () => {
    if (disabled || isGameOver) return;
    start((res) => {
      const parsed = parseVoiceCommand(res.transcript, chess);
      const emotion = inferEmotionFromVoice({ transcript: res.transcript, durationMs: res.durationMs, confidence: res.confidence });
      setHistory((h) => [res.transcript, ...h].slice(0, 5));

      if (parsed.type === 'move' && parsed.from && parsed.to) {
        const ok = makeMove({ from: parsed.from, to: parsed.to, promotion: 'q' }, emotion, res.confidence);
        if (ok) {
          toast.success(`🎙️ ${parsed.from} → ${parsed.to}`);
          onMove?.({ from: parsed.from, to: parsed.to });
        } else {
          toast.error('Illegal move');
        }
      } else if (parsed.type === 'castle-k') {
        const ok = makeMove({ from: 'e1', to: 'g1' }, emotion, res.confidence) || makeMove({ from: 'e8', to: 'g8' }, emotion, res.confidence);
        if (ok) toast.success('Castle kingside'); else toast.error('Cannot castle now');
      } else if (parsed.type === 'castle-q') {
        const ok = makeMove({ from: 'e1', to: 'c1' }, emotion, res.confidence) || makeMove({ from: 'e8', to: 'c8' }, emotion, res.confidence);
        if (ok) toast.success('Castle queenside'); else toast.error('Cannot castle now');
      } else if (parsed.type === 'resign') {
        toast('You resigned 🏳️');
      } else if (parsed.type === 'draw') {
        toast('Draw offered 🤝');
      } else {
        toast.error(`Couldn't parse: "${res.transcript}"`);
      }
    });
  };

  useEffect(() => () => stop(), [stop]);

  if (!supported) {
    return (
      <div className="card text-sm">
        <div className="flex items-center gap-2 text-amber-500"><MicOff className="w-4 h-4" /> Voice not supported in this browser.</div>
        <p className="text-xs mt-2 text-gray-500">Try Chrome or Edge.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2"><Volume2 className="w-4 h-4" /> Voice Command</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${listening ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>
          {listening ? 'Listening…' : 'Idle'}
        </span>
      </div>

      <button
        onClick={listening ? stop : handleStart}
        disabled={disabled}
        className={`w-full btn ${listening ? 'bg-red-500/90 text-white' : 'btn-primary'} flex items-center justify-center gap-2`}
      >
        {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        {listening ? 'Stop' : 'Speak your move'}
      </button>

      {transcript && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-black/5 dark:bg-white/5 text-sm">
          <span className="opacity-60 text-xs">You said:</span> {transcript}
          {confidence > 0 && <span className="ml-2 text-xs opacity-60">({Math.round(confidence * 100)}%)</span>}
        </div>
      )}

      <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        Try: <span className="font-mono">"e2 e4"</span>, <span className="font-mono">"knight to f3"</span>, <span className="font-mono">"short castle"</span>
      </div>

      {history.length > 0 && (
        <div className="mt-3 text-xs space-y-1 opacity-70">
          {history.map((h, i) => <div key={i}>· {h}</div>)}
        </div>
      )}
    </div>
  );
}
