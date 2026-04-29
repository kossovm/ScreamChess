'use client';

import { useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { quickProfileFromMoves, aggregateEmotion } from '@/lib/psychoAnalyzer';
import type { MoveRecord, PsychoProfile } from '@/types';
import { useT } from './LanguageProvider';
import type { TranslationKey } from '@/lib/i18n';
import { Brain, Activity, Zap, Shield, Compass } from 'lucide-react';

type Side = 'w' | 'b' | 'both';

interface Props {
  side?: Side;
  whiteName?: string;
  blackName?: string;
}

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

const STYLE_KEY: Record<PsychoProfile['cognitiveStyle'], TranslationKey> = {
  'Intuitive Strategist': 'psycho.style.intuitive',
  'Calculating Tactician': 'psycho.style.calculating',
  'Defensive Realist': 'psycho.style.defensive',
  'Aggressive Attacker': 'psycho.style.aggressive',
  'Adaptive Hybrid': 'psycho.style.adaptive',
};

function movesForSide(history: MoveRecord[], side: 'w' | 'b'): MoveRecord[] {
  return history.filter((_, i) => (side === 'w' ? i % 2 === 0 : i % 2 === 1));
}

function ProfileCard({ profile, title }: { profile: PsychoProfile; title?: string }) {
  const t = useT();
  return (
    <div className="space-y-3">
      {title && <div className="text-sm font-semibold opacity-80">{title}</div>}
      <div className="text-sm px-3 py-2 rounded-lg bg-accent-500/10 text-accent-300 dark:text-accent-300">
        {t('psycho.style')}: <strong>{t(STYLE_KEY[profile.cognitiveStyle])}</strong>
      </div>
      <StatBar label={t('psycho.risk')} value={profile.riskTolerance} icon={Zap} color="bg-gradient-to-r from-amber-500 to-red-500" />
      <StatBar label={t('psycho.stress')} value={profile.stressLevel} icon={Activity} color="bg-gradient-to-r from-rose-500 to-purple-500" />
      <StatBar label={t('psycho.impulsivity')} value={profile.impulsivity} icon={Compass} color="bg-gradient-to-r from-cyan-500 to-blue-500" />
      <StatBar label={t('psycho.patience')} value={profile.patience} icon={Shield} color="bg-gradient-to-r from-emerald-500 to-teal-500" />
      <StatBar label={t('psycho.adaptability')} value={profile.adaptability} icon={Brain} color="bg-gradient-to-r from-violet-500 to-fuchsia-500" />
    </div>
  );
}

export default function PsychoReport({ side = 'both', whiteName, blackName }: Props) {
  const { history } = useGameStore();
  const t = useT();

  const profiles = useMemo(() => {
    if (side === 'both') {
      const w = movesForSide(history, 'w');
      const b = movesForSide(history, 'b');
      return {
        w: w.length >= 2 ? quickProfileFromMoves({ moves: w, emotionAvg: aggregateEmotion(w) }) : null,
        b: b.length >= 2 ? quickProfileFromMoves({ moves: b, emotionAvg: aggregateEmotion(b) }) : null,
      };
    }
    const filtered = movesForSide(history, side);
    return {
      single: filtered.length >= 2 ? quickProfileFromMoves({ moves: filtered, emotionAvg: aggregateEmotion(filtered) }) : null,
    };
  }, [history, side]);

  const empty = side === 'both' ? !profiles.w && !profiles.b : !(profiles as any).single;

  if (empty) {
    return (
      <div className="card">
        <h3 className="font-semibold mb-2 flex items-center gap-2"><Brain className="w-4 h-4 text-accent-500" /> {t('psycho.title')}</h3>
        <p className="text-sm text-gray-500">{t('psycho.empty')}</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="font-semibold mb-3 flex items-center gap-2"><Brain className="w-4 h-4 text-accent-500" /> {t('psycho.title')}</h3>
      {side === 'both' ? (
        <div className="space-y-5">
          {profiles.w && (
            <ProfileCard profile={profiles.w} title={whiteName ?? t('play.local.player1')} />
          )}
          {profiles.w && profiles.b && <div className="h-px bg-white/10" />}
          {profiles.b && (
            <ProfileCard profile={profiles.b} title={blackName ?? t('play.local.player2')} />
          )}
        </div>
      ) : (
        (profiles as any).single && <ProfileCard profile={(profiles as any).single} />
      )}
    </div>
  );
}
