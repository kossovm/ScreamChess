'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Brain, Mic, Swords, Bot, Trophy, Users, Sparkles } from 'lucide-react';

const features = [
  { icon: Mic, title: 'Vocal Warfare', desc: 'Move pieces by speaking. Trash-talk your opponent live.', color: 'from-pink-500 to-rose-500' },
  { icon: Brain, title: 'Psycho-AI Profiling', desc: 'AI reads your move patterns AND your voice tone.', color: 'from-violet-500 to-purple-500' },
  { icon: Bot, title: 'Stockfish Coach', desc: 'World-class engine breaks down every move.', color: 'from-blue-500 to-cyan-500' },
  { icon: Trophy, title: 'Geo Leaderboards', desc: 'Top strategists from your city.', color: 'from-amber-500 to-orange-500' },
];

const modes = [
  { href: '/play/local', title: 'Local Duel', desc: 'Play face-to-face on one device.', icon: Users, accent: 'from-primary-500 to-cyan-500' },
  { href: '/play/ai', title: 'vs Stockfish', desc: 'Challenge the engine. 10 difficulty levels.', icon: Bot, accent: 'from-accent-500 to-pink-500' },
  { href: '/play/online', title: 'Online (Voice)', desc: 'Live voice chat. Mind games included.', icon: Swords, accent: 'from-amber-500 to-red-500' },
];

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 pt-10 pb-20 max-w-6xl">
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-20"
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-sm mb-6">
          <Sparkles className="w-4 h-4 text-accent-500" />
          <span>Game · Mind · Voice</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight mb-6 leading-[1.1]">
          Chess that reads <br />
          <span className="bg-gradient-to-r from-primary-500 via-accent-500 to-pink-500 bg-clip-text text-transparent">
            your mind.
          </span>
        </h1>
        <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-10">
          PsychoVoice Chess analyzes not just your moves on the board — but your voice, your hesitations, your style.
          A psychological passport for every game you play.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/play/ai" className="btn-primary text-lg px-8 py-3.5">Start Playing</Link>
          <Link href="/leaderboard" className="btn-ghost text-lg px-8 py-3.5">Leaderboard</Link>
        </div>
      </motion.section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
        {modes.map((m, i) => (
          <motion.div
            key={m.href}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Link href={m.href} className="block card group hover:scale-[1.02] transition-transform">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${m.accent} flex items-center justify-center mb-4 shadow-lg`}>
                <m.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-display font-bold mb-2">{m.title}</h3>
              <p className="text-gray-600 dark:text-gray-400">{m.desc}</p>
              <div className="mt-4 text-accent-500 group-hover:translate-x-1 transition-transform">→</div>
            </Link>
          </motion.div>
        ))}
      </section>

      <section className="mb-20">
        <h2 className="text-3xl md:text-4xl font-display font-bold mb-10 text-center">
          What makes us <span className="text-accent-500">different</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="card flex items-start gap-4"
            >
              <div className={`shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center`}>
                <f.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-1">{f.title}</h3>
                <p className="text-gray-600 dark:text-gray-400">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="card text-center">
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-3">For HR & Recruiters</h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-5">
          A 5-minute match with PsychoVoice gives a primary risk-profile, adaptability and stress-tolerance reading
          for any candidate. B2B API access available.
        </p>
        <a href="mailto:hr@psychovoice.chess" className="btn-ghost inline-block">Contact Sales</a>
      </section>
    </div>
  );
}
