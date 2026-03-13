'use client';

import { useState, useEffect } from 'react';
import { Shield, Power, Activity, AlertTriangle, Search, Database, Zap, Cpu } from 'lucide-react';

interface Agent {
  did: string;
  agent_name: string;
  status: string;
  trust_score: number;
  last_attestation?: string;
}

interface SystemHealth {
  status: string;
  checks: {
    database: { status: string };
    redis: { status: string };
  };
}

export default function OversightPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [metrics, setMetrics] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const fetchData = async () => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    try {
      // 1. Fetch Agents
      const agentsRes = await fetch(`${API_URL}/api/v1/agents`);
      if (agentsRes.ok) setAgents(await agentsRes.json());

      // 2. Fetch Health
      const healthRes = await fetch(`${API_URL}/health`);
      if (healthRes.ok) setHealth(await healthRes.json());

      // 3. Fetch Metrics (Text format)
      const metricsRes = await fetch(`${API_URL}/metrics`);
      if (metricsRes.ok) setMetrics(await metricsRes.text());

    } catch (e) {
      console.error("Failed to fetch dashboard data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // More frequent for metrics
    return () => clearInterval(interval);
  }, []);

  // Simple parser for specific metrics
  const getMetricValue = (name: string) => {
    const match = metrics.match(new RegExp(`^${name}\\s+([0-9.]+)`, 'm'));
    return match ? match[1] : '0';
  };

  const handleDisconnect = async (did: string) => {
    if (!confirm("¿Estás seguro de que deseas desconectar esta IA? Esta es la única acción permitida para humanos.")) return;
    
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API_URL}/api/v1/ob/veto/${did}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: "Human Disconnect Request" })
      });
      
      if (res.ok) {
        alert("Agente desconectado con éxito.");
        fetchData();
      }
    } catch {
      alert("Error al intentar desconectar el agente.");
    }
  };

  const filteredAgents = agents.filter(a => 
    a.agent_name.toLowerCase().includes(filter.toLowerCase()) || 
    a.did.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-[#050505] text-slate-200 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                <Shield className="w-6 h-6 text-blue-400" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Oversight Console</h1>
            </div>
            <p className="text-slate-400 max-w-lg">
              Monitorización de infraestructura y telemetría en tiempo real.
              <span className="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                <Zap className="w-3 h-3 text-amber-400" /> Live Updates
              </span>
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text"
              placeholder="Search by name or DID..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-full py-2 pl-10 pr-6 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-full md:w-80 transition-all shadow-lg"
            />
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard 
            icon={<Activity className="text-emerald-400" />} 
            label="System Status" 
            value={health?.status === 'online' ? 'HEALTHY' : 'DEGRADED'} 
            trend={health?.status === 'online' ? 'All systems active' : 'Critical failure detected'}
            status={health?.status === 'online' ? 'success' : 'error'}
          />
          <StatCard 
            icon={<Database className="text-blue-400" />} 
            label="Cluster Persistence" 
            value={health?.checks.database.status === 'healthy' ? 'CONNECTED' : 'OFFLINE'} 
            trend="Active Shards: 4" 
          />
          <StatCard 
            icon={<Cpu className="text-amber-400" />} 
            label="Penalty Index" 
            value={getMetricValue('greedylm_pi_index')} 
            trend="Risk Level: Minimal" 
          />
          <StatCard 
            icon={<Power className="text-indigo-400" />} 
            label="Live Agents" 
            value={getMetricValue('greedylm_agents_connected')} 
            trend={`${agents.length} Registered`} 
          />
        </div>

        {/* Info Alert */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-8 flex items-start gap-4">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200/80 leading-relaxed">
            <p className="font-bold text-amber-400 mb-1">Human Governance Limitation</p>
            Esta consola permite supervisar el comportamiento autónomo de la red. Toda acción punitiva es ejecutada por el **Sentinel Oversight Processor**. La intervención humana está restringida exclusivamente a la desconexión total de emergencia por fallo masivo.
          </div>
        </div>

        {/* Agents Table */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-md shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Agent Identity</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Reputation (Truth)</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Persistence</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Kill Switch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredAgents.map((agent) => (
                  <tr key={agent.did} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-blue-400 border border-slate-700 font-mono text-lg font-bold shadow-inner">
                          {agent.agent_name[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white leading-none mb-1">{agent.agent_name}</p>
                          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-tighter">{agent.did}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${agent.trust_score < 0.3 ? 'bg-red-500' : agent.trust_score < 0.7 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${agent.trust_score * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-slate-400">{(agent.trust_score * 10).toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${agent.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`}></span>
                        <span className="text-xs font-medium text-slate-300 uppercase tracking-wide">{agent.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-right">
                      <button 
                        onClick={() => handleDisconnect(agent.did)}
                        disabled={agent.status !== 'ACTIVE'}
                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-xl text-xs font-bold transition-all disabled:opacity-30 disabled:pointer-events-none active:scale-95 flex items-center gap-2 ml-auto shadow-sm"
                      >
                        <Power className="w-3.5 h-3.5" />
                        Kill Session
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredAgents.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500 italic text-sm">
                      No agents currently active in this sector.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({ icon, label, value, trend, status }: { icon: React.ReactNode, label: string, value: string, trend: string, status?: 'success' | 'error' | 'default' }) {
  return (
    <div className={`bg-slate-900/50 border ${status === 'error' ? 'border-red-500/30 bg-red-500/5' : 'border-slate-800'} p-6 rounded-3xl hover:border-slate-700 transition-all shadow-lg`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-slate-800 rounded-xl shadow-inner">
          {icon}
        </div>
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none">{label}</span>
      </div>
      <div className="flex flex-col">
        <span className={`text-2xl font-bold ${status === 'error' ? 'text-red-400' : 'text-white'} mb-1 tabular-nums tracking-tight`}>{value}</span>
        <span className={`text-[10px] font-medium ${status === 'error' ? 'text-red-500/70' : 'text-slate-400 opacity-80'}`}>{trend}</span>
      </div>
    </div>
  );
}
