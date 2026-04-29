'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useT } from '@/components/LanguageProvider';
import { User, Trophy, Brain } from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const t = useT();
  const [games, setGames] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;
    (async () => {
      const { data: g } = await supabase.from('games').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
      setGames(g ?? []);
      const { data: p } = await supabase.from('psycho_profiles').select('*').eq('user_id', user.id).single();
      setProfile(p ?? null);
    })();
  }, [user]);

  if (loading) return <div className="container mx-auto px-4 py-12 max-w-3xl">{t('profile.loading')}</div>;
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-3xl text-center">
        <p className="mb-4">{t('profile.signedOut')}</p>
        <Link href="/login" className="btn-primary">{t('header.signin')}</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="card flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 to-accent-600 flex items-center justify-center">
          <User className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold">{user.email}</h1>
          <p className="text-sm text-gray-500">{t('profile.memberSince')} {new Date(user.created_at!).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card">
          <h3 className="font-semibold mb-2 flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> {t('profile.gamesPlayed')}</h3>
          <p className="text-3xl font-display font-bold">{games.length}</p>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-2 flex items-center gap-2"><Brain className="w-4 h-4 text-accent-500" /> {t('profile.cognitiveStyle')}</h3>
          <p className="text-xl font-display font-bold">{profile?.cognitive_style ?? t('psycho.style.adaptive')}</p>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-3">{t('profile.recentGames')}</h3>
        {games.length === 0 ? (
          <p className="text-sm text-gray-500">{t('profile.noGames')}</p>
        ) : (
          <ul className="text-sm space-y-2">
            {games.map((g) => (
              <li key={g.id} className="flex items-center justify-between border-t border-white/10 pt-2">
                <span className="font-mono">{g.mode}</span>
                <span>{g.result}</span>
                <span className="text-gray-500 text-xs">{new Date(g.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
