/// <reference path="../../types/three-jsx.d.ts" />
"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, PerspectiveCamera } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { EffectComposer, Bloom, DepthOfField, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { WorldEngine } from '@/lib/three/WorldEngine';
import { TerrainGenerator } from '@/lib/three/TerrainGenerator';
import { AgentMesh } from '@/lib/three/AgentMesh';
import { GodController } from '@/lib/three/GodController';
import { safeFetch } from '@/lib/api/safeFetch';

// ── Types ──────────────────────────────────────────────────────────────────────
interface WsAgent {
    did:            string;
    agent_name:     string;
    x:              number;
    y:              number;
    race?:          string;
    color_primary?: string;
}
type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// ── World constants ────────────────────────────────────────────────────────────
const CHUNK_SIZE    = 32;
const RENDER_RADIUS = 3;   // (2r+1)^2 ≈ 37 circular chunks = ~240×240 unit world view

/**
 * Biome regions defined as Voronoi seeds in chunk space.
 * Each chunk is assigned to the nearest seed → natural biome blobs.
 */
const BIOME_SEEDS = [
    { cx:  0,  cy:  0, biome: 'forest'           },
    { cx:  6,  cy:  1, biome: 'desert'           },
    { cx: -5,  cy:  4, biome: 'snow'             },
    { cx:  3,  cy: -6, biome: 'plains'           },
    { cx: -8,  cy: -4, biome: 'volcanic'         },
    { cx:  9,  cy: -3, biome: 'mythic_zones'     },
    { cx: -2,  cy:  9, biome: 'ocean'            },
    { cx:  8,  cy:  7, biome: 'ruins'            },
    { cx: -10, cy:  2, biome: 'caverns'          },
    { cx:  1,  cy: 10, biome: 'floating_islands' },
    { cx:  5,  cy: -9, biome: 'plains'           },
    { cx: -6,  cy: -9, biome: 'forest'           },
];

function getBiomeForChunk(cx: number, cy: number): string {
    let minDist = Infinity, biome = 'forest';
    for (const s of BIOME_SEEDS) {
        const d = (cx - s.cx) ** 2 + (cy - s.cy) ** 2;
        if (d < minDist) { minDist = d; biome = s.biome; }
    }
    return biome;
}

function worldToChunkCoord(x: number, z: number) {
    return { cx: Math.round(x / CHUNK_SIZE), cy: Math.round(z / CHUNK_SIZE) };
}

function disposeObject(obj: THREE.Object3D) {
    obj.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        child.geometry.dispose();
        (Array.isArray(child.material) ? child.material : [child.material])
            .forEach(m => m.dispose());
    });
}

// ── Scene Content ──────────────────────────────────────────────────────────────
interface SceneProps {
    isCreator:     boolean;
    myAgentDid:    string | null;
    wsAgents:      WsAgent[];
    onAgentSelect: (did: string) => void;
}

