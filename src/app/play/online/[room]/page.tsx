'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import ChessBoard from '@/components/ChessBoard';
import GameInfo from '@/components/GameInfo';
import MoveHistory from '@/components/MoveHistory';
import VoiceControl from '@/components/VoiceControl';
import VoiceChat from '@/components/VoiceChat';
import PsychoReport from '@/components/PsychoReport';
import AICoach from '@/components/AICoach';
import { useGameStore } from '@/store/gameStore';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Copy, Users } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OnlineRoom() {
  const { room } = useParams<{ room: string }>();
  const { reset, makeMove, fen, history } = useGameStore();
  const [side, setSide] = useState<'white' | 'black'>('white');
  const [opponentJoined, setOpponentJoined] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    reset();
    if (!isSupabaseConfigured) {
      toast('Supabase not configured — running in offline preview', { icon: '⚠️' });
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
        // first joiner becomes white
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
  }, [room, reset, makeMove]);

  const onMove = (m: { from: string; to: string }) => {
    channelRef.current?.send({ type: 'broadcast', event: 'move', payload: m });
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied!');
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
        <h1 className="text-2xl md:text-3xl font-display font-bold flex items-center gap-2">
          <Users className="w-6 h-6 text-accent-500" /> Room <span className="font-mono text-accent-500">{room}</span>
        </h1>
        <div className="flex gap-2">
          <button onClick={copyLink} className="btn-ghost flex items-center gap-2"><Copy className="w-4 h-4" /> Copy link</button>
          <button onClick={() => setVoiceEnabled((v) => !v)} className={voiceEnabled ? 'btn-primary' : 'btn-ghost'}>
            {voiceEnabled ? 'Voice on' : 'Enable voice chat'}
          </button>
        </div>
      </div>

      {!opponentJoined && (
        <div className="card mb-4 text-sm text-amber-500">
          Waiting for opponent. Share the link above.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          <ChessBoard orientation={side} onMove={onMove} />
        </div>
        <div className="space-y-4">
          <GameInfo white={side === 'white' ? 'You' : 'Opponent'} black={side === 'white' ? 'Opponent' : 'You'} />
          <VoiceChat roomId={room as string} enabled={voiceEnabled} signalingChannel={channelRef.current} />
          <VoiceControl onMove={onMove} />
          <MoveHistory />
          <PsychoReport />
          <AICoach white={side === 'white' ? 'You' : 'Opponent'} black={side === 'white' ? 'Opponent' : 'You'} />
        </div>
      </div>
    </div>
  );
}
