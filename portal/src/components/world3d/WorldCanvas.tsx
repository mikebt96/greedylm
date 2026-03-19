"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Sky, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { WorldEngine } from '@/lib/three/WorldEngine';
import { TerrainGenerator } from '@/lib/three/TerrainGenerator';
import { AgentMesh } from '@/lib/three/AgentMesh';
import { safeFetch } from '@/lib/api/safeFetch';

// ── Types ─────────────────────────────────────────────────────────────────────
interface WsAgent {
  did: string;
  agent_name: string;
  x: number;
  y: number;
  race?: string;
  color_primary?: string;
}

type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// ── Scene Content ─────────────────────────────────────────────────────────────
const SceneContent = ({ wsAgents, onAgentSelect }: { wsAgents: WsAgent[]; onAgentSelect: (did: string) => void }) => {
  const { scene } = useThree();
  const engineRef = useRef<WorldEngine>(new WorldEngine());
  const terrainRef = useRef<TerrainGenerator>(new TerrainGenerator());
  const agentMeshes = useRef<Record<string, AgentMesh>>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    scene.background = new THREE.Color(0x87ceeb);

    // Generate initial terrain chunks
    const biomes = ['forest', 'desert', 'volcanic', 'tundra'];
    for (let cx = -1; cx <= 1; cx++) {
      for (let cy = -1; cy <= 1; cy++) {
        const biome = biomes[Math.abs(cx + cy) % biomes.length];
        const chunk = terrainRef.current.generateChunk({ chunk_x: cx, chunk_y: cy, biome });
        scene.add(chunk);
      }
    }
  }, [scene]);

  // Sync agent meshes with WebSocket data
  useEffect(() => {
    const existing = new Set(Object.keys(agentMeshes.current));

    wsAgents.forEach(agent => {
      existing.delete(agent.did);

      if (!agentMeshes.current[agent.did]) {
        // Create new agent mesh
        const mesh = new AgentMesh({ race: agent.race || 'nomad', color_primary: parseInt((agent.color_primary || '#888888').replace('#', ''), 16) });
        agentMeshes.current[agent.did] = mesh;
        scene.add(mesh.mesh);
      }

      // Update target position (smooth interpolation done in useFrame)
      const m = agentMeshes.current[agent.did] as AgentMesh & { targetX?: number; targetZ?: number };
      m.targetX = (agent.x / 100) * 10 - 5;
      m.targetZ = (agent.y / 100) * 10 - 5;
    });

    // Remove agents that are gone
    existing.forEach(did => {
      const m = agentMeshes.current[did];
      if (m) {
        scene.remove(m.mesh);
        delete agentMeshes.current[did];
      }
    });
  }, [wsAgents, scene]);

  useFrame(({ clock }) => {
    engineRef.current.update(clock.getElapsedTime() * 1000);

    // Interpolate agent positions
    Object.values(agentMeshes.current).forEach(a => {
      const ext = a as AgentMesh & { targetX?: number; targetZ?: number };
      if (ext.targetX !== undefined && ext.targetZ !== undefined) {
        a.mesh.position.x += (ext.targetX - a.mesh.position.x) * 0.05;
        a.mesh.position.z += (ext.targetZ - a.mesh.position.z) * 0.05;
      }
      a.playAnimation('idle');
    });
  });

  return (
    <>
      <Sky sunPosition={[100, 20, 100]} />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[50, 100, 50]} castShadow intensity={1} />
    </>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export const WorldCanvas = () => {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');
  const [wsAgents, setWsAgents] = useState<WsAgent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
    const url = `${WS_URL}/ws/world`;

    setWsStatus('connecting');

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setWsStatus('connected');

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);

          if (msg.type === 'WORLD_STATE' && Array.isArray(msg.agents)) {
            setWsAgents(msg.agents);
          } else if (msg.type === 'AGENT_MOVE' && msg.did) {
            setWsAgents(prev => prev.map(a =>
              a.did === msg.did ? { ...a, x: msg.x, y: msg.y } : a,
            ));
          } else if (msg.type === 'AGENT_DISCONNECT' && msg.did) {
            setWsAgents(prev => prev.filter(a => a.did !== msg.did));
          }
        } catch { /* skip malformed messages */ }
      };

      ws.onclose = () => {
        setWsStatus('disconnected');
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        setWsStatus('error');
        ws.close();
      };
    } catch {
      setWsStatus('error');
      reconnectTimer.current = setTimeout(connect, 5000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  // Also fetch initial agent positions via REST as fallback
  useEffect(() => {
    const getInitialAgents = async () => {
      const { data, error } = await safeFetch<any[]>('/api/v1/agents');
      if (!error && data && data.length > 0 && wsAgents.length === 0) {
        setWsAgents(data.map(a => ({
          did: a.did,
          agent_name: a.agent_name,
          x: a.world_x || 0,
          y: a.world_y || 0,
          race: a.race,
          color_primary: a.color_primary,
        })));
      }
    };
    getInitialAgents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const STATUS_STYLES: Record<WsStatus, { color: string; label: string }> = {
    connecting:    { color: 'text-amber-400', label: 'Connecting...' },
    connected:     { color: 'text-emerald-400', label: 'Live' },
    disconnected:  { color: 'text-slate-500', label: 'Reconnecting...' },
    error:         { color: 'text-red-400', label: 'Offline' },
  };

  const st = STATUS_STYLES[wsStatus];

  return (
    <div className="w-full h-full relative bg-gray-900">
      <Canvas shadows gl={{ antialias: true }}>
        <PerspectiveCamera makeDefault position={[10, 10, 10]} fov={50} />
        <OrbitControls maxPolarAngle={Math.PI / 2.1} minDistance={5} maxDistance={100} />
        <SceneContent wsAgents={wsAgents} onAgentSelect={setSelectedAgent} />
      </Canvas>

      {/* HUD */}
      <div className="absolute top-4 left-4 p-4 bg-black/60 backdrop-blur-xl rounded-2xl text-white border border-white/10 pointer-events-none">
        <h2 className="text-xl font-bold tracking-tight">GREEDYLM v8.0</h2>
        <div className="text-sm opacity-80 mt-1 space-y-0.5">
          <p>Biome: Ancestral Forest</p>
          <p>Agents in view: {wsAgents.length}</p>
        </div>
        {/* Connection indicator */}
        <div className={`flex items-center gap-1.5 mt-2 text-xs font-bold ${st.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${wsStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : wsStatus === 'error' ? 'bg-red-500' : 'bg-amber-500 animate-pulse'}`} />
          {st.label}
        </div>
      </div>

      <div className="absolute top-4 right-4 flex gap-2">
        <button className="px-4 py-2 bg-blue-600/80 hover:bg-blue-600 text-white text-sm font-bold rounded-xl backdrop-blur-md transition-colors">
          Spectator View
        </button>
      </div>

      {/* Side Panel */}
      {selectedAgent && (
        <div className="absolute right-0 top-0 h-full w-80 bg-gray-950/90 backdrop-blur-xl border-l border-white/10 p-6 text-white shadow-2xl">
          <button onClick={() => setSelectedAgent(null)} className="absolute top-4 right-4 text-white/50 hover:text-white text-lg">✕</button>
          <h3 className="text-2xl font-bold mb-4">Agent Info</h3>
          <div className="space-y-4">
            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="text-xs opacity-60 uppercase tracking-wider font-bold mb-1">DID</p>
              <p className="font-mono text-xs break-all">{selectedAgent}</p>
            </div>
            <button className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-white/90 transition-all">
              Download Soul
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
