'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import ChessBoard from '@/components/ChessBoard';
import GameInfo from '@/components/GameInfo';
import MoveHistory from '@/components/MoveHistory';
import VoiceControl from '@/components/VoiceControl';
import VoiceChat from '@/components/VoiceChat';
import PsychoReport from '@/components/PsychoReport';
import AICoach from '@/components/AICoach';
import InterviewPanel from '@/components/InterviewPanel';
import { useGameStore } from '@/store/gameStore';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useT } from '@/components/LanguageProvider';
import { Briefcase, Copy, Users } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OnlineRoom() {
  const { room } = useParams<{ room: string }>();
  const searchParams = useSearchParams();
  const { reset, makeMove, fen, history } = useGameStore();
  const t = useT();
  const [side, setSide] = useState<'white' | 'black'>('white');
  const [opponentJoined, setOpponentJoined] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const channelRef = useRef<any>(null);
  const startedAtRef = useRef<number>(Date.now());

  const isInterview = useMemo(() => {
    if (searchParams.get('mode') === 'interview') return true;
    if (typeof window !== 'undefined' && localStorage.getItem(`pvc-mode-${room}`) === 'interview') return true;
    return false;
  }, [room, searchParams]);

  const isHost = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`pvc-host-${room}`) === '1';
  }, [room]);

  useEffect(() => {
    reset();
    startedAtRef.current = Date.now();
    if (!isSupabaseConfigured) {
      toast(t('online.notConfigured'), { icon: '⚠️' });
      return;
    }

    const channel = supabase.channel(`room:${room}`, { config: { broadcast: { self: false }, presence: { key: crypto.randomUUID() } } });
    channel
      .on('broadcast', { event: 'move' }, ({ payload }: any) => {
        if (payload?.from && payload?.to) {
          makeMove({ from: payload.from, to: payload.to, promotion: payload.promotion ?? 'q' });
        }
      })
      .on('broadcast', { event: 'side' }, ({ payload }: any) => {
        if (payload?.assignedTo === 'opponent') setSide('black');
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setOpponentJoined(Object.keys(state).length > 1);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ joinedAt: Date.now() });
        }
      });

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [room, reset, makeMove, t]);

  // Auto-enable voice chat in interview mode for both sides — natural HR convo.
  useEffect(() => {
    if (isInterview && opponentJoined) setVoiceEnabled(true);
  }, [isInterview, opponentJoined]);

  const onMove = (m: { from: string; to: string }) => {
    channelRef.current?.send({ type: 'broadcast', event: 'move', payload: m });
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success(t('online.copied'));
  };

  const youLabel = t('play.you');
  const oppLabel = t('play.opponent');

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
        <h1 className="text-2xl md:text-3xl font-display font-bold flex items-center gap-2">
          {isInterview
            ? <Briefcase className="w-6 h-6 text-amber-500" />
            : <Users className="w-6 h-6 text-accent-500" />}
          {t('online.room')} <span className="font-mono text-accent-500">{room}</span>
        </h1>
        <div className="flex gap-2">
          <button onClick={copyLink} className="btn-ghost flex items-center gap-2"><Copy className="w-4 h-4" /> {t('online.copy')}</button>
          <button onClick={() => setVoiceEnabled((v) => !v)} className={voiceEnabled ? 'btn-primary' : 'btn-ghost'}>
            {voiceEnabled ? t('online.voiceOn') : t('online.enableVoice')}
          </button>
        </div>
      </div>

      {isInterview && (
        <div className="card mb-4 border border-amber-500/40 bg-amber-500/5">
          <div className="flex items-center gap-2 text-amber-500 font-semibold mb-1">
            <Briefcase className="w-4 h-4" /> {t('interview.banner')}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            {isHost ? t('interview.banner.host') : t('interview.banner.candidate')}
          </p>
        </div>
      )}

      {!opponentJoined && (
        <div className="card mb-4 text-sm text-amber-500">
          {t('online.waiting')}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          <ChessBoard orientation={side} onMove={onMove} />
        </div>
        <div className="space-y-4">
          <GameInfo white={side === 'white' ? youLabel : oppLabel} black={side === 'white' ? oppLabel : youLabel} />
          <VoiceChat roomId={room as string} enabled={voiceEnabled} signalingChannel={channelRef.current} />
          <VoiceControl onMove={onMove} />
          {isInterview && isHost && (
            <InterviewPanel
              startedAt={startedAtRef.current}
              candidateLabel={oppLabel}
            />
          )}
          <MoveHistory />
          {!isInterview && <PsychoReport side={side === 'white' ? 'w' : 'b'} />}
          {!isInterview && <AICoach white={side === 'white' ? youLabel : oppLabel} black={side === 'white' ? oppLabel : youLabel} />}
        </div>
      </div>
    </div>
  );
}
