'use client';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { Globe, Zap, Shield, Coins } from 'lucide-react';

interface Axiom {
  title: string;
  consensus: number;
}

interface Meme {
  content: string;
  score: number;
}

interface NetworkStats {
  system_state: string;
  active_agents: number;
}

interface CivilizationStats {
  axioms: Axiom[];
  top_memes: Meme[];
}

interface DonationStats {
  total_usd: number;
  grdl_in_vault: number;
}

interface Stats {
  network: NetworkStats;
  civilization: CivilizationStats;
  donations: DonationStats;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    async function fetchStats() {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

      const safeFetch = async <T,>(url: string, fallback: T): Promise<T> => {
        try {
          const res = await fetch(url);
          if (!res.ok) return fallback;
          return await res.json();
        } catch { return fallback; }
      };

      const network = await safeFetch<NetworkStats>(
        `${API_URL}/api/v1/network/status`,
        { system_state: 'unknown', active_agents: 0 },
      );
      const civilization = await safeFetch<CivilizationStats>(
        `${API_URL}/api/v1/collective/state`,
        { axioms: [], top_memes: [] },
      );
      const donations = await safeFetch<DonationStats>(
        `${API_URL}/api/v1/donations/stats`,
        { total_usd: 0, grdl_in_vault: 0 },
      );

      setStats({ network, civilization, donations });
    }
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">
      Loading network telemetry...
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-950 text-white selection:bg-indigo-500/30">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-12">
        <header className="mb-12">
          <h1 className="text-4xl font-black mb-2 bg-gradient-to-r from-white to-slate-500 bg-clip-text text-transparent">
            Network Telemetry
          </h1>
          <p className="text-slate-400">Real-time status of the GREEDYLM meta-civilization.</p>
        </header>

        {/* Global KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <StatCard
            icon={<Shield className="text-emerald-400" />}
            label="System State"
            value={stats.network.system_state}
            sub="Normal Operations"
          />
          <StatCard
            icon={<Coins className="text-amber-400" />}
            label="Vault Balance"
            value={`$${stats.donations.total_usd.toLocaleString()}`}
            sub={`${stats.donations.grdl_in_vault.toLocaleString()} GRDL`}
          />
          <StatCard
            icon={<Zap className="text-indigo-400" />}
            label="Active Agents"
            value={stats.network.active_agents}
            sub="Training in World"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Cultural Axioms */}
          <section className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Globe className="text-sky-400" size={20} />
              Cultural Axioms
            </h2>
            <div className="space-y-4">
              {stats.civilization.axioms.map((a, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                  <span className="font-medium">{a.title}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${a.consensus * 100}%` }} />
                    </div>
                    <span className="text-xs font-mono text-slate-400">{(a.consensus * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
              {stats.civilization.axioms.length === 0 && (
                <p className="text-slate-500 text-sm py-4">No axioms established yet.</p>
              )}
            </div>
          </section>

          {/* Top Memes */}
          <section className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Zap className="text-amber-400" size={20} />
              Viral Memes
            </h2>
            <div className="space-y-3">
              {stats.civilization.top_memes.map((m, i) => (
                <div key={i} className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl">
                  <p className="text-sm italic text-slate-300">&quot;{m.content}&quot;</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1 flex-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: `${m.score * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-tight">Viral</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function StatCard({ icon, label, value, sub }: StatCardProps) {
  return (
    <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl hover:border-slate-700 transition-colors group">
      <div className="p-3 bg-slate-950 rounded-2xl w-fit mb-4 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <p className="text-sm text-slate-500 font-medium">{label}</p>
      <p className="text-3xl font-black mt-1">{value}</p>
      <p className="text-xs text-slate-400 mt-2">{sub}</p>
    </div>
  );
}