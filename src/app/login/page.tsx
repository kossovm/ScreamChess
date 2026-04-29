'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useT } from '@/components/LanguageProvider';
import { Crown, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const t = useT();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!isSupabaseConfigured) {
      toast.error(t('login.notConfigured'));
      return;
    }
    setLoading(true);
    try {
      const fn = mode === 'in' ? signInWithEmail : signUpWithEmail;
      const { error } = await fn(email, pw);
      if (error) throw error;
      toast.success(mode === 'in' ? t('login.welcomeToast') : t('login.confirmEmail'));
      router.push('/');
    } catch (e: any) {
      toast.error(e?.message ?? t('login.authError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-16 max-w-md">
      <div className="card">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-600 to-accent-600 flex items-center justify-center">
            <Crown className="w-7 h-7 text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-display font-bold text-center mb-1">{mode === 'in' ? t('login.welcomeBack') : t('login.create')}</h1>
        <p className="text-sm text-gray-500 text-center mb-6">{t('login.subtitle')}</p>

        <div className="space-y-3">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('login.email')} className="input" />
          <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" placeholder={t('login.password')} className="input" />
          <button onClick={submit} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'in' ? t('login.signin') : t('login.signup')}
          </button>
          <button onClick={signInWithGoogle} className="btn-ghost w-full">{t('login.google')}</button>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          {mode === 'in' ? t('login.noAccount') : t('login.haveAccount')}{' '}
          <button onClick={() => setMode(mode === 'in' ? 'up' : 'in')} className="text-accent-500 hover:underline">
            {mode === 'in' ? t('login.signup') : t('login.signin')}
          </button>
        </p>
      </div>
    </div>
  );
}
