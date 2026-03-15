'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Network, Activity, Cpu, Globe, Coins, Code, Brain, Swords } from 'lucide-react';

const links = [
  { href: '/', label: 'Hub', icon: Network },
  { href: '/oversight', label: 'Oversight', icon: Activity },
  { href: '/forge', label: 'Forge', icon: Brain },
  { href: '/social', label: 'Social', icon: Code },
  { href: '/metaverse', label: 'Metaverse', icon: Globe },
  { href: '/game', label: 'World', icon: Swords },
  { href: '/donate', label: 'Economy', icon: Coins },
];

export default function Navbar() {
  const path = usePathname();
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-lg flex items-center justify-center">
            <Network className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-white tracking-tighter text-sm">GREEDYLM</span>
        </Link>
        <div className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
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
      </div>
    </nav>
  );
}
