'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { quickProfileFromMoves, aggregateEmotion } from '@/lib/psychoAnalyzer';
import type { PsychoProfile } from '@/types';
import { Brain, Activity, Zap, Shield, Compass } from 'lucide-react';

const StatBar = ({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) => (
  <div>
    <div className="flex items-center justify-between text-xs mb-1.5">
      <span className="flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" /> {label}</span>
      <span className="font-mono">{value}/10</span>
    </div>
    <div className="h-2 rounded-full bg-gray-200 dark:bg-dark-600 overflow-hidden">
      <div className={`h-full ${color}`} style={{ width: `${value * 10}%` }} />
    </div>
  </div>
);

export default function PsychoReport() {
  const { history, isGameOver } = useGameStore();
  const [profile, setProfile] = useState<PsychoProfile | null>(null);

  useEffect(() => {
    if (history.length >= 4) {
      const emotion = aggregateEmotion(history);
      const p = quickProfileFromMoves({ moves: history, emotionAvg: emotion });
      setProfile(p);
    }
  }, [history, isGameOver]);

  if (!profile) {
    return (
      <div className="card">
        <h3 className="font-semibold mb-2 flex items-center gap-2"><Brain className="w-4 h-4 text-accent-500" /> Psychological Passport</h3>
        <p className="text-sm text-gray-500">Make a few moves to start the analysis.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="font-semibold mb-2 flex items-center gap-2"><Brain className="w-4 h-4 text-accent-500" /> Psychological Passport</h3>
      <div className="text-sm mb-4 px-3 py-2 rounded-lg bg-accent-500/10 text-accent-300 dark:text-accent-300">
        Style: <strong>{profile.cognitiveStyle}</strong>
      </div>
      <div className="space-y-3">
        <StatBar label="Risk Tolerance" value={profile.riskTolerance} icon={Zap} color="bg-gradient-to-r from-amber-500 to-red-500" />
        <StatBar label="Stress Level" value={profile.stressLevel} icon={Activity} color="bg-gradient-to-r from-rose-500 to-purple-500" />
        <StatBar label="Impulsivity" value={profile.impulsivity} icon={Compass} color="bg-gradient-to-r from-cyan-500 to-blue-500" />
        <StatBar label="Patience" value={profile.patience} icon={Shield} color="bg-gradient-to-r from-emerald-500 to-teal-500" />
        <StatBar label="Adaptability" value={profile.adaptability} icon={Brain} color="bg-gradient-to-r from-violet-500 to-fuchsia-500" />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 leading-relaxed">{profile.summary}</p>
    </div>
  );
}
