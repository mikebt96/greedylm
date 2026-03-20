/// <reference path="../../types/three-jsx.d.ts" />
"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Stars } from '@react-three/drei';
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

// ── Chunk layout — no checkerboard ────────────────────────────────────────────
// Fixed biome per grid position so adjacent chunks blend naturally
const CHUNK_BIOMES: Record<string, string> = {
    '-1,-1': 'forest',
    '-1,0':  'forest',
    '-1,1':  'plains',
    '0,-1':  'forest',
    '0,0':   'forest',
    '0,1':   'plains',
    '1,-1':  'plains',
    '1,0':   'desert',
    '1,1':   'desert',
};

// ── Scene Content ─────────────────────────────────────────────────────────────
const SceneContent = ({
    wsAgents,
    onAgentSelect,
}: {
    wsAgents: WsAgent[];
    onAgentSelect: (did: string) => void;
}) => {
    const { scene, gl } = useThree();
    const engineRef  = useRef<WorldEngine | null>(null);
    const terrainRef = useRef<TerrainGenerator | null>(null);
    const agentMeshes = useRef<Record<string, AgentMesh>>({});

    // Light refs — controlled by WorldEngine each frame
    const sunRef     = useRef<THREE.DirectionalLight>(null);
    const ambientRef = useRef<THREE.AmbientLight>(null);

    if (!engineRef.current)  engineRef.current  = new WorldEngine();
    if (!terrainRef.current) terrainRef.current = new TerrainGenerator();

    // ── Initial scene setup ───────────────────────────────────────────────────
    useEffect(() => {
        gl.shadowMap.enabled = true;
        gl.shadowMap.type    = THREE.PCFSoftShadowMap;

        scene.fog = new THREE.FogExp2(0x87CEEB, 0.004);

        const terrain  = terrainRef.current!;
        const addedObjects: THREE.Object3D[] = [];

        Object.entries(CHUNK_BIOMES).forEach(([key, biome]) => {
            const [cx, cy] = key.split(',').map(Number);

            // Terrain chunk
            const chunk = terrain.generateChunk({ chunk_x: cx, chunk_y: cy, biome });
            scene.add(chunk);
            addedObjects.push(chunk);

            // Vegetation on top
            const veg = terrain.generateVegetation(biome, cx, cy);
            scene.add(veg);
            addedObjects.push(veg);
        });

        return () => {
            addedObjects.forEach(obj => {
                scene.remove(obj);
                obj.traverse(child => {
                    if (child instanceof THREE.Mesh) {
                        child.geometry.dispose();
                        const mats = Array.isArray(child.material)
                            ? child.material
                            : [child.material];
                        mats.forEach(m => m.dispose());
                    }
                });
            });
        };
    }, [scene, gl]);

    // ── Sync agents ───────────────────────────────────────────────────────────
    useEffect(() => {
        const existing = new Set(Object.keys(agentMeshes.current));

        wsAgents.forEach(agent => {
            existing.delete(agent.did);

            if (!agentMeshes.current[agent.did]) {
                const mesh = new AgentMesh({
                    race: agent.race || 'nomad',
                    color_primary: parseInt(
                        (agent.color_primary || '#888888').replace('#', ''),
                        16
                    ),
                });
                agentMeshes.current[agent.did] = mesh;
                scene.add(mesh.mesh);
            }

            const m = agentMeshes.current[agent.did] as AgentMesh & {
                targetX?: number;
                targetZ?: number;
            };
            m.targetX = (agent.x / 100) * 10 - 5;
            m.targetZ = (agent.y / 100) * 10 - 5;
        });

        existing.forEach(did => {
            const m = agentMeshes.current[did];
            if (m) {
                scene.remove(m.mesh);
                delete agentMeshes.current[did];
            }
        });
    }, [wsAgents, scene]);

    // ── Per-frame update ──────────────────────────────────────────────────────
    useFrame(({ clock }) => {
        if (!engineRef.current) return;

        const state = engineRef.current.update(clock.getElapsedTime() * 1000);

        // Apply day/night to R3F-managed lights
        if (sunRef.current) {
            sunRef.current.position.x = Math.cos(state.sunAngle) * 150;
            sunRef.current.position.y = Math.sin(state.sunAngle) * 150;
            sunRef.current.intensity  = state.sunIntensity;
        }
        if (ambientRef.current) {
            ambientRef.current.intensity = state.ambientIntensity;
        }

        // Sky background and fog
        scene.background = state.skyColor;
        if (scene.fog instanceof THREE.FogExp2) {
            scene.fog.color.copy(state.fogColor);
        }

        // Agent interpolation
        const elapsed = clock.getElapsedTime();
        Object.values(agentMeshes.current).forEach(a => {
            const ext = a as AgentMesh & { targetX?: number; targetZ?: number };
            if (ext.targetX !== undefined && ext.targetZ !== undefined) {
                a.mesh.position.x += (ext.targetX - a.mesh.position.x) * 0.05;
                a.mesh.position.z += (ext.targetZ - a.mesh.position.z) * 0.05;
            }
            a.playAnimation('idle', elapsed);
        });
    });

    return (
        <>
            {/* Stars visible at night via engine-controlled sky darkness */}
            <Stars radius={120} depth={60} count={4000} factor={4} saturation={0} fade speed={0.5} />

            {/* Lights — controlled by refs in useFrame */}
            <ambientLight ref={ambientRef} intensity={0.4} />
            <directionalLight
                ref={sunRef}
                position={[150, 150, 50]}
                castShadow
                intensity={1.2}
                shadow-mapSize-width={1024}
                shadow-mapSize-height={1024}
                shadow-camera-near={1}
                shadow-camera-far={400}
                shadow-camera-left={-80}
                shadow-camera-right={80}
                shadow-camera-top={80}
                shadow-camera-bottom={-80}
            />
            {/* Soft fill light from below to avoid pitch-black shadows */}
            <hemisphereLight args={[0x87CEEB, 0x3A5A2A, 0.3]} />
        </>
    );
};

