'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuid } from 'uuid';
import { Briefcase, Link2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useT } from '@/components/LanguageProvider';

export default function OnlineLobby() {
  const router = useRouter();
  const t = useT();
  const [code, setCode] = useState('');

  const create = (mode?: 'interview') => {
    const id = uuid().slice(0, 8);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`pvc-host-${id}`, '1');
      if (mode) localStorage.setItem(`pvc-mode-${id}`, mode);
    }
    router.push(mode ? `/play/online/${id}?mode=${mode}` : `/play/online/${id}`);
  };

  const join = () => {
    if (!code.trim()) {
      toast.error(t('online.enterCode'));
      return;
    }
    router.push(`/play/online/${code.trim()}`);
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-3xl font-display font-bold mb-2">{t('online.title')}</h1>
      <p className="text-gray-500 mb-8">{t('online.subtitle')}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button onClick={() => create()} className="card text-left hover:scale-[1.02] transition-transform">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-500 to-pink-500 flex items-center justify-center mb-4">
            <Plus className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-semibold mb-1">{t('online.create')}</h3>
          <p className="text-sm text-gray-500">{t('online.create.desc')}</p>
        </button>

        <button onClick={() => create('interview')} className="card text-left hover:scale-[1.02] transition-transform border border-amber-500/40">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mb-4">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-semibold mb-1">{t('online.create.interview')}</h3>
          <p className="text-sm text-gray-500">{t('online.create.interview.desc')}</p>
        </button>

        <div className="card">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center mb-4">
            <Link2 className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-semibold mb-1">{t('online.join')}</h3>
          <input
            placeholder={t('online.roomCode')}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="input mt-2 mb-3"
            onKeyDown={(e) => e.key === 'Enter' && join()}
          />
          <button onClick={join} className="btn-primary w-full">{t('online.join.cta')}</button>
        </div>
      </div>
    </div>
  );
}
