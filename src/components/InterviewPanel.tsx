'use client';

import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useLanguage } from './LanguageProvider';
import { buildPgn, pgnHeaders } from '@/lib/chessUtils';
import { Briefcase, Clock, Loader2, Sparkles } from 'lucide-react';

interface Props {
  startedAt: number;
  budgetSec?: number;
  candidateLabel?: string;
}

const DEFAULT_BUDGET = 300; // 5 min

function formatMs(ms: number) {
  const sec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function InterviewPanel({ startedAt, budgetSec = DEFAULT_BUDGET, candidateLabel }: Props) {
  const { history } = useGameStore();
  const { locale, t } = useLanguage();
  const [now, setNow] = useState(() => Date.now());
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    const total = history.length;
    const fast = history.filter((m) => m.thinkMs < 2500).length;
    const slow = history.filter((m) => m.thinkMs > 15000).length;
    const avgMs = total ? history.reduce((a, m) => a + m.thinkMs, 0) / total : 0;
    const captures = history.filter((m) => /x/.test(m.san)).length;
    const checks = history.filter((m) => /\+/.test(m.san)).length;
    const voiced = history.filter((m) => m.emotion?.raw).length;
    const lastSpoken = [...history].reverse().find((m) => m.emotion?.raw)?.emotion?.raw ?? null;
    return { total, fast, slow, avgMs, captures, checks, voiced, lastSpoken };
  }, [history]);

  const elapsedMs = now - startedAt;
  const elapsedSec = elapsedMs / 1000;
  const budgetMs = budgetSec * 1000;
  const overBudget = elapsedMs > budgetMs;
  const progressPct = Math.min(100, (elapsedMs / budgetMs) * 100);

  const generateReport = async () => {
    setLoading(true);
    setReport(null);
    try {
      const pgn = buildPgn(
        history.map((h) => ({ san: h.san })),
        pgnHeaders({ white: 'White', black: 'Black' })
      );
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moves: history, pgn, durationSec: elapsedSec, locale }),
      });
      const j = await res.json();
      setReport(j.report ?? '');
    } catch (e: any) {
      setReport(`Error: ${e?.message ?? 'unknown'}`);
    } finally {
      setLoading(false);
    }
  };

  const Stat = ({ label, value }: { label: string; value: string | number }) => (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );

  return (
    <div className="card border border-amber-500/30">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-amber-500" />
          {t('interview.title')}
          {candidateLabel && <span className="text-xs text-gray-500 font-normal">— {candidateLabel}</span>}
        </h3>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {t('interview.elapsed')}</span>
          <span className={`font-mono ${overBudget ? 'text-red-400' : ''}`}>
            {formatMs(elapsedMs)} / {formatMs(budgetMs)}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-200 dark:bg-dark-600 overflow-hidden">
          <div
            className={`h-full transition-all ${overBudget ? 'bg-red-500' : 'bg-gradient-to-r from-amber-500 to-orange-500'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="space-y-1.5 mb-4">
        <Stat label={t('interview.totalMoves')} value={stats.total} />
        <Stat label={t('interview.avgThink')} value={`${(stats.avgMs / 1000).toFixed(1)}s`} />
        <Stat label={t('interview.impulsive')} value={`${stats.fast}${stats.total ? ` (${Math.round((stats.fast / stats.total) * 100)}%)` : ''}`} />
        <Stat label={t('interview.deep')} value={`${stats.slow}${stats.total ? ` (${Math.round((stats.slow / stats.total) * 100)}%)` : ''}`} />
        <Stat label={t('interview.captures')} value={stats.captures} />
        <Stat label={t('interview.checks')} value={stats.checks} />
        <Stat label={t('interview.voiced')} value={`${stats.voiced} / ${stats.total}`} />
      </div>

      {stats.lastSpoken && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-amber-500/10 text-xs">
          <div className="text-gray-500 mb-0.5">{t('interview.lastSpoken')}</div>
          <div className="italic">&ldquo;{stats.lastSpoken}&rdquo;</div>
        </div>
      )}

      <button
        onClick={generateReport}
        disabled={loading || stats.total < 2}
        className="btn-primary w-full text-sm flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {loading ? t('interview.generating') : report ? t('interview.regenerate') : t('interview.generate')}
      </button>

      {report && (
        <div className="mt-4">
          <div className="text-xs font-semibold text-gray-500 mb-2">{t('interview.report')}</div>
          <div className="text-sm whitespace-pre-line leading-relaxed">{report}</div>
          <p className="text-[10px] text-gray-500 mt-3 italic">{t('interview.disclaimer')}</p>
        </div>
      )}
    </div>
  );
}