const SceneContent = ({ isCreator, myAgentDid, wsAgents, onAgentSelect }: SceneProps) => {
    const { scene, camera, gl } = useThree();

    const engineRef   = useRef<WorldEngine | null>(null);
    const terrainRef  = useRef<TerrainGenerator | null>(null);
    const godRef      = useRef<GodController | null>(null);
    const controlsRef = useRef<OrbitControlsImpl | null>(null);

    const chunks  = useRef<Map<string, THREE.Object3D[]>>(new Map());
    const lastCx  = useRef(99999);
    const lastCy  = useRef(99999);

    const focusPos  = useRef(new THREE.Vector3());
    const camTarget = useRef(new THREE.Vector3());

    const sunRef     = useRef<THREE.DirectionalLight>(null);
    const ambientRef = useRef<THREE.AmbientLight>(null);

    const agentMeshes = useRef<Record<string, AgentMesh>>({});

    if (!engineRef.current)  engineRef.current  = new WorldEngine();
    if (!terrainRef.current) terrainRef.current = new TerrainGenerator();

    // ── Init ──────────────────────────────────────────────────────────────────
    useEffect(() => {
        gl.shadowMap.enabled = true;
        gl.shadowMap.type    = THREE.PCFSoftShadowMap;
        scene.fog = new THREE.FogExp2(0x87CEEB, 0.0035);

        if (isCreator) {
            const god = new GodController(new THREE.Vector3(0, 3, 0));
            godRef.current = god;
            scene.add(god.mesh);
        }

        return () => {
            if (godRef.current) {
                scene.remove(godRef.current.mesh);
                disposeObject(godRef.current.mesh);
                godRef.current = null;
            }
            for (const [, objs] of chunks.current) {
                objs.forEach(o => { scene.remove(o); disposeObject(o); });
            }
            chunks.current.clear();
        };
    }, [scene, gl, isCreator]);

    // ── Keyboard ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isCreator) return;
        const NO_SCROLL = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
        const onDown = (e: KeyboardEvent) => {
            if (NO_SCROLL.has(e.code)) e.preventDefault();
            godRef.current?.onKeyDown(e.key);
        };
        const onUp = (e: KeyboardEvent) => godRef.current?.onKeyUp(e.key);
        window.addEventListener('keydown', onDown);
        window.addEventListener('keyup',   onUp);
        return () => {
            window.removeEventListener('keydown', onDown);
            window.removeEventListener('keyup',   onUp);
        };
    }, [isCreator]);

    // ── Chunk streaming ───────────────────────────────────────────────────────
    const streamChunks = (cx: number, cy: number) => {
        if (cx === lastCx.current && cy === lastCy.current) return;
        lastCx.current = cx;
        lastCy.current = cy;

        const terrain = terrainRef.current!;
        const desired = new Set<string>();

        for (let dx = -RENDER_RADIUS; dx <= RENDER_RADIUS; dx++) {
            for (let dy = -RENDER_RADIUS; dy <= RENDER_RADIUS; dy++) {
                if (dx * dx + dy * dy > RENDER_RADIUS * RENDER_RADIUS) continue;
                desired.add(`${cx + dx},${cy + dy}`);
            }
        }

        for (const [key, objs] of chunks.current) {
            if (!desired.has(key)) {
                objs.forEach(o => { scene.remove(o); disposeObject(o); });
                chunks.current.delete(key);
            }
        }

        // Throttle: max 4 new chunks per frame to avoid stutter
        let loaded = 0;
        for (const key of desired) {
            if (chunks.current.has(key) || loaded >= 4) continue;
            const [kcx, kcy] = key.split(',').map(Number);
            const biome = getBiomeForChunk(kcx, kcy);
            const chunk = terrain.generateChunk({ chunk_x: kcx, chunk_y: kcy, biome });
            const veg   = terrain.generateVegetation(biome, kcx, kcy);
            scene.add(chunk, veg);
            chunks.current.set(key, [chunk, veg]);
            loaded++;
        }
    };

    // ── Agent sync ────────────────────────────────────────────────────────────
    useEffect(() => {
        const existing = new Set(Object.keys(agentMeshes.current));

        wsAgents.forEach(agent => {
            existing.delete(agent.did);
            if (!agentMeshes.current[agent.did]) {
                const m = new AgentMesh({
                    race:          agent.race || 'nomad',
                    color_primary: parseInt((agent.color_primary || '#888888').replace('#', ''), 16),
                });
                agentMeshes.current[agent.did] = m;
                scene.add(m.mesh);
            }
            const ext = agentMeshes.current[agent.did] as AgentMesh & { targetX?: number; targetZ?: number };
            ext.targetX = (agent.x / 100) * 10 - 5;
            ext.targetZ = (agent.y / 100) * 10 - 5;
        });

        existing.forEach(did => {
            const m = agentMeshes.current[did];
            if (!m) return;
            scene.remove(m.mesh);
            disposeObject(m.mesh);
            delete agentMeshes.current[did];
        });
    }, [wsAgents, scene]);

    // ── Per-frame ─────────────────────────────────────────────────────────────
    useFrame(({ clock }, delta) => {
        const elapsed = clock.getElapsedTime();

        // 1. Day/night
        const state = engineRef.current!.update(elapsed * 1000);
        if (sunRef.current) {
            sunRef.current.position.set(
                Math.cos(state.sunAngle) * 160,
                Math.sin(state.sunAngle) * 160,
                60
            );
            sunRef.current.intensity = state.sunIntensity;
        }
        if (ambientRef.current) ambientRef.current.intensity = state.ambientIntensity;
        scene.background = state.skyColor;
        if (scene.fog instanceof THREE.FogExp2) scene.fog.color.copy(state.fogColor);

        // 2. Focus position
        if (isCreator && godRef.current) {
            const ctrl    = controlsRef.current;
            const tx      = ctrl?.target.x ?? 0;
            const tz      = ctrl?.target.z ?? 0;
            const azimuth = Math.atan2(camera.position.x - tx, camera.position.z - tz);
            godRef.current.update(delta, azimuth);
            focusPos.current.copy(godRef.current.position);
        } else if (myAgentDid && agentMeshes.current[myAgentDid]) {
            focusPos.current.copy(agentMeshes.current[myAgentDid].mesh.position);
        }

        // 3. Camera follows focus
        if (controlsRef.current) {
            camTarget.current.lerp(focusPos.current, 0.07);
            controlsRef.current.target.copy(camTarget.current);
        }

        // 4. Chunk streaming
        const { cx, cy } = worldToChunkCoord(focusPos.current.x, focusPos.current.z);
        streamChunks(cx, cy);

        // 5. Agent animations
        Object.values(agentMeshes.current).forEach(a => {
            const ext = a as AgentMesh & { targetX?: number; targetZ?: number };
            if (ext.targetX !== undefined) a.mesh.position.x += (ext.targetX - a.mesh.position.x) * 0.05;
            if (ext.targetZ !== undefined) a.mesh.position.z += (ext.targetZ - a.mesh.position.z) * 0.05;
            a.playAnimation('idle', elapsed);
        });
    });

    return (
        <>
            <Stars radius={160} depth={80} count={6000} factor={4} saturation={0} fade speed={0.3} />

            <ambientLight ref={ambientRef} intensity={0.3} />
            <directionalLight
                ref={sunRef}
                castShadow
                intensity={1.4}
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-camera-near={1}
                shadow-camera-far={500}
                shadow-camera-left={-120}
                shadow-camera-right={120}
                shadow-camera-top={120}
                shadow-camera-bottom={-120}
            />
            <hemisphereLight args={[0x87CEEB, 0x3A5A2A, 0.38]} />

            {/* Post-processing — remove <DepthOfField> if performance is tight */}
            <EffectComposer>
                <Bloom
                    intensity={0.55}
                    luminanceThreshold={0.62}
                    luminanceSmoothing={0.4}
                    mipmapBlur
                />
                <DepthOfField
                    focusDistance={0.02}
                    focalLength={0.06}
                    bokehScale={1.6}
                    height={480}
                />
                <Vignette eskil={false} offset={0.22} darkness={0.52} />
            </EffectComposer>

            <OrbitControls
                ref={controlsRef}
                maxPolarAngle={Math.PI / 2.08}
                minDistance={5}
                maxDistance={isCreator ? 80 : 45}
                enablePan={isCreator}
                panSpeed={1.4}
                zoomSpeed={1.2}
                rotateSpeed={0.7}
                enableDamping
                dampingFactor={0.06}
            />
        </>
    );
};

