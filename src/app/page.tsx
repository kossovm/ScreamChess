'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Brain, Mic, Swords, Bot, Trophy, Users, Sparkles,
  Briefcase, Zap, Plug, Check, ArrowRight,
} from 'lucide-react';
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

  const enterpriseUseCases = [
    { icon: Briefcase, title: t('home.enterprise.uc.hr.title'), desc: t('home.enterprise.uc.hr.desc') },
    { icon: Zap, title: t('home.enterprise.uc.lead.title'), desc: t('home.enterprise.uc.lead.desc') },
    { icon: Plug, title: t('home.enterprise.uc.api.title'), desc: t('home.enterprise.uc.api.desc') },
  ];

  const tiers = [
    {
      name: t('home.pricing.free.name'),
      price: t('home.pricing.free.price'),
      bullets: [t('home.pricing.free.bullet1'), t('home.pricing.free.bullet2'), t('home.pricing.free.bullet3')],
      cta: t('home.pricing.free.cta'),
      href: '/play/ai',
      highlight: false,
    },
    {
      name: t('home.pricing.team.name'),
      price: t('home.pricing.team.price'),
      suffix: t('home.pricing.month'),
      bullets: [
        t('home.pricing.team.bullet1'),
        t('home.pricing.team.bullet2'),
        t('home.pricing.team.bullet3'),
        t('home.pricing.team.bullet4'),
      ],
      cta: t('home.pricing.team.cta'),
      href: 'mailto:kossovm@outlook.com?subject=PsychoVoice%20Team%20Trial',
      highlight: true,
    },
    {
      name: t('home.pricing.enterprise.name'),
      price: t('home.pricing.enterprise.price'),
      bullets: [
        t('home.pricing.enterprise.bullet1'),
        t('home.pricing.enterprise.bullet2'),
        t('home.pricing.enterprise.bullet3'),
        t('home.pricing.enterprise.bullet4'),
        t('home.pricing.enterprise.bullet5'),
      ],
      cta: t('home.pricing.enterprise.cta'),
      href: 'mailto:kossovm@outlook.com?subject=PsychoVoice%20Enterprise',
      highlight: false,
    },
  ];

  return (
    <div className="container mx-auto px-4 pt-10 pb-20 max-w-6xl">
      {/* HERO */}
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

      {/* MODE CARDS */}
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

      {/* PRODUCT FEATURES */}
      <section className="mb-24">
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

      {/* ENTERPRISE */}
      <section className="mb-24">
        <div className="rounded-3xl bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-rose-500/10 border border-amber-500/30 p-8 md:p-12">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-amber-500">{t('home.enterprise.eyebrow')}</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-4 leading-[1.1]">
            {t('home.enterprise.title')}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mb-10">
            {t('home.enterprise.subtitle')}
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 md:gap-6 mb-10">
            <div className="text-center md:text-left">
              <div className="text-2xl md:text-4xl font-display font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                12k+
              </div>
              <div className="text-xs md:text-sm text-gray-500 mt-1">{t('home.enterprise.stats.candidates')}</div>
            </div>
            <div className="text-center md:text-left">
              <div className="text-2xl md:text-4xl font-display font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                5 min
              </div>
              <div className="text-xs md:text-sm text-gray-500 mt-1">{t('home.enterprise.stats.minutes')}</div>
            </div>
            <div className="text-center md:text-left">
              <div className="text-2xl md:text-4xl font-display font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                23
              </div>
              <div className="text-xs md:text-sm text-gray-500 mt-1">{t('home.enterprise.stats.signals')}</div>
            </div>
          </div>

          {/* Use cases */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            {enterpriseUseCases.map((uc, i) => (
              <motion.div
                key={uc.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-xl bg-white/60 dark:bg-dark-900/40 backdrop-blur-sm p-5 border border-white/40 dark:border-white/10"
              >
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center mb-3">
                  <uc.icon className="w-5 h-5 text-amber-500" />
                </div>
                <h3 className="font-semibold mb-1">{uc.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{uc.desc}</p>
              </motion.div>
            ))}
          </div>

          <a
            href="mailto:kossovm@outlook.com?subject=PsychoVoice%20Demo"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:scale-[1.02] transition-transform shadow-lg shadow-orange-500/20"
          >
            {t('home.enterprise.cta')} <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* PRICING */}
      <section className="mb-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-3">{t('home.pricing.title')}</h2>
          <p className="text-gray-600 dark:text-gray-400">{t('home.pricing.subtitle')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className={`card relative flex flex-col ${
                tier.highlight ? 'border-2 border-accent-500 scale-[1.02] shadow-xl shadow-accent-500/20' : ''
              }`}
            >
              {tier.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-gradient-to-r from-primary-500 to-accent-500 text-white">
                  {t('home.pricing.popular')}
                </div>
              )}
              <h3 className="text-xl font-display font-bold mb-2">{tier.name}</h3>
              <div className="mb-5">
                <span className="text-4xl font-display font-bold">{tier.price}</span>
                {tier.suffix && <span className="text-sm text-gray-500 ml-1">{tier.suffix}</span>}
              </div>
              <ul className="space-y-2.5 mb-6 text-sm flex-1">
                {tier.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="text-gray-700 dark:text-gray-300">{b}</span>
                  </li>
                ))}
              </ul>
              <a
                href={tier.href}
                className={`block text-center py-2.5 rounded-xl font-semibold transition ${
                  tier.highlight
                    ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white hover:scale-[1.02]'
                    : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
                }`}
              >
                {tier.cta}
              </a>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="card text-center bg-gradient-to-br from-primary-500/5 to-accent-500/5 border border-primary-500/20">
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-3">{t('home.b2b.title')}</h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-5">
          {t('home.b2b.desc')}
        </p>
        <a href="mailto:kossovm@outlook.com" className="btn-primary inline-flex items-center gap-2">
          {t('home.b2b.cta')} <ArrowRight className="w-4 h-4" />
        </a>
      </section>
    </div>
  );
}
