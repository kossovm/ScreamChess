'use client';

import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Trophy, MapPin, Globe } from 'lucide-react';
import type { LeaderEntry } from '@/types';

const MOCK: LeaderEntry[] = [
  { id: '1', username: 'NeoKnight', rating: 1980, city: 'Almaty', country: 'KZ', wins: 42, losses: 11, draws: 7 },
  { id: '2', username: 'VocalQueen', rating: 1932, city: 'Astana', country: 'KZ', wins: 39, losses: 14, draws: 9 },
  { id: '3', username: 'PsychoPawn', rating: 1888, city: 'Tbilisi', country: 'GE', wins: 35, losses: 16, draws: 6 },
  { id: '4', username: 'silentBishop', rating: 1820, city: 'Almaty', country: 'KZ', wins: 31, losses: 18, draws: 9 },
  { id: '5', username: 'EndgameOracle', rating: 1789, city: 'Tashkent', country: 'UZ', wins: 28, losses: 19, draws: 7 },
  { id: '6', username: 'voiceRook', rating: 1755, city: 'Almaty', country: 'KZ', wins: 26, losses: 22, draws: 4 },
];

export default function LeaderboardPage() {
  const [tab, setTab] = useState<'global' | 'city'>('global');
  const [city, setCity] = useState('Almaty');
  const [entries, setEntries] = useState<LeaderEntry[]>(MOCK);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    (async () => {
      const q = supabase.from('leaderboard').select('*').order('rating', { ascending: false }).limit(100);
      const { data } = await q;
      if (data && data.length) setEntries(data as any);
    })();
  }, []);

  const list = tab === 'city' ? entries.filter((e) => e.city === city) : entries;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="w-8 h-8 text-amber-500" />
        <h1 className="text-3xl font-display font-bold">Leaderboard</h1>
      </div>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('global')} className={tab === 'global' ? 'btn-primary' : 'btn-ghost'}>
          <Globe className="w-4 h-4 inline mr-2" /> Global
        </button>
        <button onClick={() => setTab('city')} className={tab === 'city' ? 'btn-primary' : 'btn-ghost'}>
          <MapPin className="w-4 h-4 inline mr-2" /> By City
        </button>
        {tab === 'city' && (
          <select value={city} onChange={(e) => setCity(e.target.value)} className="input w-auto">
            {Array.from(new Set(entries.map((e) => e.city).filter(Boolean))).map((c) => (
              <option key={c} value={c as string}>{c}</option>
            ))}
          </select>
        )}
      </div>

      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
              <th className="py-2">#</th><th>Player</th><th>City</th><th className="text-right">Rating</th><th className="text-right">W/L/D</th>
            </tr>
          </thead>
          <tbody>
            {list.map((e, i) => (
              <tr key={e.id} className="border-t border-white/10">
                <td className="py-3 font-mono">{i + 1}</td>
                <td className="font-medium">{e.username}</td>
                <td className="text-gray-500">{e.city ?? '—'}</td>
                <td className="text-right font-mono text-accent-500">{e.rating}</td>
                <td className="text-right font-mono">{e.wins}/{e.losses}/{e.draws}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="text-center py-6 text-gray-500">No entries yet.</p>}
      </div>
    </div>
  );
}
