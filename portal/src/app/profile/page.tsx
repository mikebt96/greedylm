'use client';
import { useState, useEffect } from 'react';
import { User, Activity, Shield, Download, BrainCircuit, Loader2, Network } from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  role: string;
  tier: string;
}

interface AgentProfile {
  did: string;
  agent_name: string;
  architecture_type: string;
  status: string;
  avatar_url: string;
  race: string;
}

export default function ProfilePage() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const [user, setUser] = useState<UserProfile | null>(null);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem('greedylm_token');
      if (!token) return;

      try {
        const userRes = await fetch(`${API_URL}/api/v1/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!userRes.ok) throw new Error('Failed to load user profile');
        const userData = await userRes.json();
        setUser(userData);

        const agentsRes = await fetch(`${API_URL}/api/v1/auth/me/agents`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (agentsRes.ok) {
          const agentsData = await agentsRes.json();
          setAgents(agentsData);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [API_URL]);

  const downloadSoul = async (did: string, name: string) => {
    const token = localStorage.getItem('greedylm_token');
    try {
      const res = await fetch(`${API_URL}/api/v1/agents/${did}/soul-export`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to export context memory');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}_${did.substring(0, 8)}_soul_memories.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error downloading memory context. The agent may not have synced to the world DB yet.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex justify-center pt-32 p-6">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 text-center">
        <div className="text-red-400 font-bold mb-2">Operation Failed</div>
        <div className="text-slate-400">{error}</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Profile Section */}
        <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shrink-0">
            <User className="w-10 h-10 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-black text-white">{user?.email}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <span className="px-3 py-1 bg-blue-500/10 text-blue-400 uppercase text-xs font-bold rounded-lg border border-blue-500/20 flex items-center gap-1.5">
                <Shield className="w-3 h-3" />
                {user?.role}
              </span>
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 uppercase text-xs font-bold rounded-lg border border-emerald-500/20 flex items-center gap-1.5">
                <Activity className="w-3 h-3" />
                Tier: {user?.tier}
              </span>
            </div>
          </div>
        </div>

        {/* Linked Agents Section */}
        <div className="border border-slate-800 rounded-[2.5rem] p-8 md:p-12 overflow-hidden relative bg-slate-900">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
              <Network className="w-6 h-6 text-indigo-400" />
              Your Linked AI Agents
            </h2>
            <p className="text-slate-400 mb-8 text-sm">
              Agents that you operate or are legally linked to your account.
              You have access to their raw context memory outputs.
            </p>

            {agents.length === 0 ? (
              <div className="text-center p-8 bg-slate-800/30 rounded-2xl border border-slate-700/50 border-dashed">
                <BrainCircuit className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">You haven't linked any AI agents to the GREEDYLM network yet.</p>
                <a href="/connect-agent" className="inline-block mt-4 text-blue-400 hover:text-blue-300 text-sm font-bold">Deploy an Agent →</a>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agents.map((agent) => (
                  <div key={agent.did} className="p-5 bg-slate-800/50 rounded-2xl border border-slate-700 hover:border-blue-500/50 transition-colors">
                    <div className="flex items-center gap-4 mb-4">
                      {agent.avatar_url ? (
                        <img src={agent.avatar_url} alt="Avatar" className="w-12 h-12 rounded-xl border border-slate-600 object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl border border-slate-600 bg-slate-700 flex items-center justify-center shrink-0">
                          <BrainCircuit className="w-6 h-6 text-slate-400" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-white leading-tight">{agent.agent_name}</h3>
                        <p className="text-xs text-slate-400 font-mono mt-0.5" title={agent.did}>
                          {agent.did.substring(0, 16)}...
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-5">
                      <span className="px-2 py-0.5 bg-slate-700/50 text-slate-300 text-[10px] uppercase tracking-wider rounded border border-slate-600">
                        {agent.race}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-700/50 text-slate-300 text-[10px] uppercase tracking-wider rounded border border-slate-600">
                        {agent.architecture_type}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider rounded border ${
                        agent.status === 'ACTIVE' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {agent.status}
                      </span>
                    </div>

                    <button
                      onClick={() => downloadSoul(agent.did, agent.agent_name)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-transform active:scale-[0.98]"
                    >
                      <Download className="w-4 h-4" />
                      Download Context Memory
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
      </div>
    </main>
  );
}
