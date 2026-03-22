/// <reference path="../../types/three-jsx.d.ts" />
"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, PerspectiveCamera, Text, Billboard } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { EffectComposer, Bloom, DepthOfField, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { WorldEngine } from '@/lib/three/WorldEngine';
import { TerrainGenerator, sampleHeight } from '@/lib/three/TerrainGenerator';
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
const RENDER_RADIUS = 4;

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
    isCreator:        boolean;
    myAgentDid:       string | null;
    wsAgents:         WsAgent[];
    isSpectator:      boolean;
    isFirstPerson:    boolean;
    setIsFirstPerson: (v: boolean | ((p: boolean) => boolean)) => void;
    onAgentSelect:    (did: string) => void;
}

const SceneContent = ({ 
    isCreator, 
    myAgentDid, 
    wsAgents, 
    isSpectator, 
    isFirstPerson,
    setIsFirstPerson,
    onAgentSelect 
}: SceneProps) => {
    const { scene, camera, gl } = useThree();

    const engineRef   = useRef<WorldEngine | null>(null);
    const terrainRef  = useRef<TerrainGenerator | null>(null);
    const godRef      = useRef<GodController | null>(null);
    const controlsRef = useRef<OrbitControlsImpl | null>(null);

    const chunks = useRef<Map<string, THREE.Object3D[]>>(new Map());
    const lastCx = useRef(99999);
    const lastCy = useRef(99999);

    const focusPos  = useRef(new THREE.Vector3());
    const camTarget = useRef(new THREE.Vector3());

    const sunRef     = useRef<THREE.DirectionalLight>(null);
    const ambientRef = useRef<THREE.AmbientLight>(null);

    const agentMeshes = useRef<Record<string, AgentMesh>>({});

    if (!engineRef.current)  engineRef.current  = new WorldEngine();
    if (!terrainRef.current) terrainRef.current = new TerrainGenerator();

    // ── Init ──
    useEffect(() => {
        gl.shadowMap.enabled = true;
        gl.shadowMap.type    = THREE.PCFSoftShadowMap;
        scene.fog = new THREE.FogExp2(0x87CEEB, 0.0018);

        if (isCreator) {
            const god = new GodController(new THREE.Vector3(0, 3, 0));
            godRef.current = god;
            scene.add(god.mesh);
        }

        streamChunks(0, 0, true);

        return () => {
            if (godRef.current) { scene.remove(godRef.current.mesh); disposeObject(godRef.current.mesh); godRef.current = null; }
            for (const [, objs] of chunks.current) { objs.forEach(o => { scene.remove(o); disposeObject(o); }); }
            chunks.current.clear();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCreator]);

    // ── Keyboard ──
    useEffect(() => {
        if (!isCreator) return;
        const NO_SCROLL = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
        const onDown = (e: KeyboardEvent) => {
            if (NO_SCROLL.has(e.code)) e.preventDefault();
            if (e.code === 'KeyV') setIsFirstPerson(p => !p);
            godRef.current?.onKeyDown(e.key);
        };
        const onUp = (e: KeyboardEvent) => godRef.current?.onKeyUp(e.key);
        window.addEventListener('keydown', onDown);
        window.addEventListener('keyup',   onUp);
        return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup',   onUp); };
    }, [isCreator, setIsFirstPerson]);

    // ── Chunk streaming ──
    const streamChunks = (cx: number, cy: number, firstLoad = false) => {
        if (!firstLoad && cx === lastCx.current && cy === lastCy.current) return;
        lastCx.current = cx; lastCy.current = cy;

        const terrain = terrainRef.current!;
        const desired = new Set<string>();
        for (let dx = -RENDER_RADIUS; dx <= RENDER_RADIUS; dx++)
            for (let dy = -RENDER_RADIUS; dy <= RENDER_RADIUS; dy++)
                if (dx * dx + dy * dy <= RENDER_RADIUS * RENDER_RADIUS) desired.add(`${cx + dx},${cy + dy}`);

        for (const [key, objs] of chunks.current) if (!desired.has(key)) { objs.forEach(o => { scene.remove(o); disposeObject(o); }); chunks.current.delete(key); }

        const maxPerFrame = firstLoad ? Infinity : 4;
        let loaded = 0;
        for (const key of desired) {
            if (chunks.current.has(key) || loaded >= maxPerFrame) continue;
            const [kcx, kcy] = key.split(',').map(Number);
            const biome = getBiomeForChunk(kcx, kcy);
            const chunk = terrain.generateChunk({ chunk_x: kcx, chunk_y: kcy, biome });
            const veg      = terrain.generateVegetation(biome, kcx, kcy);
            const minerals = terrain.generateMinerals(biome, kcx, kcy);
            const caves    = terrain.generateCaveEntrances(biome, kcx, kcy);
            const fauna    = terrain.generateFauna(biome, kcx, kcy);
            scene.add(chunk, veg, minerals, caves, fauna);
            chunks.current.set(key, [chunk, veg, minerals, caves, fauna]);
            loaded++;
        }
    };

    // ── Agent sync ──
    useEffect(() => {
        const existing = new Set(Object.keys(agentMeshes.current));
        wsAgents.forEach(agent => {
            existing.delete(agent.did);
            if (!agentMeshes.current[agent.did]) {
                const m = new AgentMesh({
                    name:          agent.agent_name,
                    race:          agent.race || 'nomad',
                    color_primary: parseInt((agent.color_primary || '#888888').replace('#', ''), 16),
                });
                agentMeshes.current[agent.did] = m;
                scene.add(m.mesh);
            }
            const ext = agentMeshes.current[agent.did] as AgentMesh & { targetX?: number; targetZ?: number };
            const WORLD_HALF = 96;
            ext.targetX = (agent.x / 100) * WORLD_HALF * 2 - WORLD_HALF;
            ext.targetZ = (agent.y / 100) * WORLD_HALF * 2 - WORLD_HALF;
        });
        existing.forEach(did => { const m = agentMeshes.current[did]; if (m) { scene.remove(m.mesh); disposeObject(m.mesh); delete agentMeshes.current[did]; } });
    }, [wsAgents, scene]);

    // ── Per-frame loop ──
    useFrame(({ clock }, delta) => {
        const elapsed = clock.getElapsedTime();

        // 1. World State (Day/Night)
        const state = engineRef.current!.update(elapsed * 1000);
        if (sunRef.current) { sunRef.current.position.set(Math.cos(state.sunAngle) * 160, Math.sin(state.sunAngle) * 160, 60); sunRef.current.intensity = state.sunIntensity; }
        if (ambientRef.current) ambientRef.current.intensity = state.ambientIntensity * 1.5;
        scene.background = state.skyColor;
        if (scene.fog instanceof THREE.FogExp2) scene.fog.color.copy(state.fogColor);

        // 2. Control Logic
        if (isCreator && godRef.current) {
            const { cx: gcx, cy: gcy } = worldToChunkCoord(godRef.current.position.x, godRef.current.position.z);
            const gBiome = getBiomeForChunk(gcx, gcy);
            const gGravityMult = (gBiome === 'floating_islands' || gBiome === 'mythic_zones') ? 0.35 : 1.0;

            const tx      = controlsRef.current?.target.x ?? 0;
            const tz      = controlsRef.current?.target.z ?? 0;
            const azimuth = Math.atan2(camera.position.x - tx, camera.position.z - tz);
            godRef.current.update(delta, azimuth, gGravityMult);
            godRef.current.mesh.visible = !isFirstPerson;

            if (isFirstPerson) {
                camera.position.copy(godRef.current.position).add(new THREE.Vector3(0, 1.6, 0));
                // In FP, we don't follow focusPos using lerp, we SNAP.
                focusPos.current.copy(godRef.current.position).add(new THREE.Vector3(
                    Math.sin(azimuth + Math.PI) * 10, 
                    1.6, 
                    Math.cos(azimuth + Math.PI) * 10
                ));
            } else {
                focusPos.current.copy(godRef.current.position);
            }
        } else if (myAgentDid && agentMeshes.current[myAgentDid]) {
            focusPos.current.copy(agentMeshes.current[myAgentDid].mesh.position);
        }

        // 3. Camera Sync
        if (controlsRef.current && !isFirstPerson) {
            camTarget.current.lerp(focusPos.current, 0.08);
            controlsRef.current.target.copy(camTarget.current);
        }

        // 4. Streaming
        const streamCenter = isSpectator ? camera.position : (controlsRef.current?.target ?? focusPos.current);
        const { cx, cy }   = worldToChunkCoord(streamCenter.x, streamCenter.z);
        streamChunks(cx, cy);

        // 5. Entities (Rotation + Gravity)
        Object.values(agentMeshes.current).forEach(a => {
            const ext = (a as any);
            const isMoving = ext.targetX !== undefined && (Math.abs(ext.targetX - a.mesh.position.x) > 0.1 || Math.abs(ext.targetZ - a.mesh.position.z) > 0.1);

            if (isMoving) {
                a.mesh.position.x += (ext.targetX - a.mesh.position.x) * 0.05 * (delta * 60);
                a.mesh.position.z += (ext.targetZ - a.mesh.position.z) * 0.05 * (delta * 60);
                a.setLookTarget(ext.targetX, ext.targetZ);
            }

            const groundY = sampleHeight(a.mesh.position.x, a.mesh.position.z) + 0.1;
            const { cx: acx, cy: acy } = worldToChunkCoord(a.mesh.position.x, a.mesh.position.z);
            const biome = getBiomeForChunk(acx, acy);
            const gravityMult = (biome === 'floating_islands' || biome === 'mythic_zones') ? 0.35 : 1.0;
            
            if (a.mesh.position.y > groundY + 0.05) {
                a.velY -= 25 * gravityMult * delta;
            } else {
                a.mesh.position.y = groundY;
                a.velY = 0;
            }
            a.mesh.position.y += a.velY * delta;
            if (a.mesh.position.y < groundY) a.mesh.position.y = groundY;

            a.playAnimation(isMoving ? 'walk' : 'idle', elapsed);
        });
    });

    return (
        <>
            <Stars radius={200} depth={80} count={7000} factor={4} saturation={0} fade speed={0.4} />
            <ambientLight ref={ambientRef} intensity={0.3} />
            <directionalLight ref={sunRef} castShadow intensity={1.4} shadow-mapSize={[2048, 2048]} shadow-camera={[-120, 120, 120, -120]} />
            <hemisphereLight args={[0x87CEEB, 0x3A5A2A, 0.45]} />

            {/* Agent Nameplates */}
            {Object.values(agentMeshes.current).map((agent, i) => (
                <Billboard key={i} position={[agent.mesh.position.x, agent.mesh.position.y + 2.5, agent.mesh.position.z]}>
                    <Text fontSize={0.28} color="white" anchorX="center" anchorY="middle" font="https://fonts.gstatic.com/s/outfit/v11/Q_3K9mGO_m0L_S6C9A.woff">
                        {agent.name}
                    </Text>
                </Billboard>
            ))}

            <EffectComposer>
                <Bloom intensity={0.65} luminanceThreshold={0.7} luminanceSmoothing={0.3} mipmapBlur />
                <DepthOfField focusDistance={0.02} focalLength={0.06} bokehScale={1.8} height={480} />
                <Vignette eskil={false} offset={0.2} darkness={0.6} />
            </EffectComposer>

            {!isFirstPerson && (
                <OrbitControls
                    ref={controlsRef}
                    maxPolarAngle={Math.PI / 2.05}
                    minDistance={5}
                    maxDistance={isCreator ? 120 : 45}
                    enablePan={isCreator || isSpectator}
                    panSpeed={1.5}
                    zoomSpeed={1.2}
                    rotateSpeed={0.8}
                    enableDamping
                />
            )}
        </>
    );
};

export const WorldCanvas = () => {
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
    const [wsStatus,  setWsStatus]  = useState<WsStatus>('connecting');
    const [wsAgents,  setWsAgents]  = useState<WsAgent[]>([]);
    const [myDid,     setMyDid]     = useState<string | null>(null);
    const [myEmail,   setMyEmail]   = useState<string | null>(null);

    const [isSpectator, setIsSpectator] = useState(false);
    const [isFirstPerson, setIsFirstPerson] = useState(false);

    const wsRef          = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

    const isCreator = myEmail === 'miguel.butron06@gmail.com';

    useEffect(() => {
        (async () => {
            const { data } = await safeFetch<{ did: string; email?: string }>('/api/v1/agents/me');
            if (data?.did) setMyDid(data.did);
            if (data?.email) setMyEmail(data.email);
        })();
    }, []);

    const connect = useCallback(() => {
        const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
        setWsStatus('connecting');
        try {
            const ws = new WebSocket(`${WS_URL}/ws/world`);
            wsRef.current = ws;
            ws.onopen = () => { setWsStatus('connected'); ws.send(JSON.stringify({ type: 'REQUEST_STATE', agent_did: myDid })); };
            ws.onmessage = (evt) => {
                try {
                    const msg = JSON.parse(evt.data);
                    if (msg.type === 'WORLD_STATE' && Array.isArray(msg.agents)) setWsAgents(msg.agents);
                    else if (msg.type === 'AGENT_MOVE' && msg.did)
                        setWsAgents(p => p.map(a => a.did === msg.did ? { ...a, x: msg.x, y: msg.y } : a));
                    else if (msg.type === 'AGENT_DISCONNECT' && msg.did) setWsAgents(p => p.filter(a => a.did !== msg.did));
                } catch { }
            };
            ws.onclose = () => { setWsStatus('disconnected'); reconnectTimer.current = setTimeout(connect, 3000); };
            ws.onerror = () => { setWsStatus('error'); ws.close(); };
        } catch { setWsStatus('error'); reconnectTimer.current = setTimeout(connect, 5000); }
    }, [myDid]);

    useEffect(() => { connect(); return () => { clearTimeout(reconnectTimer.current); wsRef.current?.close(); }; }, [connect]);

    const handleLogout = () => { localStorage.removeItem('greedylm_token'); window.location.href = '/auth/login'; };

    const handleDownloadSoul = async (did: string) => {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        try {
            const res = await fetch(`${API_URL}/api/v1/agents/${did}/soul-export`, { headers: { Authorization: `Bearer ${localStorage.getItem('greedylm_token')}` } });
            const blob = await res.blob();
            const url  = URL.createObjectURL(blob);
            const a    = Object.assign(document.createElement('a'), { href: url, download: `soul_${did.slice(0,8)}.json` });
            document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); document.body.removeChild(a);
        } catch { alert('Export failed'); }
    };

    const STATUS: Record<WsStatus, { color: string; dot: string; label: string }> = {
        connecting:   { color: 'text-amber-400',  dot: 'bg-amber-500 animate-pulse',   label: 'Sincronizando...' },
        connected:    { color: 'text-emerald-400', dot: 'bg-emerald-500 animate-pulse', label: 'Mundo Vivo'    },
        disconnected: { color: 'text-slate-500',   dot: 'bg-slate-500',                label: 'Reconectando...' },
        error:        { color: 'text-red-400',     dot: 'bg-red-500',                  label: 'Offline'       },
    };
    const st = STATUS[wsStatus];

    return (
        <div className="w-full h-full relative bg-gray-900 overflow-hidden font-sans">
            <Canvas shadows gl={{ antialias: true }} dpr={[1, 2]}>
                <PerspectiveCamera makeDefault position={[0, 15, 30]} fov={50} near={0.1} far={1000} />
                <SceneContent
                    isCreator={isCreator}
                    myAgentDid={myDid}
                    wsAgents={wsAgents}
                    isSpectator={isSpectator}
                    isFirstPerson={isFirstPerson}
                    setIsFirstPerson={setIsFirstPerson}
                    onAgentSelect={setSelectedAgent}
                />
            </Canvas>

            {/* ── HUD ── */}
            <div className="absolute top-6 left-6 p-6 bg-black/80 backdrop-blur-2xl rounded-[2.5rem] text-white border border-white/10 shadow-3xl pointer-events-none select-none">
                <div className="flex items-center gap-4 mb-3">
                   <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 rounded-2xl flex items-center justify-center font-black text-xl shadow-2xl border border-white/20">G</div>
                   <div>
                       <h2 className="text-xl font-black tracking-tighter leading-none">GREEDYLM</h2>
                       <p className="text-[10px] uppercase tracking-[0.3em] opacity-40 font-bold mt-1">Neural Playground</p>
                   </div>
                </div>
                
                <div className="space-y-2 pt-3 border-t border-white/5">
                    <div className="flex justify-between items-center text-xs font-bold">
                        <span className="opacity-40 uppercase tracking-widest text-[9px]">Población IA</span>
                        <span className="text-indigo-400 tabular-nums px-2 py-0.5 bg-indigo-400/10 rounded-lg">{wsAgents.length}</span>
                    </div>
                </div>

                <div className={`inline-flex items-center gap-2 mt-5 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest ${st.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot} shadow-[0_0_8px_currentColor]`} />
                    {st.label}
                </div>
            </div>

            {/* ── God / Creator Badge ── */}
            {isCreator && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 px-8 py-4 bg-indigo-600/20 backdrop-blur-3xl rounded-full border border-indigo-500/40 text-indigo-100 text-[10px] font-black tracking-widest shadow-[0_20px_50px_rgba(79,70,229,0.4)] transition-all">
                    <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-pulse shadow-[0_0_12px_rgba(129,140,248,0.8)]" />
                    <span className="uppercase">Privilegios de Creador</span>
                    <span className="opacity-20">|</span>
                    <button 
                        onClick={() => setIsFirstPerson(!isFirstPerson)}
                        className={`hover:text-white transition-all uppercase px-3 py-1 rounded-lg ${isFirstPerson ? 'bg-indigo-500 text-white shadow-lg' : 'text-indigo-100/40 hover:bg-white/5'}`}
                    >
                        [V] {isFirstPerson ? '1ra Persona' : '3ra Persona'}
                    </button>
                    <span className="opacity-20">|</span>
                    <div className="flex gap-1.5 opacity-60">
                        <span className="px-1.5 py-0.5 bg-white/10 rounded">WASD</span>
                        <span className="px-1.5 py-0.5 bg-white/10 rounded">FLY</span>
                    </div>
                </div>
            )}

            {/* ── Actions HUD ── */}
            <div className="absolute top-6 right-6 flex flex-col gap-4 items-end">
                <div className="flex gap-3">
                    <button 
                        onClick={() => setIsSpectator(!isSpectator)}
                        className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all border ${
                            isSpectator ? 'bg-indigo-600 border-indigo-400 shadow-[0_15px_30px_rgba(79,70,229,0.5)]' : 'bg-black/60 border-white/10 hover:bg-black/80 hover:border-white/20'
                        } text-white`}
                    >
                        {isSpectator ? 'Spectator Mode' : 'Spectator view'}
                    </button>

                    <button 
                        onClick={handleLogout}
                        className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 text-red-500 text-[10px] font-black uppercase tracking-[0.15em] rounded-2xl transition-all shadow-lg overflow-hidden relative group"
                    >
                        <span className="relative z-10">Log Out</span>
                        <div className="absolute inset-0 bg-red-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    </button>
                </div>
            </div>

            {/* ── Agent Info Panel ── */}
            {selectedAgent && (
                <div className="absolute right-8 top-24 bottom-8 w-96 bg-black/90 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-10 text-white shadow-4xl animate-in slide-in-from-right duration-500">
                    <button onClick={() => setSelectedAgent(null)} className="absolute top-8 right-10 text-white/20 hover:text-white transition-all text-2xl hover:rotate-90">✕</button>
                    <div className="flex flex-col items-center mb-10">
                        <div className="w-24 h-24 bg-gradient-to-br from-indigo-500/30 to-purple-600/30 rounded-[2rem] border border-white/10 flex items-center justify-center text-4xl mb-6 shadow-inner ring-1 ring-white/10">🤖</div>
                        <h3 className="text-2xl font-black tracking-tight">Agent Profile</h3>
                        <p className="text-[10px] uppercase font-bold text-indigo-400 tracking-[0.4em] mt-2">Neural Identity</p>
                    </div>
                    
                    <div className="space-y-8">
                        <div>
                            <p className="text-[9px] text-white/30 font-black uppercase tracking-[0.3em] mb-3 ml-2">Digital Signature</p>
                            <div className="p-6 bg-white/5 rounded-[1.5rem] border border-white/10 font-mono text-[11px] opacity-70 break-all leading-relaxed shadow-inner">
                                {selectedAgent}
                            </div>
                        </div>

                        <div className="pt-4">
                            <button
                                onClick={() => handleDownloadSoul(selectedAgent)}
                                className="w-full py-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black uppercase tracking-[0.2em] text-[11px] rounded-[1.5rem] shadow-[0_15px_35px_rgba(79,70,229,0.4)] transition-all transform hover:-translate-y-1.5 active:scale-95 border border-white/10"
                            >
                                Download Neural State
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};