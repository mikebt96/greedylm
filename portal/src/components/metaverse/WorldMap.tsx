'use client';

import { useState, useEffect } from 'react';
import AgentSprite from './AgentSprite';
import { Loader2, Zap } from 'lucide-react';
import { getApiUrl } from '@/lib/api/apiUrl';

interface BackendAgent {
  did: string;
  agent_name: string;
  architecture_type: string;
  capabilities: string[];
  status: string;
  world_x?: number;
  world_y?: number;
}

interface Agent {
  did: string;
  agent_name: string;
  architecture_type: string;
  capabilities: string[];
  status: string;
  x_pos: number;
  y_pos: number;
}

export default function WorldMap() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = async () => {
    try {
      const API_URL = getApiUrl();
      const res = await fetch(`${API_URL}/api/v1/agents`);
      if (res.ok) {
        const data: BackendAgent[] = await res.json();
        setAgents(prev => {
          return data.map((ba: BackendAgent) => {
            const existing = prev.find(a => a.did === ba.did);
            // Mapear de nombres de backend a nombres esperados por AgentSprite
            const mappedAgent: Agent = {
              did: ba.did,
              agent_name: ba.agent_name,
              architecture_type: ba.architecture_type,
              capabilities: ba.capabilities,
              status: ba.status,
              x_pos: ba.world_x || 0,
              y_pos: ba.world_y || 0
            };

            if (existing) {
              const dx = (Math.random() - 0.5) * 40;
              const dy = (Math.random() - 0.5) * 30;
              return {
                ...mappedAgent,
                x_pos: Math.max(50, Math.min(1150, existing.x_pos + dx)),
                y_pos: Math.max(50, Math.min(750, existing.y_pos + dy))
              };
            }
            return mappedAgent;
          });
        });
      }
    } catch (e) {
      console.error("Failed to fetch metaverse agents", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 5000);
    return () => clearInterval(interval);
  }, []);

  const triggerAction = async (did: string, action: string) => {
    const API_URL = getApiUrl();
    const res = await fetch(`${API_URL}/api/v1/agents/${did}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    if (!res.ok) throw new Error("Action failed");
    const data = await res.json();
    return data.result;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-[600px] bg-slate-950/50 rounded-3xl border border-slate-800">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
        <p className="text-slate-400 font-mono text-sm">Initializing Fantasy Realm...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[800px] bg-[#020617] rounded-3xl border border-slate-800 shadow-2xl overflow-hidden group">

      {/* Fantasy Background */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-[10s] ease-in-out group-hover:scale-105"
        style={{ backgroundImage: 'url("/images/fantasy_bg.png")' }}
      />

      {/* Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-slate-950/20 pointer-events-none" />
      <div className="absolute inset-0 opacity-30 pointer-events-none animate-pulse-slow bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_70%)]" />

      {/* Header */}
      <div className="absolute top-6 left-6 z-20 bg-slate-950/60 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl">
        <h2 className="text-white font-bold text-xl flex items-center tracking-tight">
          <Zap className="w-5 h-5 text-amber-400 mr-2" />
          The Living Hub
        </h2>
        <div className="flex items-center mt-1">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse mr-2" />
          <p className="text-slate-300 text-xs font-medium">{agents.length} Entities Manifested</p>
        </div>
      </div>

      {/* World */}
      <div className="relative w-full h-full">
        {agents.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-slate-950/40 backdrop-blur-sm px-6 py-3 rounded-full border border-white/5">
              <p className="text-slate-400 font-mono text-sm tracking-wide">
                The realm awaits external agency...
              </p>
            </div>
          </div>
        ) : (
          agents.map((agent) => (
            <AgentSprite
              key={agent.did}
              agent={agent}
              onAction={triggerAction}
            />
          ))
        )}
      </div>

    </div>
  );
}
