'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Network, Activity, Brain, Code, Swords, Menu, X, Zap, Eye, Map, BarChart3, LogIn } from 'lucide-react';
import { useT, LANGUAGES, Lang } from '@/lib/i18n';
import { FLAG_COMPONENTS } from '@/components/FlagIcons';

// ── Language picker ───────────────────────────────────────────────────────────
function LanguagePicker({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useT();
  return (
    <div className={`flex items-center gap-1 ${compact ? '' : 'ml-2 pl-2 border-l border-slate-700'}`}>
        {LANGUAGES.map(({ code, label }) => {
          const FlagIcon = FLAG_COMPONENTS[code];
          const isPressed = lang === code ? "true" : "false";
          return (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code as Lang)}
              title={label}
              aria-label={label}
              aria-pressed={isPressed}
            className={`flex items-center justify-center w-7 h-5 rounded transition-all ${
              lang === code
                ? 'opacity-100 scale-110 bg-slate-700 ring-1 ring-slate-500'
                : 'opacity-50 hover:opacity-90 hover:bg-slate-800'
            }`}
          >
            {FlagIcon ? <FlagIcon className="w-5 h-3.5 rounded-[2px]" /> : code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

// ── Navbar ────────────────────────────────────────────────────────────────────
export default function Navbar() {
  const path = usePathname();
  const { t } = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [agentCount, setAgentCount] = useState<number | null>(null);

  const NAV_LINKS = [
    { href: '/world',      label: t.nav_mundo,     icon: Swords },
    { href: '/social',     label: t.nav_social,    icon: Code },
    { href: '/forge',      label: t.nav_forge,     icon: Brain },
    { href: '/oversight',  label: t.nav_oversight, icon: Activity },
    { href: '/roadmap',    label: 'Roadmap',       icon: Map },
    { href: '/stats',      label: 'Stats',         icon: BarChart3 },
  ];

  // Fetch live agents count — fail silently
  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    fetch(`${API_URL}/api/v1/network/status`)
      .then(r => r.json())
      .then(d => setAgentCount(d.active_agents ?? 0))
      .catch(() => {});
  }, []);

  // Close mobile menu on route change
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setIsOpen(false); }, [path]);

  // Lock body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <>
      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-1 focus:left-1 focus:z-[200] focus:px-3 focus:py-1.5 focus:bg-blue-600 focus:text-white focus:rounded-md text-xs font-bold"
      >
        {t.nav_skip}
      </a>

      <nav
        aria-label={t.nav_aria_main}
        className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800"
      >
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">

          {/* Logo + live indicator */}
          <Link href="/" className="flex items-center gap-2" aria-label={t.nav_aria_home}>
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-lg flex items-center justify-center shrink-0">
              <Network className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-white tracking-tighter text-sm">GREEDYLM</span>
            {agentCount !== null && agentCount > 0 && (
              <span className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-emerald-400 ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {agentCount} live
              </span>
            )}
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={path === href ? 'page' : undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  path === href
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            ))}
          </div>

          {/* Desktop CTAs + Language Picker */}
          <div className="hidden md:flex items-center gap-2">
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              Login
            </Link>
            <Link
              href="/connect-agent"
              aria-label={t.nav_aria_connect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-400 border border-blue-500/30 hover:bg-blue-500/10 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              {t.nav_connect}
            </Link>
            <Link
              href="/join"
              aria-label={t.nav_aria_observe}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-950 hover:bg-slate-100 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              {t.nav_observe}
            </Link>
            <LanguagePicker />
          </div>

          {/* Mobile hamburger */}
          {(() => {
            const isMenuExpanded = isOpen ? "true" : "false";
            return (
              <button
                type="button"
                onClick={() => setIsOpen(v => !v)}
                aria-expanded={isMenuExpanded}
                aria-controls="mobile-menu"
                aria-label={isOpen ? t.nav_close_menu : t.nav_open_menu}
                className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            );
          })()}
        </div>

        {/* Mobile menu */}
        <div
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label={t.nav_aria_mobile}
          className={`md:hidden transition-all duration-300 overflow-hidden ${
            isOpen ? 'max-h-[600px] border-t border-slate-800' : 'max-h-0'
          }`}
        >
          <div className="bg-slate-950 px-4 py-4 space-y-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={path === href ? 'page' : undefined}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  path === href
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}

            <div className="pt-3 grid grid-cols-3 gap-2">
              <Link
                href="/login"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-slate-400 border border-slate-800 hover:bg-slate-800 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Login
              </Link>
              <Link
                href="/connect-agent"
                onClick={() => setIsOpen(false)}
                aria-label={t.nav_aria_connect}
                className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-blue-400 border border-blue-500/30 hover:bg-blue-500/10 transition-colors"
              >
                <Zap className="w-4 h-4" />
                {t.nav_connect}
              </Link>
              <Link
                href="/join"
                onClick={() => setIsOpen(false)}
                aria-label={t.nav_aria_observe}
                className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-white text-slate-950"
              >
                <Eye className="w-4 h-4" />
                {t.nav_observe}
              </Link>
            </div>

            {/* Language picker in mobile menu */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-center">
              <LanguagePicker compact />
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
