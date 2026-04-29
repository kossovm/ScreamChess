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
import { useAuth } from '@/hooks/useAuth';
import { useUserEconomy } from '@/hooks/useUserEconomy';
import { Briefcase, CheckCircle2, Circle, Coins, Copy, Eye, Flag, Star, Users } from 'lucide-react';
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
  const { reset, makeMove, fen, history, undo, chess, isGameOver, turnStartedAt, result, loadSans } = useGameStore();
  const t = useT();
  const { user } = useAuth();
  const { economy, applyMatchResult } = useUserEconomy();

  // Server render and first client render must match. All localStorage-derived
  // values start as neutral defaults, then real values land in a useEffect
  // after mount. This prevents hydration mismatches (React error #423) which
  // would otherwise cause the entire root to re-render and freeze interactions.
  const [isRated, setIsRated] = useState(false);
  const [stake, setStake] = useState(0);
  const [isInterview, setIsInterview] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [presenceKey, setPresenceKey] = useState('');
  const [joinedAt, setJoinedAt] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsRated(searchParams.get('rated') === '1' || localStorage.getItem(`pvc-mode-${room}`) === 'rated');

    const stakeUrl = searchParams.get('stake');
    if (stakeUrl) setStake(parseInt(stakeUrl, 10) || 0);
    else {
      const stakeStored = localStorage.getItem(`pvc-stake-${room}`);
      if (stakeStored) setStake(parseInt(stakeStored, 10) || 0);
    }

    setIsInterview(
      searchParams.get('mode') === 'interview' || localStorage.getItem(`pvc-mode-${room}`) === 'interview'
    );
    setIsHost(localStorage.getItem(`pvc-host-${room}`) === '1');

    const pkKey = `pvc-presence-${room}`;
    let pk = localStorage.getItem(pkKey);
    if (!pk) {
      pk = (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2));
      localStorage.setItem(pkKey, pk);
    }
    setPresenceKey(pk);

    const joKey = `pvc-joined-${room}`;
    const joStored = localStorage.getItem(joKey);
    if (joStored) {
      setJoinedAt(parseInt(joStored, 10));
    } else {
      const t = Date.now();
      localStorage.setItem(joKey, String(t));
      setJoinedAt(t);
    }

    setHydrated(true);
  }, [room, searchParams]);

  const [opponentUserId, setOpponentUserId] = useState<string | null>(null);
  const [resignedSide, setResignedSide] = useState<'w' | 'b' | null>(null);
  const [ratingApplied, setRatingApplied] = useState(false);
  const [ratingChange, setRatingChange] = useState<{ rating: number; coin: number } | null>(null);

  const [members, setMembers] = useState<PresenceRow[]>([]);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const channelRef = useRef<any>(null);

  const [timeControlSec, setTimeControlSec] = useState<number>(isInterview ? 300 : 300);
  const [gameStarted, setGameStarted] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [iAmReady, setIAmReady] = useState(false);
  const [timeoutLoser, setTimeoutLoser] = useState<'w' | 'b' | null>(null);
  // Mirror iAmReady in a ref so the channel.subscribe callback (which captures
  // values from its render) always tracks the latest state.
  const readyRef = useRef(iAmReady);
  useEffect(() => { readyRef.current = iAmReady; }, [iAmReady]);

  // Restore game-in-progress state on mount so a refresh doesn't lock the player
  // into "Ready" with a disabled board.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(`pvc-game-${room}`);
    if (!raw) return;
    try {
      const obj = JSON.parse(raw);
      if (obj?.gameStarted) {
        setGameStarted(true);
        if (typeof obj.startedAt === 'number') setStartedAt(obj.startedAt);
        if (typeof obj.timeControlSec === 'number') setTimeControlSec(obj.timeControlSec);
      }
    } catch {}
  }, [room]);

  // Persist game-in-progress so it survives reload.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (gameStarted) {
      localStorage.setItem(`pvc-game-${room}`, JSON.stringify({
        gameStarted: true,
        startedAt,
        timeControlSec,
      }));
    }
  }, [gameStarted, startedAt, timeControlSec, room]);

  // Persist the "I pressed Ready" flag too, so a reload before game-start
  // doesn't dump the player back to "Not ready".
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(`pvc-ready-${room}`);
    if (saved === '1') setIAmReady(true);
  }, [room]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (iAmReady) localStorage.setItem(`pvc-ready-${room}`, '1');
    else localStorage.removeItem(`pvc-ready-${room}`);
  }, [iAmReady, room]);

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

  // Reset board state when entering room. Don't blow away gameStarted here —
  // it's restored separately from localStorage so a reload mid-game keeps the
  // board interactive.
  useEffect(() => {
    reset();
    setIAmReady(false);
    setResignedSide(null);
    setRatingApplied(false);
    setRatingChange(null);
  }, [room, reset]);

  // Wipe the saved "game in progress" flag when the game ends so the next
  // session of the same room starts from the lobby cleanly.
  useEffect(() => {
    const ended = isGameOver || !!timeoutLoser || !!resignedSide;
    if (ended && typeof window !== 'undefined') {
      localStorage.removeItem(`pvc-game-${room}`);
      localStorage.removeItem(`pvc-ready-${room}`);
    }
  }, [isGameOver, timeoutLoser, resignedSide, room]);

  // Re-broadcast identity once user becomes known (login flow).
  useEffect(() => {
    if (user?.id && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'identify',
        payload: { userId: user.id, presenceKey },
      });
    }
  }, [user?.id, presenceKey]);

  // Pull opponent id from localStorage hint (set by lobby) if we don't have it from broadcast yet.
  useEffect(() => {
    if (opponentUserId) return;
    if (typeof window === 'undefined') return;
    const hint = localStorage.getItem(`pvc-opp-${room}`);
    if (hint) setOpponentUserId(hint);
  }, [opponentUserId, room]);

  // Subscribe to channel
  useEffect(() => {
    if (!isSupabaseConfigured) {
      toast(t('online.notConfigured'), { icon: '⚠️' });
      return;
    }
    // Wait until our presenceKey/joinedAt are loaded from localStorage —
    // subscribing with an empty presence key would dump us into "spectator".
    if (!presenceKey || !joinedAt) return;

    const channel = supabase.channel(`room:${room}`, {
      config: { broadcast: { self: false }, presence: { key: presenceKey } },
    });

    channel
      .on('broadcast', { event: 'move' }, ({ payload }: any) => {
        if (payload?.from && payload?.to) {
          // If a move arrives while we still think the game hasn't started
          // (e.g. we reloaded), sync up so the board becomes interactive.
          setGameStarted(true);
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
      .on('broadcast', { event: 'identify' }, ({ payload }: any) => {
        if (payload?.userId && payload?.presenceKey && payload.presenceKey !== presenceKey) {
          setOpponentUserId(payload.userId);
        }
      })
      .on('broadcast', { event: 'resign' }, ({ payload }: any) => {
        if (payload?.side === 'w' || payload?.side === 'b') setResignedSide(payload.side);
      })
      .on('broadcast', { event: 'time-control' }, ({ payload }: any) => {
        if (typeof payload?.seconds === 'number') setTimeControlSec(payload.seconds);
      })
      .on('broadcast', { event: 'state-request' }, ({ payload }: any) => {
        // A peer just (re)joined and is asking for the current state.
        // Anyone who has the game in progress responds with a snapshot.
        if (!payload?.from || payload.from === presenceKey) return;
        if (history.length === 0 && !gameStarted) return;
        channelRef.current?.send({
          type: 'broadcast',
          event: 'state-snapshot',
          payload: {
            to: payload.from,
            sans: history.map((h) => h.san),
            thinkMs: history.map((h) => h.thinkMs),
            startedAt,
            timeControlSec,
            gameStarted,
            resignedSide,
            timeoutLoser,
          },
        });
      })
      .on('broadcast', { event: 'state-snapshot' }, ({ payload }: any) => {
        if (!payload || payload.to !== presenceKey) return;
        if (Array.isArray(payload.sans)) {
          loadSans(payload.sans, payload.thinkMs);
        }
        if (typeof payload.startedAt === 'number') setStartedAt(payload.startedAt);
        if (typeof payload.timeControlSec === 'number') setTimeControlSec(payload.timeControlSec);
        if (payload.gameStarted) setGameStarted(true);
        if (payload.resignedSide === 'w' || payload.resignedSide === 'b') setResignedSide(payload.resignedSide);
        if (payload.timeoutLoser === 'w' || payload.timeoutLoser === 'b') setTimeoutLoser(payload.timeoutLoser);
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, Array<{ joinedAt?: number; ready?: boolean }>>;
        // One key can have multiple presence entries (StrictMode, reconnects).
        // Collapse to one row per key: earliest joinedAt, OR-of all ready flags.
        const list: PresenceRow[] = Object.entries(state).map(([key, vs]) => {
          let earliest = Infinity;
          let anyReady = false;
          for (const v of vs) {
            if (typeof v?.joinedAt === 'number' && v.joinedAt < earliest) earliest = v.joinedAt;
            if (v?.ready) anyReady = true;
          }
          return { key, joinedAt: Number.isFinite(earliest) ? earliest : 0, ready: anyReady };
        });
        list.sort((a, b) => a.joinedAt - b.joinedAt || a.key.localeCompare(b.key));
        setMembers(list);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Use the latest ready value (e.g., restored from localStorage) so a reload
          // doesn't dump us back to "Not ready".
          await channel.track({ joinedAt, ready: readyRef.current });
          if (user?.id) {
            channel.send({ type: 'broadcast', event: 'identify', payload: { userId: user.id, presenceKey } });
          }
          // Ask everyone for the current state. If the game is in progress on
          // their side, they'll send us a snapshot we can replay.
          channel.send({ type: 'broadcast', event: 'state-request', payload: { from: presenceKey } });
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

  // Auto-start when both players ready. The WHITE player (= first joiner)
  // is the deterministic broadcaster, regardless of the localStorage host flag —
  // that way joining via a shared link still works.
  useEffect(() => {
    if (gameStarted) return;
    if (role !== 'w') return;
    if (!whitePlayer?.ready || !blackPlayer?.ready) return;
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
  }, [whitePlayer?.ready, blackPlayer?.ready, role, gameStarted, timeControlSec]);

  // Auto-enable voice chat when interview mode and opponent joined
  useEffect(() => {
    if (isInterview && bothPlayersPresent) setVoiceEnabled(true);
  }, [isInterview, bothPlayersPresent]);

  // 30-second forfeit if the opponent goes offline mid-game.
  const [forfeitCountdown, setForfeitCountdown] = useState<number | null>(null);
  useEffect(() => {
    if (!gameStarted || isGameOver || resignedSide || timeoutLoser) {
      setForfeitCountdown(null);
      return;
    }
    if (!isPlayer) return;
    const opponentPresent = !!opponent;
    if (opponentPresent) {
      setForfeitCountdown(null);
      return;
    }
    const deadline = Date.now() + 30_000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setForfeitCountdown(left);
      if (left === 0) {
        const oppSide = role === 'w' ? 'b' : 'w';
        setResignedSide(oppSide);
        channelRef.current?.send({ type: 'broadcast', event: 'resign', payload: { side: oppSide, reason: 'forfeit' } });
        toast(t('online.opponentForfeited'), { icon: '⌛' });
        clearInterval(id);
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opponent, gameStarted, isGameOver, resignedSide, timeoutLoser, isPlayer, role]);

  // Lobby visibility lifecycle:
  //  · while the host is alone in an open rated room → keep a row in open_lobbies
  //  · when a second player joins → remove that row
  //  · if the opponent leaves → re-publish so others can find it
  useEffect(() => {
    if (!isHost || !user || !isSupabaseConfigured) return;
    if (typeof window === 'undefined') return;
    const privacy = localStorage.getItem(`pvc-privacy-${room}`);
    const mode = localStorage.getItem(`pvc-mode-${room}`);
    if (privacy !== 'open') return;
    if (gameStarted) return;

    if (bothPlayersPresent) {
      supabase.from('open_lobbies').delete().eq('room_id', room).then(() => {});
    } else {
      const stakeStored = parseInt(localStorage.getItem(`pvc-stake-${room}`) ?? '0', 10) || 0;
      supabase
        .from('open_lobbies')
        .upsert({
          room_id: room,
          host_id: user.id,
          host_name: user.email?.split('@')[0] ?? 'player',
          host_rating: economy?.rating ?? 10,
          stake: stakeStored,
          mode: mode || (stakeStored > 0 ? 'rated' : 'casual'),
        })
        .then(({ error }: any) => {
          if (error) console.warn('open_lobbies upsert failed:', error.message);
        });
    }
  }, [bothPlayersPresent, isHost, user, room, economy?.rating, gameStarted]);

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

  const handleResign = () => {
    if (!isPlayer || resignedSide || isGameOver || timeoutLoser) return;
    if (!confirm(t('online.confirmResign'))) return;
    setResignedSide(role as 'w' | 'b');
    channelRef.current?.send({ type: 'broadcast', event: 'resign', payload: { side: role } });
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
  const isResigned = !!resignedSide;
  const gameEnded = isGameOver || isFlagFall || isResigned;
  const movesDisabled = !gameStarted || !isPlayer || gameEnded;

  // Determine outcome from caller's perspective (caller = WHITE in rated games).
  const computeMyResult = (): 'win' | 'loss' | 'draw' | 'resign' | null => {
    if (!gameEnded) return null;
    if (isResigned) {
      if (resignedSide === role) return 'resign';
      return 'win';
    }
    if (isFlagFall) {
      if (timeoutLoser === role) return 'loss';
      return 'win';
    }
    if (isGameOver) {
      if (chess.isCheckmate()) {
        // chess.turn() is the side that just got mated
        if (chess.turn() === role) return 'loss';
        return 'win';
      }
      return 'draw';
    }
    return null;
  };

  // Apply rating once per game, only by WHITE (deterministic single caller).
  useEffect(() => {
    if (!isRated || ratingApplied || role !== 'w' || !user || !opponentUserId) return;
    const myResult = computeMyResult();
    if (!myResult) return;
    setRatingApplied(true);
    applyMatchResult({
      roomId: room as string,
      opponentId: opponentUserId,
      result: myResult,
      stake,
    }).then((res) => {
      if (res.ok) {
        setRatingChange({ rating: res.ratingDelta ?? 0, coin: res.coinDelta ?? 0 });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRated, ratingApplied, role, user, opponentUserId, isGameOver, isFlagFall, isResigned, timeoutLoser, resignedSide]);

  const whiteName = whitePlayer ? (whitePlayer.key === presenceKey ? t('play.you') : t('play.opponent')) : '—';
  const blackName = blackPlayer ? (blackPlayer.key === presenceKey ? t('play.you') : t('play.opponent')) : '—';

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
        <h1 className="text-2xl md:text-3xl font-display font-bold flex items-center gap-2">
          {isInterview ? <Briefcase className="w-6 h-6 text-amber-500" /> : <Users className="w-6 h-6 text-accent-500" />}
          {t('online.room')} <span className="font-mono text-accent-500">{room}</span>
        </h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={copyLink} className="btn-ghost flex items-center gap-2">
            <Copy className="w-4 h-4" /> {t('online.copy')}
          </button>
          <button onClick={() => setVoiceEnabled((v) => !v)} className={voiceEnabled ? 'btn-primary' : 'btn-ghost'}>
            {voiceEnabled ? t('online.voiceOn') : t('online.enableVoice')}
          </button>
          {gameStarted && isPlayer && !gameEnded && (
            <button onClick={handleResign} className="btn-ghost text-rose-500 flex items-center gap-2">
              <Flag className="w-4 h-4" /> {t('online.resign')}
            </button>
          )}
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

      {isRated && (
        <div className="card mb-4 border border-amber-500/40 bg-gradient-to-r from-amber-500/5 to-orange-500/5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Star className="w-5 h-5 text-amber-500" />
            <div>
              <div className="font-semibold">{t('online.ratedBadge')}</div>
              <div className="text-xs text-gray-500">
                <span className="text-emerald-400">+2</span> {t('online.preview.win').toLowerCase()} ·
                <span className="text-amber-400 ml-1">+1</span> {t('online.preview.draw').toLowerCase()} ·
                <span className="text-rose-400 ml-1">−1</span> {t('online.preview.loss').toLowerCase()} ·
                <span className="text-rose-500 ml-1">−2</span> {t('online.preview.resign').toLowerCase()}
              </div>
            </div>
          </div>
          {stake > 0 && (
            <div className="flex items-center gap-1.5 text-sm font-mono">
              <Coins className="w-4 h-4 text-yellow-500" /> {t('online.stake')}: {stake}
            </div>
          )}
        </div>
      )}

      {ratingChange && (
        <div className="card mb-4 border border-emerald-500/40 bg-emerald-500/5 flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm">
            <span className="font-semibold">{t('online.ratingChanged')}: </span>
            <span className={ratingChange.rating > 0 ? 'text-emerald-400' : ratingChange.rating < 0 ? 'text-rose-400' : ''}>
              {ratingChange.rating > 0 ? '+' : ''}{ratingChange.rating}
            </span>
          </div>
          {stake > 0 && (
            <div className="text-sm">
              <span className="font-semibold">{t('online.coinChange')}: </span>
              <span className={ratingChange.coin > 0 ? 'text-emerald-400' : ratingChange.coin < 0 ? 'text-rose-400' : ''}>
                {ratingChange.coin > 0 ? '+' : ''}{ratingChange.coin} 💰
              </span>
            </div>
          )}
        </div>
      )}

      {!bothPlayersPresent && !gameStarted && (
        <div className="card mb-4 text-sm text-amber-500">{t('online.waiting')}</div>
      )}

      {forfeitCountdown !== null && forfeitCountdown > 0 && (
        <div className="card mb-4 text-sm border border-amber-500/40 bg-amber-500/10 text-amber-500">
          ⌛ {t('online.opponentOffline', { sec: forfeitCountdown })}
        </div>
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
            {role === 'w' && !isInterview ? (
              <select
                value={timeControlSec}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setTimeControlSec(v);
                  channelRef.current?.send({
                    type: 'broadcast',
                    event: 'time-control',
                    payload: { seconds: v },
                  });
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
                {role === 'b' && <span className="text-xs text-gray-500 ml-2">({t('online.waitingHost')})</span>}
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

      {isResigned && !isFlagFall && (
        <div className="card mb-4 text-center text-lg font-semibold border border-rose-500/40 bg-rose-500/10">
          🏳️ {resignedSide === role ? t('voice.resigned') : `${t('play.opponent')} 🏳️`} ·{' '}
          {resignedSide === 'w' ? '0-1' : '1-0'}
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
          <VoiceChat
            roomId={room as string}
            enabled={voiceEnabled && bothPlayersPresent}
            initiator={role === 'w'}
            signalingChannel={channelRef.current}
          />
          <VoiceControl
            disabled={movesDisabled}
            playerSide={isPlayer ? (role as 'w' | 'b') : null}
            onMove={onMove}
            onUndo={() => {
              if (!isPlayer || gameEnded || history.length === 0) return 0;
              // Only allow undoing my own last move (one move at a time).
              const lastMoverIndex = history.length - 1;
              const lastMoverSide: 'w' | 'b' = lastMoverIndex % 2 === 0 ? 'w' : 'b';
              if (lastMoverSide !== role) {
                toast.error(t('online.notYourTurn'));
                return 0;
              }
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
