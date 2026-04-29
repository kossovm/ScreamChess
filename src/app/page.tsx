'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Brain, Mic, Swords, Bot, Trophy, Users, Sparkles } from 'lucide-react';
import { useT } from '@/components/LanguageProvider';

export default function HomePage() {
  const t = useT();

  const features = [
    { icon: Mic, title: t('home.features.vocal.title'), desc: t('home.features.vocal.desc'), color: 'from-pink-500 to-rose-500' },
    { icon: Brain, title: t('home.features.psycho.title'), desc: t('home.features.psycho.desc'), color: 'from-violet-500 to-purple-500' },
    { icon: Bot, title: t('home.features.coach.title'), desc: t('home.features.coach.desc'), color: 'from-blue-500 to-cyan-500' },
    { icon: Trophy, title: t('home.features.geo.title'), desc: t('home.features.geo.desc'), color: 'from-amber-500 to-orange-500' },
  ];

  const modes = [
    { href: '/play/local', title: t('home.modes.local.title'), desc: t('home.modes.local.desc'), icon: Users, accent: 'from-primary-500 to-cyan-500' },
    { href: '/play/ai', title: t('home.modes.ai.title'), desc: t('home.modes.ai.desc'), icon: Bot, accent: 'from-accent-500 to-pink-500' },
    { href: '/play/online', title: t('home.modes.online.title'), desc: t('home.modes.online.desc'), icon: Swords, accent: 'from-amber-500 to-red-500' },
  ];

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
          <span>{t('home.badge')}</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight mb-6 leading-[1.1]">
          {t('home.title.line1')} <br />
          <span className="bg-gradient-to-r from-primary-500 via-accent-500 to-pink-500 bg-clip-text text-transparent">
            {t('home.title.line2')}
          </span>
        </h1>
        <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-10">
          {t('home.subtitle')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/play/ai" className="btn-primary text-lg px-8 py-3.5">{t('home.cta.start')}</Link>
          <Link
            href="/play/online"
            className="text-lg px-8 py-3.5 rounded-xl font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:scale-[1.02] transition-transform shadow-lg shadow-orange-500/20"
          >
            {t('home.cta.online')}
          </Link>
          <Link href="/leaderboard" className="btn-ghost text-lg px-8 py-3.5">{t('home.cta.leaderboard')}</Link>
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
          {t('home.features.title')} <span className="text-accent-500">{t('home.features.titleAccent')}</span>
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
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-3">{t('home.b2b.title')}</h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-5">
          {t('home.b2b.desc')}
        </p>
        <a href="mailto:hr@psychovoice.chess" className="btn-ghost inline-block">{t('home.b2b.cta')}</a>
      </section>
    </div>
  );
}
