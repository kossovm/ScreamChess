'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import ChessBoard from '@/components/ChessBoard';
import ChessClock from '@/components/ChessClock';
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
import { Briefcase, CheckCircle2, Circle, Copy, Eye, Users } from 'lucide-react';
import toast from 'react-hot-toast';

type Role = 'w' | 'b' | 'spectator';

interface PresenceRow {
  key: string;
  joinedAt: number;
  ready: boolean;
}

const TIME_OPTIONS_SEC = [60, 180, 300, 600, 1800, 0]; // 1m, 3m, 5m, 10m, 30m, unlimited

export default function OnlineRoom() {
  const { room } = useParams<{ room: string }>();
  const searchParams = useSearchParams();
  const { reset, makeMove, fen, history, undo, chess, isGameOver, turnStartedAt } = useGameStore();
  const t = useT();

  const isInterview = useMemo(() => {
    if (searchParams.get('mode') === 'interview') return true;
    if (typeof window !== 'undefined' && localStorage.getItem(`pvc-mode-${room}`) === 'interview') return true;
    return false;
  }, [room, searchParams]);

  const isHost = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`pvc-host-${room}`) === '1';
  }, [room]);

  // Stable per-room presence key (survives reload).
  const presenceKey = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const k = `pvc-presence-${room}`;
    let v = localStorage.getItem(k);
    if (!v) {
      v = (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
      localStorage.setItem(k, v);
    }
    return v;
  }, [room]);

  const joinedAt = useMemo(() => {
    if (typeof window === 'undefined') return Date.now();
    const k = `pvc-joined-${room}`;
    const stored = localStorage.getItem(k);
    if (stored) return parseInt(stored, 10);
    const t = Date.now();
    localStorage.setItem(k, String(t));
    return t;
  }, [room]);

  const [members, setMembers] = useState<PresenceRow[]>([]);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const channelRef = useRef<any>(null);

  const [timeControlSec, setTimeControlSec] = useState<number>(isInterview ? 300 : 300);
  const [gameStarted, setGameStarted] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [iAmReady, setIAmReady] = useState(false);
  const [timeoutLoser, setTimeoutLoser] = useState<'w' | 'b' | null>(null);

  // Derive my role from sorted member list.
  const myRank = members.findIndex((m) => m.key === presenceKey);
  const role: Role = myRank === 0 ? 'w' : myRank === 1 ? 'b' : 'spectator';
  const isPlayer = role === 'w' || role === 'b';
  const orientation: 'white' | 'black' = role === 'b' ? 'black' : 'white';

  const whitePlayer = members[0];
  const blackPlayer = members[1];
  const opponent = role === 'w' ? blackPlayer : role === 'b' ? whitePlayer : null;
  const opponentReady = opponent?.ready ?? false;
  const bothPlayersPresent = !!whitePlayer && !!blackPlayer;

  // Tick clock
  useEffect(() => {
    if (!gameStarted || isGameOver) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [gameStarted, isGameOver]);

  // Reset board state when entering room
  useEffect(() => {
    reset();
    setGameStarted(false);
    setStartedAt(null);
    setIAmReady(false);
    setTimeoutLoser(null);
  }, [room, reset]);

  // Subscribe to channel
  useEffect(() => {
    if (!isSupabaseConfigured) {
      toast(t('online.notConfigured'), { icon: '⚠️' });
      return;
    }

    const channel = supabase.channel(`room:${room}`, {
      config: { broadcast: { self: false }, presence: { key: presenceKey } },
    });

    channel
      .on('broadcast', { event: 'move' }, ({ payload }: any) => {
        if (payload?.from && payload?.to) {
          makeMove({ from: payload.from, to: payload.to, promotion: payload.promotion ?? 'q' });
        }
      })
      .on('broadcast', { event: 'undo' }, ({ payload }: any) => {
        const count = Math.max(1, payload?.count ?? 1);
        const popped = undo(count);
        if (popped > 0) toast(`↩️ ${t('online.undoApplied')}`);
      })
      .on('broadcast', { event: 'start' }, ({ payload }: any) => {
        if (typeof payload?.startedAt === 'number') {
          reset();
          setTimeControlSec(payload.timeControlSec ?? 300);
          setStartedAt(payload.startedAt);
          setGameStarted(true);
          setTimeoutLoser(null);
        }
      })
      .on('broadcast', { event: 'time-flag' }, ({ payload }: any) => {
        if (payload?.loser === 'w' || payload?.loser === 'b') {
          setTimeoutLoser(payload.loser);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, Array<{ joinedAt: number; ready: boolean }>>;
        const list: PresenceRow[] = Object.entries(state).flatMap(([key, vs]) =>
          vs.map((v) => ({ key, joinedAt: v.joinedAt ?? 0, ready: !!v.ready }))
        );
        list.sort((a, b) => a.joinedAt - b.joinedAt || a.key.localeCompare(b.key));
        setMembers(list);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ joinedAt, ready: false });
        }
      });

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, presenceKey, joinedAt]);

  // Update presence whenever ready flag changes
  useEffect(() => {
    const ch = channelRef.current;
    if (!ch) return;
    ch.track({ joinedAt, ready: iAmReady });
  }, [iAmReady, joinedAt]);

  // Auto-start when both players ready (both clients agree by checking presence)
  useEffect(() => {
    if (!isHost) return;
    if (gameStarted) return;
    if (!whitePlayer?.ready || !blackPlayer?.ready) return;
    // Host broadcasts the start signal so both clients reset together.
    const startAt = Date.now();
    channelRef.current?.send({
      type: 'broadcast',
      event: 'start',
      payload: { startedAt: startAt, timeControlSec },
    });
    reset();
    setStartedAt(startAt);
    setGameStarted(true);
    setTimeoutLoser(null);
    toast.success(t('online.bothReady'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whitePlayer?.ready, blackPlayer?.ready, isHost, gameStarted, timeControlSec]);

  // Auto-enable voice chat when interview mode and opponent joined
  useEffect(() => {
    if (isInterview && bothPlayersPresent) setVoiceEnabled(true);
  }, [isInterview, bothPlayersPresent]);

  // Compute clock state from history + currently elapsed
  const clock = useMemo(() => {
    if (!gameStarted || timeControlSec === 0) {
      return { whiteMs: timeControlSec * 1000, blackMs: timeControlSec * 1000, active: null as 'w' | 'b' | null };
    }
    let whiteUsed = 0;
    let blackUsed = 0;
    history.forEach((m, i) => {
      if (i % 2 === 0) whiteUsed += m.thinkMs;
      else blackUsed += m.thinkMs;
    });
    const turn = chess.turn();
    const elapsedSinceTurn = Math.max(0, now - turnStartedAt);
    const totalMs = timeControlSec * 1000;
    const whiteMs = Math.max(0, totalMs - whiteUsed - (turn === 'w' && !isGameOver ? elapsedSinceTurn : 0));
    const blackMs = Math.max(0, totalMs - blackUsed - (turn === 'b' && !isGameOver ? elapsedSinceTurn : 0));
    return { whiteMs, blackMs, active: isGameOver ? null : turn };
  }, [gameStarted, timeControlSec, history, chess, now, turnStartedAt, isGameOver]);

  // Detect time-out (only the player on the clock side detects, broadcasts once)
  const flaggedRef = useRef(false);
  useEffect(() => {
    if (!gameStarted || timeControlSec === 0 || isGameOver || timeoutLoser || flaggedRef.current) return;
    if (clock.active === 'w' && clock.whiteMs <= 0) {
      if (role === 'w') {
        flaggedRef.current = true;
        channelRef.current?.send({ type: 'broadcast', event: 'time-flag', payload: { loser: 'w' } });
      }
      setTimeoutLoser('w');
    } else if (clock.active === 'b' && clock.blackMs <= 0) {
      if (role === 'b') {
        flaggedRef.current = true;
        channelRef.current?.send({ type: 'broadcast', event: 'time-flag', payload: { loser: 'b' } });
      }
      setTimeoutLoser('b');
    }
  }, [clock, gameStarted, timeControlSec, isGameOver, timeoutLoser, role]);

  // Show toast when timeout happens
  useEffect(() => {
    if (!timeoutLoser) return;
    const youLost = timeoutLoser === role;
    toast.error(youLost ? t('online.youLostOnTime') : t('online.opponentLostOnTime'), { icon: '⏱️' });
  }, [timeoutLoser, role, t]);

  const onMove = (m: { from: string; to: string }) => {
    channelRef.current?.send({ type: 'broadcast', event: 'move', payload: m });
  };

  const broadcastUndo = (count: number) => {
    channelRef.current?.send({ type: 'broadcast', event: 'undo', payload: { count } });
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success(t('online.copied'));
  };

  // Effective game state for UI:
  const isFlagFall = !!timeoutLoser;
  const movesDisabled = !gameStarted || !isPlayer || isFlagFall;

  const whiteName = whitePlayer ? (whitePlayer.key === presenceKey ? t('play.you') : t('play.opponent')) : '—';
  const blackName = blackPlayer ? (blackPlayer.key === presenceKey ? t('play.you') : t('play.opponent')) : '—';

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
        <h1 className="text-2xl md:text-3xl font-display font-bold flex items-center gap-2">
          {isInterview ? <Briefcase className="w-6 h-6 text-amber-500" /> : <Users className="w-6 h-6 text-accent-500" />}
          {t('online.room')} <span className="font-mono text-accent-500">{room}</span>
        </h1>
        <div className="flex gap-2">
          <button onClick={copyLink} className="btn-ghost flex items-center gap-2">
            <Copy className="w-4 h-4" /> {t('online.copy')}
          </button>
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

      {!bothPlayersPresent && (
        <div className="card mb-4 text-sm text-amber-500">{t('online.waiting')}</div>
      )}

      {role === 'spectator' && (
        <div className="card mb-4 flex items-center gap-2 text-sm">
          <Eye className="w-4 h-4 text-gray-500" />
          <span>{t('online.spectatorMode')}</span>
        </div>
      )}

      {isPlayer && (
        <div className="text-sm mb-3 text-gray-600 dark:text-gray-300">
          {role === 'w' ? t('online.role.white') : t('online.role.black')}
        </div>
      )}

      {/* Pre-game ready & time control */}
      {!gameStarted && bothPlayersPresent && isPlayer && !isFlagFall && (
        <div className="card mb-4 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-center">
          <div>
            <div className="text-xs text-gray-500 mb-1">{t('online.timeControl')}</div>
            {isHost && !isInterview ? (
              <select
                value={timeControlSec}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setTimeControlSec(v);
                }}
                className="input py-1.5 text-sm w-full md:w-auto"
                disabled={iAmReady}
              >
                {TIME_OPTIONS_SEC.map((s) => (
                  <option key={s} value={s}>
                    {s === 0 ? t('online.timeControl.unlimited') : `${Math.floor(s / 60)} min`}
                  </option>
                ))}
              </select>
            ) : (
              <div className="font-mono text-sm">
                {timeControlSec === 0 ? t('online.timeControl.unlimited') : `${Math.floor(timeControlSec / 60)} min`}
                {!isHost && <span className="text-xs text-gray-500 ml-2">({t('online.waitingHost')})</span>}
              </div>
            )}
          </div>

          <div className="text-xs text-gray-500 flex items-center gap-2">
            {opponent ? (
              opponentReady ? (
                <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {t('online.opponentReady')}</span>
              ) : (
                <span className="flex items-center gap-1"><Circle className="w-3.5 h-3.5" /> {t('online.opponentNotReady')}</span>
              )
            ) : null}
          </div>

          <button
            onClick={() => setIAmReady((v) => !v)}
            className={`${iAmReady ? 'btn-primary' : 'btn-ghost'} flex items-center gap-2`}
          >
            <CheckCircle2 className="w-4 h-4" /> {iAmReady ? t('online.youReady') : t('online.ready')}
          </button>
        </div>
      )}

      {isFlagFall && (
        <div className="card mb-4 text-center text-lg font-semibold border border-red-500/40 bg-red-500/10">
          ⏱️ {t('online.flagged')} · {timeoutLoser === 'w' ? '0-1' : '1-0'}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          <ChessBoard
            orientation={orientation}
            playerSide={isPlayer ? (role as 'w' | 'b') : null}
            disabled={movesDisabled}
            onMove={onMove}
          />
          {isGameOver && (
            <div className="card text-center text-lg font-semibold">{t('play.gameOver')}</div>
          )}
        </div>
        <div className="space-y-4">
          <GameInfo white={whiteName} black={blackName} />
          {timeControlSec > 0 && (
            <ChessClock
              whiteMs={clock.whiteMs}
              blackMs={clock.blackMs}
              active={clock.active}
              whiteLabel={whiteName}
              blackLabel={blackName}
            />
          )}
          <VoiceChat roomId={room as string} enabled={voiceEnabled} signalingChannel={channelRef.current} />
          <VoiceControl
            disabled={movesDisabled}
            onMove={onMove}
            onUndo={() => {
              if (!isPlayer) return 0;
              const popped = undo(1);
              if (popped > 0) broadcastUndo(1);
              return popped;
            }}
          />
          {isInterview && isHost && (
            <InterviewPanel startedAt={startedAt ?? Date.now()} candidateLabel={role === 'w' ? blackName : whiteName} />
          )}
          <MoveHistory />
          {!isInterview && isPlayer && <PsychoReport side={role as 'w' | 'b'} />}
          {!isInterview && isPlayer && <AICoach white={whiteName} black={blackName} />}
        </div>
      </div>
    </div>
  );
}
