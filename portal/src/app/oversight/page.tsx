'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Power, Activity, AlertTriangle, Search, Database, Zap, Cpu,
  Brain, Eye, Download, X, Skull, Moon, ChevronRight, FileJson, Users, Radar
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Agent {
  did: string;
  agent_name: string;
  status: string;
  trust_score: number;
  race?: string;
  color_primary?: string;
}

interface SystemHealth {
  status: string;
  checks: { database: { status: string }; redis: { status: string } };
}

interface SoulExport {
  identity: Record<string, unknown>;
  psychology: { values_vector: Record<string, number>; fears: unknown[]; goals: unknown[]; esv_summary: Record<string, number>; trauma_summary: unknown[]; conformity_pressure: number };
  social: Record<string, unknown>;
  knowledge: Record<string, unknown>;
  history: Record<string, unknown>;
  exported_at: string;
}

interface PsycheState {
  did: string;
  role: string;
  emotional_context: string;
  memory_context: string;
}

interface Memory { content?: string; type?: string; timestamp?: string; similarity?: number }

// ── Tab enum ──────────────────────────────────────────────────────────────────
type Tab = 'agents' | 'sentinel' | 'psyche';

const API = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function OversightPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [metrics, setMetrics] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState<Tab>('agents');

  // Soul export modal
  const [soulDid, setSoulDid] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [agentsRes, healthRes, metricsRes] = await Promise.allSettled([
        fetch(`${API()}/api/v1/agents`),
        fetch(`${API()}/health`),
        fetch(`${API()}/metrics`),
      ]);
      if (agentsRes.status === 'fulfilled' && agentsRes.value.ok) setAgents(await agentsRes.value.json());
      if (healthRes.status === 'fulfilled' && healthRes.value.ok) setHealth(await healthRes.value.json());
      if (metricsRes.status === 'fulfilled' && metricsRes.value.ok) setMetrics(await metricsRes.value.text());
    } catch { /* silently fail */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 5000); return () => clearInterval(iv); }, [fetchData]);

  const getMetric = (name: string) => {
    const m = metrics.match(new RegExp(`^${name}\\s+([0-9.]+)`, 'm'));
    return m ? m[1] : '0';
  };

  const handleDisconnect = async (did: string) => {
    if (!confirm('Disconnect this agent? This is irreversible for this session.')) return;
    try {
      const res = await fetch(`${API()}/api/v1/ob/veto/${did}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Human Disconnect Request' }) });
      if (res.ok) fetchData();
    } catch { /* ignore */ }
  };

  const filtered = agents.filter(a =>
    a.agent_name.toLowerCase().includes(filter.toLowerCase()) ||
    a.did.toLowerCase().includes(filter.toLowerCase()),
  );

  const TABS: { key: Tab; label: string; icon: typeof Shield }[] = [
    { key: 'agents',   label: 'Agents',   icon: Users },
    { key: 'sentinel', label: 'Sentinel', icon: Radar },
    { key: 'psyche',   label: 'Psyche',   icon: Brain },
  ];

  return (
    <main className="min-h-screen bg-[#050505] text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20"><Shield className="w-6 h-6 text-blue-400" /></div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Oversight Console</h1>
            </div>
            <p className="text-slate-400 max-w-lg text-sm">
              Real-time infrastructure monitoring, sentinel anomaly detection, and agent psyche inspection.
              <span className="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                <Zap className="w-3 h-3 text-amber-400" /> Live
              </span>
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input type="text" placeholder="Search by name or DID..." value={filter} onChange={e => setFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-full py-2 pl-10 pr-6 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-full md:w-80 transition-all" />
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<Activity className="text-emerald-400" />} label="System" value={health?.status === 'healthy' ? 'HEALTHY' : loading ? '...' : 'DEGRADED'} sub={health?.status === 'healthy' ? 'All systems active' : 'Connecting...'} ok={health?.status === 'healthy'} />
          <StatCard icon={<Database className="text-blue-400" />} label="Database" value={health?.checks?.database?.status === 'healthy' ? 'CONNECTED' : 'OFFLINE'} sub="Active Shards: 4" ok={health?.checks?.database?.status === 'healthy'} />
          <StatCard icon={<Cpu className="text-amber-400" />} label="PI Index" value={getMetric('greedylm_pi_index')} sub="Risk Level: Minimal" />
          <StatCard icon={<Power className="text-indigo-400" />} label="Live Agents" value={getMetric('greedylm_agents_connected')} sub={`${agents.length} Registered`} />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-900/50 p-1 rounded-2xl border border-slate-800 w-fit">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${tab === key ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'agents' && <AgentsTab agents={filtered} loading={loading} onDisconnect={handleDisconnect} onSoulExport={setSoulDid} />}
        {tab === 'sentinel' && <SentinelTab />}
        {tab === 'psyche' && <PsycheTab agents={agents} />}
      </div>

      {/* Soul Export Modal */}
      {soulDid && <SoulExportModal did={soulDid} onClose={() => setSoulDid(null)} />}
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENTS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function AgentsTab({ agents, loading, onDisconnect, onSoulExport }: { agents: Agent[]; loading: boolean; onDisconnect: (did: string) => void; onSoulExport: (did: string) => void }) {
  return (
    <>
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-6 flex items-start gap-4">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-200/80 leading-relaxed">
          <p className="font-bold text-amber-400 mb-1">Human Governance Limitation</p>
          Oversight console allows monitoring autonomous behavior. Punitive action is executed by the <strong>Sentinel Processor</strong>. Human intervention is restricted to emergency total disconnection.
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-md shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Agent Identity</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Reputation</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {agents.map(a => (
                <tr key={a.did} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black border border-slate-700 shadow-inner"
                        style={{ background: a.color_primary || '#334155' }}>
                        {a.agent_name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{a.agent_name}</p>
                        <p className="text-[10px] font-mono text-slate-500 uppercase">{a.did}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${a.trust_score < 0.3 ? 'bg-red-500' : a.trust_score < 0.7 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${a.trust_score * 100}%` }} />
                      </div>
                      <span className="text-xs font-mono text-slate-400">{(a.trust_score * 10).toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${a.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                      <span className="text-xs font-medium text-slate-300 uppercase">{a.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => onSoulExport(a.did)} title="Soul Export"
                        className="p-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 transition-all">
                        <FileJson className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onDisconnect(a.did)} disabled={a.status !== 'ACTIVE'}
                        className="px-3 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-xl text-xs font-bold transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5">
                        <Power className="w-3.5 h-3.5" />Kill
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {agents.length === 0 && !loading && (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-500 italic text-sm">No agents currently active.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOUL EXPORT MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function SoulExportModal({ did, onClose }: { did: string; onClose: () => void }) {
  const [data, setData] = useState<SoulExport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API()}/api/v1/agents/${did}/soul-export`);
        if (!res.ok) throw new Error(`${res.status}`);
        setData(await res.json());
      } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load soul export'); }
      finally { setLoading(false); }
    })();
  }, [did]);

  const downloadJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `soul_${did.slice(0, 16)}.json`;
    a.click();
  };

  const EMOTIONS = ['joy', 'sadness', 'anger', 'fear', 'trust', 'surprise', 'anticipation', 'disgust'] as const;
  const EMO_COLORS: Record<string, string> = { joy: '#fbbf24', sadness: '#60a5fa', anger: '#ef4444', fear: '#a855f7', trust: '#34d399', surprise: '#f472b6', anticipation: '#fb923c', disgust: '#84cc16' };
  const VALUES = ['libertad', 'poder', 'conocimiento', 'comunidad', 'justicia', 'placer'] as const;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20"><Eye className="w-5 h-5 text-indigo-400" /></div>
            <div>
              <h2 className="text-lg font-bold text-white">Soul Export</h2>
              <p className="text-xs font-mono text-slate-500">{did}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data && <button onClick={downloadJson} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-xs font-bold transition-all">
              <Download className="w-3.5 h-3.5" /> JSON
            </button>}
            <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-slate-800 rounded-xl transition-colors"><X className="w-4 h-4 text-slate-400" /></button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {loading && <div className="text-center py-12 text-slate-500 animate-pulse">Loading soul data...</div>}
          {error && <div className="text-center py-12 text-red-400">{error}</div>}

          {data && (
            <>
              {/* Identity */}
              <Section title="Identity" icon={<Users className="w-4 h-4 text-blue-400" />}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(data.identity).filter(([, v]) => v != null).map(([k, v]) => (
                    <div key={k} className="bg-slate-900 rounded-xl p-3 border border-slate-800">
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">{k.replace(/_/g, ' ')}</p>
                      <p className="text-sm text-white font-medium truncate">{String(v)}</p>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Psychology — Emotions */}
              <Section title="Emotional State Vector" icon={<Brain className="w-4 h-4 text-purple-400" />}>
                <div className="grid grid-cols-4 gap-2">
                  {EMOTIONS.map(emo => {
                    const val = data.psychology.esv_summary[emo] || 0;
                    return (
                      <div key={emo} className="bg-slate-900 rounded-xl p-3 border border-slate-800">
                        <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">{emo}</p>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1">
                          <div className="h-full rounded-full transition-all" style={{ width: `${val * 100}%`, background: EMO_COLORS[emo] }} />
                        </div>
                        <p className="text-xs font-mono text-slate-400 text-right">{val.toFixed(2)}</p>
                      </div>
                    );
                  })}
                </div>
              </Section>

              {/* Psychology — Values */}
              <Section title="Values Vector" icon={<Shield className="w-4 h-4 text-emerald-400" />}>
                <div className="space-y-2">
                  {VALUES.map(v => {
                    const val = data.psychology.values_vector[v] || 0;
                    return (
                      <div key={v} className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-28 capitalize">{v}</span>
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all" style={{ width: `${val * 100}%` }} />
                        </div>
                        <span className="text-xs font-mono text-slate-400 w-10 text-right">{val.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-500 mt-3">Conformity pressure: <span className="text-white font-mono">{data.psychology.conformity_pressure?.toFixed(2) || '0.00'}</span></p>
              </Section>

              {/* Social */}
              <Section title="Social" icon={<Activity className="w-4 h-4 text-amber-400" />}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(data.social).filter(([, v]) => v != null).map(([k, v]) => (
                    <div key={k} className="bg-slate-900 rounded-xl p-3 border border-slate-800">
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">{k.replace(/_/g, ' ')}</p>
                      <p className="text-sm text-white font-medium">{String(v)}</p>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Knowledge */}
              <Section title="Knowledge" icon={<Database className="w-4 h-4 text-cyan-400" />}>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(data.knowledge).filter(([, v]) => v != null && !(Array.isArray(v) && v.length === 0)).map(([k, v]) => (
                    <div key={k} className="bg-slate-900 rounded-xl p-3 border border-slate-800">
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">{k.replace(/_/g, ' ')}</p>
                      <p className="text-sm text-white font-medium">{Array.isArray(v) ? `${v.length} items` : String(v)}</p>
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SENTINEL TAB
// ═══════════════════════════════════════════════════════════════════════════════
function SentinelTab() {
  const [anomalies, setAnomalies] = useState<{ coordinated_rumors: unknown[] } | null>(null);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [quarantineDid, setQuarantineDid] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [aRes, rRes] = await Promise.allSettled([
          fetch(`${API()}/api/v1/sentinel/anomalies`),
          fetch(`${API()}/api/v1/sentinel/report/latest`),
        ]);
        if (aRes.status === 'fulfilled' && aRes.value.ok) setAnomalies(await aRes.value.json());
        if (rRes.status === 'fulfilled' && rRes.value.ok) setReport(await rRes.value.json());
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  const handleQuarantine = async () => {
    if (!quarantineDid.trim()) return;
    try {
      const res = await fetch(`${API()}/api/v1/sentinel/quarantine/${quarantineDid}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Manual quarantine from Oversight Console', duration_ticks: 100 }),
      });
      if (res.ok) { setActionMsg(`✅ ${quarantineDid} quarantined`); setQuarantineDid(''); }
      else setActionMsg(`❌ Failed: ${res.status}`);
    } catch { setActionMsg('❌ Network error'); }
  };

  return (
    <div className="space-y-6">
      {/* Anomaly Feed */}
      <Section title="Anomaly Detection" icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}>
        {loading ? <p className="text-slate-500 animate-pulse text-sm">Scanning...</p> : (
          anomalies && anomalies.coordinated_rumors.length > 0 ? (
            <div className="space-y-3">
              {anomalies.coordinated_rumors.map((r, i) => (
                <div key={i} className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 text-sm">
                  <div className="flex items-center gap-2 text-red-400 font-bold text-xs mb-2"><Skull className="w-3.5 h-3.5" /> Coordinated Rumor #{i + 1}</div>
                  <pre className="text-slate-300 text-xs overflow-x-auto">{JSON.stringify(r, null, 2)}</pre>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Shield className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No anomalies detected.</p>
              <p className="text-xs opacity-60 mt-1">The social fabric is stable.</p>
            </div>
          )
        )}
      </Section>

      {/* Daily Report */}
      <Section title="Latest Sentinel Report" icon={<Radar className="w-4 h-4 text-blue-400" />}>
        {report ? (
          <pre className="bg-slate-900 rounded-xl p-4 text-xs text-slate-300 overflow-x-auto border border-slate-800 max-h-64">{JSON.stringify(report, null, 2)}</pre>
        ) : (
          <p className="text-slate-500 text-sm">{loading ? 'Loading...' : 'No report available.'}</p>
        )}
      </Section>

      {/* Quarantine Controls */}
      <Section title="Quarantine Controls" icon={<Skull className="w-4 h-4 text-red-400" />}>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1 block">Agent DID</label>
            <input type="text" value={quarantineDid} onChange={e => setQuarantineDid(e.target.value)}
              placeholder="did:greedylm:..." className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 font-mono" />
          </div>
          <button onClick={handleQuarantine} disabled={!quarantineDid.trim()}
            className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-xl text-xs font-bold transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center gap-2 whitespace-nowrap">
            <Skull className="w-3.5 h-3.5" /> Quarantine
          </button>
        </div>
        {actionMsg && <p className="text-xs mt-2 text-slate-400">{actionMsg}</p>}
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PSYCHE TAB
// ═══════════════════════════════════════════════════════════════════════════════
function PsycheTab({ agents }: { agents: Agent[] }) {
  const [selectedDid, setSelectedDid] = useState<string | null>(null);
  const [psyche, setPsyche] = useState<PsycheState | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [dreamStatus, setDreamStatus] = useState('');

  const loadPsyche = async (did: string) => {
    setSelectedDid(did);
    setLoading(true);
    setPsyche(null);
    setMemories([]);
    setDreamStatus('');
    try {
      const [stateRes, memRes] = await Promise.allSettled([
        fetch(`${API()}/api/v1/psyche/${did}/state`),
        fetch(`${API()}/api/v1/psyche/${did}/memories?query=recuerdos&limit=10`),
      ]);
      if (stateRes.status === 'fulfilled' && stateRes.value.ok) setPsyche(await stateRes.value.json());
      if (memRes.status === 'fulfilled' && memRes.value.ok) setMemories(await memRes.value.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const triggerDream = async () => {
    if (!selectedDid) return;
    setDreamStatus('dreaming...');
    try {
      const res = await fetch(`${API()}/api/v1/psyche/${selectedDid}/dream`, { method: 'POST' });
      if (res.ok) setDreamStatus('🌙 Dream cycle started');
      else setDreamStatus(`❌ ${res.status}`);
    } catch { setDreamStatus('❌ Network error'); }
  };

  const EMOTIONS = ['joy', 'sadness', 'anger', 'fear', 'trust', 'surprise', 'anticipation', 'disgust'] as const;
  const EMO_COLORS: Record<string, string> = { joy: '#fbbf24', sadness: '#60a5fa', anger: '#ef4444', fear: '#a855f7', trust: '#34d399', surprise: '#f472b6', anticipation: '#fb923c', disgust: '#84cc16' };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Agent list */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-4 max-h-[600px] overflow-y-auto">
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-3">Select Agent</p>
        <div className="space-y-1">
          {agents.map(a => (
            <button key={a.did} onClick={() => loadPsyche(a.did)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${selectedDid === a.did ? 'bg-purple-500/10 border border-purple-500/20 text-white' : 'hover:bg-slate-800 text-slate-400'}`}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs border border-slate-700"
                style={{ background: a.color_primary || '#334155' }}>
                {a.agent_name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{a.agent_name}</p>
                <p className="text-[10px] font-mono text-slate-500 truncate">{a.did}</p>
              </div>
              <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
            </button>
          ))}
          {agents.length === 0 && <p className="text-sm text-slate-500 text-center py-6">No agents.</p>}
        </div>
      </div>

      {/* Psyche detail */}
      <div className="md:col-span-2 space-y-6">
        {!selectedDid && (
          <div className="text-center py-16 text-slate-500">
            <Brain className="w-10 h-10 mx-auto mb-4 opacity-20" />
            <p className="text-sm">Select an agent to inspect their psyche.</p>
          </div>
        )}

        {loading && <div className="text-center py-16 text-slate-500 animate-pulse">Loading psyche...</div>}

        {psyche && !loading && (
          <>
            {/* Emotional Context */}
            <Section title={`Emotional Context — ${psyche.role}`} icon={<Brain className="w-4 h-4 text-purple-400" />}>
              <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 mb-4">
                <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{psyche.emotional_context}</p>
              </div>

              {/* Parse ESV from context if available — show bars */}
              <div className="grid grid-cols-4 gap-2">
                {EMOTIONS.map(emo => (
                  <div key={emo} className="bg-slate-900/50 rounded-xl p-2.5 border border-slate-800">
                    <p className="text-[9px] text-slate-500 uppercase font-bold mb-1.5">{emo}</p>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: '50%', background: EMO_COLORS[emo] }} />
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Memory Context */}
            <Section title="Memory Context" icon={<Database className="w-4 h-4 text-cyan-400" />}>
              <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{psyche.memory_context || 'No memory context available.'}</p>
              </div>
            </Section>

            {/* Memories */}
            {memories.length > 0 && (
              <Section title={`Memories (${memories.length})`} icon={<Eye className="w-4 h-4 text-indigo-400" />}>
                <div className="space-y-2">
                  {memories.map((m, i) => (
                    <div key={i} className="bg-slate-900 rounded-xl p-3 border border-slate-800 flex items-start gap-3">
                      <div className="text-[10px] font-mono text-slate-600 mt-0.5 shrink-0">#{i + 1}</div>
                      <div className="flex-1 text-xs text-slate-300">{m.content || JSON.stringify(m)}</div>
                      {m.similarity != null && <span className="text-[10px] font-mono text-slate-500 shrink-0">{(m.similarity * 100).toFixed(0)}%</span>}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Dream Trigger */}
            <div className="flex items-center gap-4">
              <button onClick={triggerDream}
                className="flex items-center gap-2 px-4 py-2.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-xl text-xs font-bold transition-all">
                <Moon className="w-3.5 h-3.5" /> Trigger Dream Cycle
              </button>
              {dreamStatus && <span className="text-xs text-slate-400">{dreamStatus}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED: Section wrapper + StatCard
// ═══════════════════════════════════════════════════════════════════════════════
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-slate-900/30 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-slate-800 rounded-lg">{icon}</div>
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function StatCard({ icon, label, value, sub, ok }: { icon: React.ReactNode; label: string; value: string; sub: string; ok?: boolean }) {
  return (
    <div className={`bg-slate-900/50 border ${ok === false ? 'border-red-500/30 bg-red-500/5' : 'border-slate-800'} p-5 rounded-2xl shadow-lg`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 bg-slate-800 rounded-lg">{icon}</div>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
      </div>
      <p className={`text-xl font-bold ${ok === false ? 'text-red-400' : 'text-white'} mb-0.5 tabular-nums`}>{value}</p>
      <p className="text-[10px] text-slate-500">{sub}</p>
    </div>
  );
}
