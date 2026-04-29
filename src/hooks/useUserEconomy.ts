'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from './useAuth';

export interface UserEconomy {
  rating: number;
  coins: number;
  coinsHandoutUsed: boolean;
  wins: number;
  losses: number;
  draws: number;
}

const DEFAULT: UserEconomy = {
  rating: 10,
  coins: 5000,
  coinsHandoutUsed: false,
  wins: 0,
  losses: 0,
  draws: 0,
};

export function useUserEconomy() {
  const { user } = useAuth();
  const [economy, setEconomy] = useState<UserEconomy | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !isSupabaseConfigured) {
      setEconomy(null);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('rating, coins, coins_handout_used, wins, losses, draws')
      .eq('id', user.id)
      .single();
    if (!error && data) {
      setEconomy({
        rating: data.rating ?? DEFAULT.rating,
        coins: data.coins ?? DEFAULT.coins,
        coinsHandoutUsed: data.coins_handout_used ?? false,
        wins: data.wins ?? 0,
        losses: data.losses ?? 0,
        draws: data.draws ?? 0,
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const requestCharity = useCallback(async () => {
    if (!user || !isSupabaseConfigured) return { ok: false, error: 'not_signed_in' as const };
    const { data, error } = await supabase.rpc('request_charity');
    if (error) return { ok: false, error: error.message };
    if (data && (data as any).error) return { ok: false, error: (data as any).error };
    await refresh();
    return { ok: true, coins: (data as any)?.coins as number | undefined };
  }, [user, refresh]);

  const applyMatchResult = useCallback(
    async (params: { roomId: string; opponentId: string; result: 'win' | 'loss' | 'draw' | 'resign'; stake: number }) => {
      if (!user || !isSupabaseConfigured) return { ok: false };
      const { data, error } = await supabase.rpc('apply_match_result', {
        p_room_id: params.roomId,
        p_opponent_id: params.opponentId,
        p_result: params.result,
        p_stake: params.stake,
      });
      if (error) return { ok: false, error: error.message };
      if (data && (data as any).error) return { ok: false, error: (data as any).error };
      await refresh();
      return {
        ok: true,
        ratingDelta: (data as any)?.rating_delta as number | undefined,
        coinDelta: (data as any)?.coin_delta as number | undefined,
      };
    },
    [user, refresh]
  );

  return { economy, loading, refresh, requestCharity, applyMatchResult };
}