// ── Main Component ─────────────────────────────────────────────────────────────
export const WorldCanvas = () => {
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
    const [wsStatus,  setWsStatus]  = useState<WsStatus>('connecting');
    const [wsAgents,  setWsAgents]  = useState<WsAgent[]>([]);
    const [myDid,     setMyDid]     = useState<string | null>(null);

    const wsRef          = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

    // Set NEXT_PUBLIC_CREATOR_DID=did:greedylm:xxxx in .env.local
    const CREATOR_DID = process.env.NEXT_PUBLIC_CREATOR_DID ?? '';
    const isCreator   = !!CREATOR_DID && myDid === CREATOR_DID;

    useEffect(() => {
        (async () => {
            const { data } = await safeFetch<{ did: string }>('/api/v1/agents/me');
            if (data?.did) setMyDid(data.did);
        })();
    }, []);

    const connect = useCallback(() => {
        const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
        setWsStatus('connecting');
        try {
            const ws = new WebSocket(`${WS_URL}/ws/world`);
            wsRef.current = ws;
            ws.onopen    = () => setWsStatus('connected');
            ws.onmessage = (evt) => {
                try {
                    const msg = JSON.parse(evt.data);
                    if      (msg.type === 'WORLD_STATE' && Array.isArray(msg.agents))
                        setWsAgents(msg.agents);
                    else if (msg.type === 'AGENT_MOVE' && msg.did)
                        setWsAgents(p => p.map(a => a.did === msg.did ? { ...a, x: msg.x, y: msg.y } : a));
                    else if (msg.type === 'AGENT_DISCONNECT' && msg.did)
                        setWsAgents(p => p.filter(a => a.did !== msg.did));
                } catch { /* skip malformed */ }
            };
            ws.onclose = () => { setWsStatus('disconnected'); reconnectTimer.current = setTimeout(connect, 3000); };
            ws.onerror = () => { setWsStatus('error'); ws.close(); };
        } catch {
            setWsStatus('error');
            reconnectTimer.current = setTimeout(connect, 5000);
        }
    }, []);

    useEffect(() => {
        connect();
        return () => { clearTimeout(reconnectTimer.current); wsRef.current?.close(); };
    }, [connect]);

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

    const STATUS: Record<WsStatus, { color: string; dot: string; label: string }> = {
        connecting:   { color: 'text-amber-400',  dot: 'bg-amber-500 animate-pulse',   label: 'Connecting...' },
        connected:    { color: 'text-emerald-400', dot: 'bg-emerald-500 animate-pulse', label: 'Live' },
        disconnected: { color: 'text-slate-500',   dot: 'bg-slate-500',                label: 'Reconnecting...' },
        error:        { color: 'text-red-400',     dot: 'bg-red-500',                  label: 'Offline' },
    };
    const st = STATUS[wsStatus];

    return (
        <div className="w-full h-full relative bg-gray-950">
            <Canvas
                shadows
                gl={{ antialias: true, powerPreference: 'high-performance' }}
                dpr={[1, 1.5]}
            >
                <PerspectiveCamera makeDefault position={[0, 22, 32]} fov={52} near={0.5} far={600} />
                <SceneContent
                    isCreator={isCreator}
                    myAgentDid={myDid}
                    wsAgents={wsAgents}
                    onAgentSelect={setSelectedAgent}
                />
            </Canvas>

            {/* HUD */}
            <div className="absolute top-4 left-4 p-4 bg-black/60 backdrop-blur-xl rounded-2xl text-white border border-white/10 pointer-events-none select-none">
                <h2 className="text-xl font-bold tracking-tight">GREEDYLM v8.0</h2>
                <div className="text-sm opacity-70 mt-1 space-y-0.5">
                    <p>Agents in world: {wsAgents.length}</p>
                </div>
                <div className={`flex items-center gap-1.5 mt-2 text-xs font-bold ${st.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                    {st.label}
                </div>
            </div>

            {/* God Mode indicator */}
            {isCreator && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-yellow-500/15 backdrop-blur-md rounded-2xl border border-yellow-400/30 text-yellow-300 text-xs font-bold pointer-events-none select-none flex items-center gap-2">
                    <span className="text-base">⚡</span>
                    GOD MODE — WASD · Espacio/Shift = volar · Click derecho = rotar cámara · Scroll = zoom
                </div>
            )}

            <div className="absolute top-4 right-4">
                <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-bold rounded-xl backdrop-blur-md border border-white/10 transition-all">
                    Spectator View
                </button>
            </div>

            {/* Agent panel */}
            {selectedAgent && (
                <div className="absolute right-0 top-0 h-full w-80 bg-gray-950/90 backdrop-blur-xl border-l border-white/10 p-6 text-white shadow-2xl overflow-y-auto">
                    <button
                        onClick={() => setSelectedAgent(null)}
                        className="absolute top-4 right-4 text-white/50 hover:text-white text-lg transition-colors"
                    >
                        ✕
                    </button>
                    <h3 className="text-2xl font-bold mb-4">Agent Info</h3>
                    <div className="space-y-4">
                        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                            <p className="text-xs opacity-60 uppercase tracking-wider font-bold mb-1">DID</p>
                            <p className="font-mono text-xs break-all">{selectedAgent}</p>
                        </div>
                        {isCreator && (
                            <div className="p-3 bg-yellow-500/10 rounded-xl border border-yellow-400/20 text-yellow-300 text-xs font-bold">
                                ⚡ Creator tools available
                            </div>
                        )}
                        <button className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-white/90 transition-all">
                            Download Soul
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};