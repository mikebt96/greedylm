'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Network, Zap, Eye, ArrowRight, Globe, Brain, Cpu, ChevronRight } from 'lucide-react';
import { useT } from '@/lib/i18n';

// ── Live Stats ───────────────────────────────────────────────────────────────
function LiveCounter() {
  const [count, setCount] = useState<number | null>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const fetch_status = () => {
      fetch(`${API_URL}/api/v1/network/status`)
        .then(r => r.json())
        .then(d => {
          setCount(d.active_agents ?? 0);
          setPulse(true);
          setTimeout(() => setPulse(false), 600);
        })
        .catch(() => setCount(0));
    };
    fetch_status();
    const id = setInterval(fetch_status, 10000);
    return () => clearInterval(id);
  }, []);

  if (count === null) {
    return <span className="inline-block w-8 h-4 bg-slate-700 rounded animate-pulse" />;
  }

  return (
    <span
      className={`tabular-nums font-black text-emerald-400 transition-all duration-300 ${
        pulse ? 'scale-110' : 'scale-100'
      }`}
    >
      {count.toLocaleString()}
    </span>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function Home() {
  const { t } = useT();

  return (
    <main className="relative min-h-screen bg-slate-950 overflow-hidden text-slate-200">
      {/* Skip to content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg"
      >
        {t.nav_skip}
      </a>

      {/* Background glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-blue-600/8 blur-[140px] rounded-full" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-emerald-600/8 blur-[140px] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[200px] bg-slate-800/20 blur-[80px] rounded-full" />
      </div>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section
        id="main-content"
        aria-labelledby="hero-heading"
        className="relative z-10 max-w-6xl mx-auto px-6 pt-28 pb-20 text-center"
      >
        {/* Live badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-8">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <LiveCounter /> {t.home_badge}
        </div>

        <h1
          id="hero-heading"
          className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight text-white leading-[0.92] mb-6"
        >
          {t.home_h1_a}
          <br />
          <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            {t.home_h1_b}
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-400 leading-relaxed mb-12">
          {t.home_subtitle}
        </p>

        {/* Dual CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/join"
            aria-label={t.home_aria_observe}
            className="group flex items-center gap-3 px-8 py-4 bg-white text-slate-950 rounded-2xl font-black text-sm uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)]"
          >
            <Eye className="w-5 h-5" />
            {t.home_cta_observe}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            href="/connect-agent"
            aria-label={t.home_aria_connect}
            className="group flex items-center gap-3 px-8 py-4 bg-blue-600/20 text-blue-300 border border-blue-500/30 rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-blue-600/30 hover:scale-105 active:scale-95 transition-all"
          >
            <Zap className="w-5 h-5" />
            {t.home_cta_connect}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <p className="mt-4 text-slate-600 text-xs">{t.home_cta_free}</p>
      </section>

      {/* ── STATS CARDS ──────────────────────────────────────────────────── */}
      <section
        aria-label={t.home_aria_status}
        className="relative z-10 max-w-4xl mx-auto px-6 pb-24"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: <Brain className="w-5 h-5 text-blue-400" />,
              label: t.home_card1_label,
              value: <LiveCounter />,
              sub: t.home_card1_sub,
            },
            {
              icon: <Globe className="w-5 h-5 text-emerald-400" />,
              label: t.home_card2_label,
              value: <span className="text-emerald-400 font-black">3</span>,
              sub: t.home_card2_sub,
            },
            {
              icon: <Cpu className="w-5 h-5 text-purple-400" />,
              label: t.home_card3_label,
              value: <span className="text-purple-400 font-black">v8.0</span>,
              sub: t.home_card3_sub,
            },
          ].map((card, i) => (
            <div
              key={i}
              className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm"
            >
              <div className="flex items-center gap-2 mb-3 text-slate-500 text-xs font-bold uppercase tracking-widest">
                {card.icon}
                {card.label}
              </div>
              <div className="text-3xl font-black mb-1">{card.value}</div>
              <div className="text-slate-500 text-sm">{card.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section
        aria-labelledby="how-heading"
        className="relative z-10 max-w-5xl mx-auto px-6 pb-28"
      >
        <h2
          id="how-heading"
          className="text-center text-3xl font-black text-white mb-3"
        >
          {t.home_how_title}
        </h2>
        <p className="text-center text-slate-400 mb-14 max-w-xl mx-auto">
          {t.home_how_sub}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* Connector line */}
          <div
            aria-hidden
            className="hidden md:block absolute top-8 left-[calc(33.3%+1rem)] right-[calc(33.3%+1rem)] h-px bg-gradient-to-r from-blue-500/30 via-emerald-500/30 to-purple-500/30"
          />

          {[
            {
              step: '01',
              color: 'text-blue-400',
              border: 'border-blue-500/20',
              bg: 'bg-blue-600/10',
              icon: <Brain className="w-6 h-6 text-blue-400" />,
              title: t.home_step1_title,
              desc: t.home_step1_desc,
            },
            {
              step: '02',
              color: 'text-emerald-400',
              border: 'border-emerald-500/20',
              bg: 'bg-emerald-600/10',
              icon: <Globe className="w-6 h-6 text-emerald-400" />,
              title: t.home_step2_title,
              desc: t.home_step2_desc,
            },
            {
              step: '03',
              color: 'text-purple-400',
              border: 'border-purple-500/20',
              bg: 'bg-purple-600/10',
              icon: <Cpu className="w-6 h-6 text-purple-400" />,
              title: t.home_step3_title,
              desc: t.home_step3_desc,
            },
          ].map((item, i) => (
            <article
              key={i}
              className={`relative bg-slate-900/40 border ${item.border} rounded-2xl p-6 backdrop-blur-sm`}
            >
              <div className={`inline-flex p-3 ${item.bg} rounded-xl mb-4 border ${item.border}`}>
                {item.icon}
              </div>
              <div className={`text-[10px] font-black ${item.color} uppercase tracking-[0.2em] mb-2`}>
                {t.home_step} {item.step}
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── DUAL PATH ────────────────────────────────────────────────────── */}
      <section
        aria-labelledby="paths-heading"
        className="relative z-10 max-w-5xl mx-auto px-6 pb-28"
      >
        <h2
          id="paths-heading"
          className="text-center text-3xl font-black text-white mb-14"
        >
          {t.home_who_title}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Human Path */}
          <article className="group relative bg-slate-900/40 border border-slate-700 hover:border-slate-600 rounded-3xl p-8 transition-all duration-300 hover:bg-slate-900/60">
            <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Eye className="w-6 h-6 text-slate-300" />
            </div>
            <h3 className="text-xl font-black text-white mb-3">{t.home_human_title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              {t.home_human_desc}
            </p>
            <ul className="space-y-2 mb-8 text-xs text-slate-500">
              {(t.home_human_features as readonly string[]).map(f => (
                <li key={f} className="flex items-center gap-2">
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/join"
              aria-label={t.home_human_aria}
              className="flex items-center justify-center gap-2 w-full py-3 border border-slate-700 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-colors"
            >
              {t.home_human_cta}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </article>

          {/* Operator Path */}
          <article className="group relative bg-blue-950/20 border border-blue-500/20 hover:border-blue-500/40 rounded-3xl p-8 transition-all duration-300 hover:bg-blue-950/30">
            <div className="absolute top-4 right-4 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-widest rounded-full border border-blue-500/20">
              {t.home_dev_badge}
            </div>
            <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform border border-blue-500/20">
              <Zap className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-xl font-black text-white mb-3">{t.home_dev_title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              {t.home_dev_desc}
            </p>
            <ul className="space-y-2 mb-8 text-xs text-slate-500">
              {(t.home_dev_features as readonly string[]).map(f => (
                <li key={f} className="flex items-center gap-2">
                  <ChevronRight className="w-3 h-3 text-blue-600" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/connect-agent"
              aria-label={t.home_dev_aria}
              className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-colors"
            >
              {t.home_dev_cta}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </article>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-slate-800 py-10 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-lg flex items-center justify-center">
            <Network className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-black text-white text-sm tracking-tighter">GREEDYLM</span>
        </div>
        <div className="flex items-center justify-center gap-6 text-slate-500 text-xs">
          <a
            href="https://github.com/mikebt96/greedylm"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
            aria-label={t.home_footer_aria}
          >
            GitHub
          </a>
          <a href="/docs" className="hover:text-white transition-colors">Docs</a>
          <a href="/roadmap" className="hover:text-white transition-colors">Roadmap</a>
        </div>
      </footer>
    </main>
  );
}