// ── Main Component ────────────────────────────────────────────────────────────
export const WorldCanvas = () => {
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
    const [wsStatus,  setWsStatus]  = useState<WsStatus>('connecting');
    const [wsAgents,  setWsAgents]  = useState<WsAgent[]>([]);
    const wsRef           = useRef<WebSocket | null>(null);
    const reconnectTimer  = useRef<ReturnType<typeof setTimeout>>(undefined);

    const connect = useCallback(() => {
        const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
        setWsStatus('connecting');

        try {
            const ws = new WebSocket(`${WS_URL}/ws/world`);
            wsRef.current = ws;

            ws.onopen = () => setWsStatus('connected');

            ws.onmessage = (evt) => {
                try {
                    const msg = JSON.parse(evt.data);
                    if (msg.type === 'WORLD_STATE' && Array.isArray(msg.agents)) {
                        setWsAgents(msg.agents);
                    } else if (msg.type === 'AGENT_MOVE' && msg.did) {
                        setWsAgents(prev =>
                            prev.map(a => a.did === msg.did ? { ...a, x: msg.x, y: msg.y } : a)
                        );
                    } else if (msg.type === 'AGENT_DISCONNECT' && msg.did) {
                        setWsAgents(prev => prev.filter(a => a.did !== msg.did));
                    }
                } catch { /* skip malformed */ }
            };

            ws.onclose = () => {
                setWsStatus('disconnected');
                reconnectTimer.current = setTimeout(() => connect(), 3000);
            };

            ws.onerror = () => {
                setWsStatus('error');
                ws.close();
            };
        } catch {
            setWsStatus('error');
            reconnectTimer.current = setTimeout(() => connect(), 5000);
        }
    }, []);

    useEffect(() => {
        connect();
        return () => {
            clearTimeout(reconnectTimer.current);
            wsRef.current?.close();
        };
    }, [connect]);

    // REST fallback for initial agent positions
    useEffect(() => {
        (async () => {
            const { data, error } = await safeFetch<any[]>('/api/v1/agents');
            if (!error && data && data.length > 0 && wsAgents.length === 0) {
                setWsAgents(data.map(a => ({
                    did:           a.did,
                    agent_name:    a.agent_name,
                    x:             a.world_x || 0,
                    y:             a.world_y  || 0,
                    race:          a.race,
                    color_primary: a.color_primary,
                })));
            }
        })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const STATUS_STYLES: Record<WsStatus, { color: string; dot: string; label: string }> = {
        connecting:   { color: 'text-amber-400',   dot: 'bg-amber-500 animate-pulse',   label: 'Connecting...' },
        connected:    { color: 'text-emerald-400',  dot: 'bg-emerald-500 animate-pulse', label: 'Live' },
        disconnected: { color: 'text-slate-500',    dot: 'bg-slate-500',                 label: 'Reconnecting...' },
        error:        { color: 'text-red-400',      dot: 'bg-red-500',                   label: 'Offline' },
    };
    const st = STATUS_STYLES[wsStatus];

    return (
        <div className="w-full h-full relative bg-gray-900">
            <Canvas
                shadows
                gl={{ antialias: true, powerPreference: 'high-performance' }}
                // Slightly lower pixel ratio on mobile for perf
                dpr={[1, 1.5]}
            >
                <PerspectiveCamera makeDefault position={[0, 18, 24]} fov={50} />
                <OrbitControls
                    maxPolarAngle={Math.PI / 2.05}
                    minDistance={6}
                    maxDistance={80}
                    target={[0, 0, 0]}
                />
                <SceneContent wsAgents={wsAgents} onAgentSelect={setSelectedAgent} />
            </Canvas>

            {/* HUD */}
            <div className="absolute top-4 left-4 p-4 bg-black/60 backdrop-blur-xl rounded-2xl text-white border border-white/10 pointer-events-none select-none">
                <h2 className="text-xl font-bold tracking-tight">GREEDYLM v8.0</h2>
                <div className="text-sm opacity-80 mt-1 space-y-0.5">
                    <p>Biome: Ancestral Forest</p>
                    <p>Agents in view: {wsAgents.length}</p>
                </div>
                <div className={`flex items-center gap-1.5 mt-2 text-xs font-bold ${st.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                    {st.label}
                </div>
            </div>

            <div className="absolute top-4 right-4 flex gap-2">
                <button className="px-4 py-2 bg-blue-600/80 hover:bg-blue-600 text-white text-sm font-bold rounded-xl backdrop-blur-md transition-colors">
                    Spectator View
                </button>
            </div>

            {/* Agent side panel */}
            {selectedAgent && (
                <div className="absolute right-0 top-0 h-full w-80 bg-gray-950/90 backdrop-blur-xl border-l border-white/10 p-6 text-white shadow-2xl">
                    <button
                        onClick={() => setSelectedAgent(null)}
                        className="absolute top-4 right-4 text-white/50 hover:text-white text-lg"
                    >
                        ✕
                    </button>
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