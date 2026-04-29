'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserEconomy } from '@/hooks/useUserEconomy';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useT } from '@/components/LanguageProvider';
import { Brain, Coins, HandCoins, MapPin, Pencil, Star, Trophy, User } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const t = useT();
  const { economy, requestCharity, refresh } = useUserEconomy();
  const [games, setGames] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [city, setCity] = useState('');
  const [editingCity, setEditingCity] = useState(false);
  const [savingCity, setSavingCity] = useState(false);
  const [charityLoading, setCharityLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [editingNames, setEditingNames] = useState(false);
  const [savingNames, setSavingNames] = useState(false);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;
    (async () => {
      const { data: g } = await supabase
        .from('games')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setGames(g ?? []);
      const { data: psy } = await supabase.from('psycho_profiles').select('*').eq('user_id', user.id).single();
      setProfile(psy ?? null);
      const { data: prof } = await supabase
        .from('profiles')
        .select('city, username, first_name, last_name')
        .eq('id', user.id)
        .single();
      if (prof?.city) setCity(prof.city);
      if (prof?.username) setUsername(prof.username);
      if (prof?.first_name) setFirstName(prof.first_name);
      if (prof?.last_name) setLastName(prof.last_name);
    })();
  }, [user]);

  const onCharity = async () => {
    setCharityLoading(true);
    const res = await requestCharity();
    setCharityLoading(false);
    if (res.ok) toast.success(t('profile.charityReceived'));
    else if (res.error === 'already_used') toast.error(t('profile.charityAlreadyUsed'));
    else if (res.error === 'not_eligible') toast(t('profile.charityNotEligible'));
    else toast.error(res.error ?? 'Error');
  };

  const saveNames = async () => {
    if (!user) return;
    setSavingNames(true);
    const update: any = {
      first_name: firstName.trim().slice(0, 60) || null,
      last_name: lastName.trim().slice(0, 60) || null,
    };
    if (username.trim()) update.username = username.trim().slice(0, 40);
    const { error } = await supabase.from('profiles').update(update).eq('id', user.id);
    setSavingNames(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t('profile.nameSaved'));
      setEditingNames(false);
      refresh();
    }
  };

  const saveCity = async () => {
    if (!user) return;
    setSavingCity(true);
    const trimmed = city.trim().slice(0, 60);
    const { error } = await supabase.from('profiles').update({ city: trimmed || null }).eq('id', user.id);
    setSavingCity(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t('profile.cityUpdated'));
      setEditingCity(false);
      refresh();
    }
  };

  if (loading) return <div className="container mx-auto px-4 py-12 max-w-3xl">{t('profile.loading')}</div>;
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-3xl text-center">
        <p className="mb-4">{t('profile.signedOut')}</p>
        <Link href="/login" className="btn-primary">{t('header.signin')}</Link>
      </div>
    );
  }

  const showCharity = economy && economy.coins < 1000 && !economy.coinsHandoutUsed;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="card flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 to-accent-600 flex items-center justify-center">
          <User className="w-8 h-8 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold">{user.email}</h1>
          <p className="text-sm text-gray-500">{t('profile.memberSince')} {new Date(user.created_at!).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Name editor */}
      <div className="card mb-3">
        <div className="flex items-center gap-2 mb-2">
          <User className="w-4 h-4 text-primary-500" />
          <h3 className="text-sm font-semibold">{t('profile.firstName')} / {t('profile.lastName')}</h3>
          {!editingNames && (
            <button onClick={() => setEditingNames(true)} className="ml-auto btn-ghost p-1.5" aria-label="edit">
              <Pencil className="w-4 h-4" />
            </button>
          )}
        </div>
        {editingNames ? (
          <div className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t('profile.firstName')} className="input text-sm" />
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t('profile.lastName')} className="input text-sm" />
            </div>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t('profile.username')} className="input text-sm" />
            <button onClick={saveNames} disabled={savingNames} className="btn-primary text-sm py-1.5 px-3">
              {savingNames ? '…' : t('profile.save')}
            </button>
          </div>
        ) : (
          <div className="text-sm">
            <div className="font-medium">
              {firstName || lastName
                ? [firstName, lastName].filter(Boolean).join(' ')
                : <span className="text-gray-500 italic">—</span>}
            </div>
            {username && <div className="text-xs text-gray-500 font-mono mt-0.5">@{username}</div>}
          </div>
        )}
      </div>

      {/* City editor */}
      <div className="card mb-6 flex items-center gap-3">
        <MapPin className="w-5 h-5 text-emerald-500 shrink-0" />
        <div className="flex-1">
          <div className="text-xs text-gray-500 mb-0.5">{t('profile.city')}</div>
          {editingCity ? (
            <div className="flex gap-2">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t('profile.cityPlaceholder')}
                className="input flex-1 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && saveCity()}
                autoFocus
              />
              <button onClick={saveCity} disabled={savingCity} className="btn-primary text-sm py-1.5 px-3">
                {savingCity ? '…' : t('profile.save')}
              </button>
            </div>
          ) : (
            <div className="font-medium">{city || <span className="text-gray-500 italic">—</span>}</div>
          )}
        </div>
        {!editingCity && (
          <button onClick={() => setEditingCity(true)} className="btn-ghost p-2" aria-label={t('profile.editCity')}>
            <Pencil className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="card !p-4">
          <h3 className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-amber-500" /> {t('profile.rating')}
          </h3>
          <p className="text-2xl font-display font-bold">{economy?.rating ?? '—'}</p>
        </div>
        <div className="card !p-4">
          <h3 className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-yellow-500" /> {t('profile.coins')}
          </h3>
          <p className="text-2xl font-display font-bold">{economy?.coins ?? '—'}</p>
        </div>
        <div className="card !p-4">
          <h3 className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-500" /> {t('profile.gamesPlayed')}
          </h3>
          <p className="text-2xl font-display font-bold">{games.length}</p>
        </div>
        <div className="card !p-4">
          <h3 className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5 text-accent-500" /> {t('profile.cognitiveStyle')}
          </h3>
          <p className="text-sm font-display font-bold">{profile?.cognitive_style ?? t('psycho.style.adaptive')}</p>
        </div>
      </div>

      {showCharity && (
        <div className="card mb-6 border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <HandCoins className="w-6 h-6 text-amber-500 shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="font-semibold mb-0.5">{t('profile.requestCharity')}</h3>
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">{t('profile.requestCharity.desc')}</p>
              <button onClick={onCharity} disabled={charityLoading} className="btn-primary text-sm">
                {charityLoading ? '…' : `+1000 💰`}
              </button>
            </div>
          </div>
        </div>
      )}

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
