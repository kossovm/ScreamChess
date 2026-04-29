'use client';

import { Clock } from 'lucide-react';

interface Props {
  whiteMs: number;
  blackMs: number;
  active: 'w' | 'b' | null;
  whiteLabel?: string;
  blackLabel?: string;
}

function fmt(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m >= 10) return `${m}:${String(s).padStart(2, '0')}`;
  // sub-10-minute format with deciseconds when low
  if (total <= 10) {
    const tenths = Math.max(0, Math.floor(ms / 100)) % 10;
    return `${m}:${String(s).padStart(2, '0')}.${tenths}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ChessClock({ whiteMs, blackMs, active, whiteLabel, blackLabel }: Props) {
  const cell = (ms: number, isActive: boolean, label: string | undefined, dark: boolean) => {
    const low = ms < 30_000;
    const critical = ms < 10_000;
    return (
      <div
        className={`flex-1 flex items-center justify-between px-3 py-2 rounded-xl border ${
          isActive ? 'border-accent-500/60' : 'border-white/10'
        } ${critical ? 'bg-red-500/15' : isActive ? 'bg-accent-500/10' : 'bg-black/5 dark:bg-white/5'}`}
      >
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full border ${dark ? 'bg-gray-900 border-white/40' : 'bg-white border-gray-700/40'}`} />
          {label && <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>}
        </div>
        <span className={`font-mono text-lg tabular-nums ${critical ? 'text-red-400 font-bold' : low ? 'text-amber-400' : ''}`}>
          {fmt(ms)}
        </span>
      </div>
    );
  };

  return (
    <div className="card !p-3">
      <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
        <Clock className="w-3.5 h-3.5" /> {whiteLabel && blackLabel ? `${blackLabel} / ${whiteLabel}` : 'Clock'}
      </div>
      <div className="flex flex-col gap-2">
        {cell(blackMs, active === 'b', blackLabel, true)}
        {cell(whiteMs, active === 'w', whiteLabel, false)}
      </div>
    </div>
  );
}
