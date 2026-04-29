'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuid } from 'uuid';
import { Briefcase, Coins, Eye, EyeOff, Link2, Loader2, Plus, Star, Swords } from 'lucide-react';
import toast from 'react-hot-toast';
import { useT } from '@/components/LanguageProvider';
import { useAuth } from '@/hooks/useAuth';
import { useUserEconomy } from '@/hooks/useUserEconomy';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const STAKE_OPTIONS = [0, 50, 100, 250, 500, 1000];

interface OpenLobby {
  room_id: string;
  host_id: string;
  host_name: string | null;
  host_rating: number | null;
  stake: number;
  time_control_sec: number;
  mode: string;
}

export default function OnlineLobby() {
  const router = useRouter();
  const t = useT();
  const { user } = useAuth();
  const { economy } = useUserEconomy();

  const [code, setCode] = useState('');
  const [stake, setStake] = useState<number>(0);
  const [privacy, setPrivacy] = useState<'open' | 'closed'>('open');
  const [searching, setSearching] = useState(false);
  const [openLobbies, setOpenLobbies] = useState<OpenLobby[]>([]);
  const matchChannelRef = useRef<any>(null);

  // Live subscription to public lobby list
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const refresh = async () => {
      const { data } = await supabase
        .from('open_lobbies')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      setOpenLobbies((data ?? []) as OpenLobby[]);
    };
    refresh();

    const ch = supabase
      .channel('open-lobbies-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'open_lobbies' }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const setupHostMeta = (id: string, opts: { mode?: 'interview' | 'rated' | 'casual'; opponentId?: string; stake?: number; privacy?: 'open' | 'closed' }) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`pvc-host-${id}`, '1');
    if (opts.mode) localStorage.setItem(`pvc-mode-${id}`, opts.mode);
    if (opts.opponentId) localStorage.setItem(`pvc-opp-${id}`, opts.opponentId);
    if (opts.stake !== undefined) localStorage.setItem(`pvc-stake-${id}`, String(opts.stake));
    if (opts.privacy) localStorage.setItem(`pvc-privacy-${id}`, opts.privacy);
  };

  const create = async (mode?: 'interview') => {
    const id = uuid().slice(0, 8);
    if (mode === 'interview') {
      setupHostMeta(id, { mode: 'interview' });
      router.push(`/play/online/${id}?mode=interview`);
      return;
    }
    if (stake > 0) {
      if (!user) {
        toast.error(t('online.signInRequired'));
        return;
      }
      if (!economy || economy.coins < stake) {
        toast.error(t('online.notEnoughCoins'));
        return;
      }
    }
    const isRated = stake > 0;
    setupHostMeta(id, { mode: isRated ? 'rated' : 'casual', stake, privacy });
    if (privacy === 'open' && user) {
      // Try to publish to the open-lobbies feed; non-fatal if it fails.
      const { error } = await supabase.from('open_lobbies').insert({
        room_id: id,
        host_id: user.id,
        host_name: user.email?.split('@')[0] ?? 'player',
        host_rating: economy?.rating ?? 10,
        stake,
        mode: isRated ? 'rated' : 'casual',
      });
      if (error) console.warn('open_lobbies insert failed:', error.message);
    }
    const params = new URLSearchParams();
    if (isRated) params.set('rated', '1');
    if (stake > 0) params.set('stake', String(stake));
    const qs = params.toString();
    router.push(`/play/online/${id}${qs ? `?${qs}` : ''}`);
  };

  const joinLobby = (lobby: OpenLobby) => {
    if (!user) {
      toast.error(t('online.signInRequired'));
      return;
    }
    if (lobby.stake > 0 && (!economy || economy.coins < lobby.stake)) {
      toast.error(t('online.notEnoughCoins'));
      return;
    }
    const params = new URLSearchParams();
    if (lobby.mode === 'rated') params.set('rated', '1');
    if (lobby.stake > 0) params.set('stake', String(lobby.stake));
    if (typeof window !== 'undefined') {
      localStorage.setItem(`pvc-mode-${lobby.room_id}`, lobby.mode);
      localStorage.setItem(`pvc-stake-${lobby.room_id}`, String(lobby.stake));
      localStorage.setItem(`pvc-opp-${lobby.room_id}`, lobby.host_id);
    }
    router.push(`/play/online/${lobby.room_id}?${params.toString()}`);
  };

  const join = () => {
    if (!code.trim()) {
      toast.error(t('online.enterCode'));
      return;
    }
    router.push(`/play/online/${code.trim()}`);
  };

  // Matchmaking
  const startSearch = async () => {
    if (!user) {
      toast.error(t('online.signInRequired'));
      return;
    }
    if (!isSupabaseConfigured) {
      toast.error('Supabase not configured');
      return;
    }
    setSearching(true);

    const channel = supabase.channel('matchmaking-rated', {
      config: { presence: { key: user.id }, broadcast: { self: false } },
    });
    matchChannelRef.current = channel;
    let matched = false;

    const tryPair = () => {
      if (matched) return;
      const state = channel.presenceState() as Record<string, Array<{ joinedAt: number; rating: number }>>;
      const waiting = Object.entries(state)
        .map(([key, vs]) => ({ key, joinedAt: vs[0]?.joinedAt ?? 0, rating: vs[0]?.rating ?? 0 }))
        .sort((a, b) => a.joinedAt - b.joinedAt);
      if (waiting.length < 2) return;
      if (waiting[0].key !== user.id) return;
      const other = waiting.find((w) => w.key !== user.id);
      if (!other) return;
      const roomId = uuid().slice(0, 8);
      matched = true;
      setupHostMeta(roomId, { mode: 'rated', opponentId: other.key });
      channel.send({ type: 'broadcast', event: 'matched', payload: { roomId, hostId: user.id, opponentId: other.key } });
      toast.success(t('online.matched'));
      setTimeout(() => {
        supabase.removeChannel(channel);
        matchChannelRef.current = null;
        router.push(`/play/online/${roomId}?rated=1`);
      }, 200);
    };

    channel
      .on('presence', { event: 'sync' }, () => tryPair())
      .on('broadcast', { event: 'matched' }, ({ payload }: any) => {
        if (matched) return;
        if (payload?.opponentId === user.id && payload?.roomId) {
          matched = true;
          if (typeof window !== 'undefined') {
            localStorage.setItem(`pvc-mode-${payload.roomId}`, 'rated');
            if (payload.hostId) localStorage.setItem(`pvc-opp-${payload.roomId}`, payload.hostId);
          }
          toast.success(t('online.matched'));
          supabase.removeChannel(channel);
          matchChannelRef.current = null;
          router.push(`/play/online/${payload.roomId}?rated=1`);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ joinedAt: Date.now(), rating: economy?.rating ?? 10 });
        }
      });
  };

  const cancelSearch = () => {
    if (matchChannelRef.current) {
      supabase.removeChannel(matchChannelRef.current);
      matchChannelRef.current = null;
    }
    setSearching(false);
  };

  useEffect(() => () => {
    if (matchChannelRef.current) supabase.removeChannel(matchChannelRef.current);
  }, []);

  const visibleLobbies = openLobbies.filter((l) => !user || l.host_id !== user.id);

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-3xl font-display font-bold mb-2">{t('online.title')}</h1>
      <p className="text-gray-500 mb-6">{t('online.subtitle')}</p>

      {/* Player badge */}
      <div className="card mb-6 flex items-center justify-between">
        {user ? (
          <div>
            <div className="text-sm text-gray-500 mb-0.5">{user.email}</div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-sm">
                <Star className="w-4 h-4 text-amber-500" /> <strong>{economy?.rating ?? '…'}</strong>
              </span>
              <span className="flex items-center gap-1.5 text-sm">
                <Coins className="w-4 h-4 text-yellow-500" /> <strong>{economy?.coins ?? '…'}</strong>
              </span>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            {t('online.signInRequired')} ·{' '}
            <a href="/login" className="text-accent-500 hover:underline">{t('header.signin')}</a>
          </div>
        )}
      </div>

      {/* Open lobby browser */}
      <div className="card mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="w-4 h-4 text-emerald-500" />
          <h2 className="font-semibold">{t('online.openLobbies')}</h2>
          <span className="text-xs text-gray-500">{visibleLobbies.length}</span>
        </div>
        {visibleLobbies.length === 0 ? (
          <p className="text-sm text-gray-500">{t('online.openLobbies.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {visibleLobbies.map((l) => (
              <li key={l.room_id} className="flex items-center justify-between border-t border-white/10 pt-2 first:border-0 first:pt-0">
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  <span className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-500" /> <strong>{l.host_rating ?? '?'}</strong>
                  </span>
                  <span className="text-gray-500">{t('online.openLobbies.host')}:</span>
                  <span className="font-medium">{l.host_name ?? '—'}</span>
                  {l.stake > 0 && (
                    <span className="flex items-center gap-1 text-yellow-500">
                      <Coins className="w-3.5 h-3.5" /> {l.stake}
                    </span>
                  )}
                  {l.mode === 'rated' && (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500">
                      {t('online.ratedBadge')}
                    </span>
                  )}
                </div>
                <button onClick={() => joinLobby(l)} className="btn-primary text-xs py-1.5 px-3">
                  {t('online.openLobbies.join')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Find opponent — primary */}
        <button
          onClick={searching ? cancelSearch : startSearch}
          className={`card text-left transition-transform md:col-span-2 ${
            searching ? '' : 'hover:scale-[1.01]'
          } ${searching ? 'border-2 border-amber-500/50' : 'border border-amber-500/30'}`}
        >
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/20">
              {searching ? <Loader2 className="w-7 h-7 text-white animate-spin" /> : <Swords className="w-7 h-7 text-white" />}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold mb-1">
                {searching ? t('online.searching') : t('online.findOpponent')}
              </h3>
              <p className="text-sm text-gray-500">{t('online.findOpponent.desc')}</p>
              {searching && (
                <span className="inline-block mt-2 text-xs text-amber-500 underline">{t('online.cancelSearch')}</span>
              )}
            </div>
          </div>
        </button>

        {/* Create custom room */}
        <div className="card">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-500 to-pink-500 flex items-center justify-center mb-3">
            <Plus className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-semibold mb-1">{t('online.create')}</h3>
          <p className="text-sm text-gray-500 mb-3">{t('online.create.desc')}</p>

          {user && (
            <>
              <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-1">{t('online.stake.label')}</label>
                <div className="flex flex-wrap gap-1.5">
                  {STAKE_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStake(s)}
                      className={`text-xs py-1 px-2.5 rounded-full transition ${
                        stake === s ? 'bg-amber-500 text-white' : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
                      }`}
                      disabled={!!economy && s > economy.coins}
                    >
                      {s === 0 ? '0 💰' : `${s} 💰`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-1">{t('online.privacy')}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPrivacy('open')}
                    className={`text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                      privacy === 'open' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-black/5 dark:bg-white/5 border border-transparent'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" /> {t('online.privacy.open')}
                  </button>
                  <button
                    onClick={() => setPrivacy('closed')}
                    className={`text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                      privacy === 'closed' ? 'bg-gray-500/20 text-gray-300 border border-gray-500/40' : 'bg-black/5 dark:bg-white/5 border border-transparent'
                    }`}
                  >
                    <EyeOff className="w-3.5 h-3.5" /> {t('online.privacy.closed')}
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5">
                  {privacy === 'open' ? t('online.privacy.openHint') : t('online.privacy.closedHint')}
                </p>
              </div>
            </>
          )}

          <button onClick={() => create()} className="btn-primary w-full">{t('online.create')}</button>
        </div>

        {/* Interview mode */}
        <button onClick={() => create('interview')} className="card text-left hover:scale-[1.02] transition-transform border border-amber-500/40">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mb-3">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-semibold mb-1">{t('online.create.interview')}</h3>
          <p className="text-sm text-gray-500">{t('online.create.interview.desc')}</p>
        </button>

        {/* Join by code */}
        <div className="card md:col-span-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center">
              <Link2 className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold">{t('online.join')}</h3>
          </div>
          <div className="flex gap-2">
            <input
              placeholder={t('online.roomCode')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="input flex-1"
              onKeyDown={(e) => e.key === 'Enter' && join()}
            />
            <button onClick={join} className="btn-primary">{t('online.join.cta')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
