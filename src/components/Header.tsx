'use client';

import Link from 'next/link';
import { Crown, Sun, Moon, User } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { useAuth } from '@/hooks/useAuth';

export default function Header() {
  const { theme, toggle } = useTheme();
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/60 dark:bg-dark-900/70 border-b border-white/30 dark:border-dark-700">
      <nav className="container mx-auto px-4 py-4 flex items-center justify-between max-w-6xl">
        <Link href="/" className="flex items-center gap-2 font-display font-bold text-xl">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-600 to-accent-600 flex items-center justify-center">
            <Crown className="w-5 h-5 text-white" />
          </div>
          <span className="hidden sm:inline">PsychoVoice</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/play/ai" className="hidden sm:block px-3 py-2 hover:text-accent-500 transition">Play</Link>
          <Link href="/analyze" className="hidden sm:block px-3 py-2 hover:text-accent-500 transition">Analyze</Link>
          <Link href="/leaderboard" className="hidden sm:block px-3 py-2 hover:text-accent-500 transition">Leaderboard</Link>

          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="p-2 rounded-xl glass hover:bg-white/80 dark:hover:bg-dark-700/80"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <Link href="/profile" className="btn-ghost flex items-center gap-2">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">{user.email?.split('@')[0]}</span>
              </Link>
              <button onClick={signOut} className="text-sm text-gray-500 hover:text-red-500">Logout</button>
            </div>
          ) : (
            <Link href="/login" className="btn-primary">Sign in</Link>
          )}
        </div>
      </nav>
    </header>
  );
}
