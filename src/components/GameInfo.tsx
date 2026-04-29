'use client';

import { useGameStore } from '@/store/gameStore';
import { evalToText } from '@/lib/chessUtils';
import { useT } from './LanguageProvider';
import { motion } from 'framer-motion';

interface Props {
  white: string;
  black: string;
  evalCp?: number | null;
  evalMate?: number | null;
}

export default function GameInfo({ white, black, evalCp = null, evalMate = null }: Props) {
  const { chess, history, isGameOver, result } = useGameStore();
  const t = useT();
  const turn = chess.turn();
  const inCheck = chess.inCheck();

  const evalText = evalToText(evalCp, evalMate, 'w');
  const evalScore = evalMate !== null ? (evalMate > 0 ? 100 : -100) : (evalCp ?? 0) / 100;
  const barPos = Math.max(-5, Math.min(5, evalScore)) * 10 + 50;

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-2 ${turn === 'b' ? 'opacity-100' : 'opacity-40'}`}>
          <div className="w-3 h-3 rounded-full bg-gray-900 border-2 border-white" />
          <span className="font-medium">{black}</span>
        </div>
        {turn === 'b' && !isGameOver && (
          <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }} className="text-xs text-accent-500">
            {t('gameinfo.thinking')}
          </motion.span>
        )}
      </div>

      <div className="relative h-2 rounded-full bg-gray-300 dark:bg-dark-600 overflow-hidden">
        <motion.div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-white to-gray-200"
          animate={{ width: `${barPos}%` }}
          transition={{ duration: 0.4 }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono mix-blend-difference text-white">
          {evalText}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-2 ${turn === 'w' ? 'opacity-100' : 'opacity-40'}`}>
          <div className="w-3 h-3 rounded-full bg-white border-2 border-gray-700" />
          <span className="font-medium">{white}</span>
        </div>
        {turn === 'w' && !isGameOver && (
          <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }} className="text-xs text-accent-500">
            {t('gameinfo.thinking')}
          </motion.span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {inCheck && <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-400">{t('gameinfo.check')}</span>}
        {isGameOver && <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-400">{t('gameinfo.gameOver')} · {result ?? '—'}</span>}
        <span className="px-2 py-1 rounded-full bg-primary-500/20 text-primary-500">{t('gameinfo.move')} {Math.ceil(history.length / 2) + 1}</span>
      </div>
    </div>
  );
}
