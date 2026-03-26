import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
    OrbitControls, 
    Stats, 
    Stars, 
    Html, 
    PerspectiveCamera,
    Float,
    Text,
    ContactShadows
} from '@react-three/drei';
import { 
    Swords, 
    Shield, 
    Zap, 
    ShoppingBag, 
    Settings, 
    MessageSquare, 
    Users,
    Activity,
    Compass,
    Ghost,
    Wind,
    ArrowRight,
    Search,
    Brain,
    Coins,
    DraftingCompass,
    Hammer,
    Scale,
    Scroll
} from 'lucide-react';
import { safeFetch } from '@/lib/api/safeFetch';
import { getApiUrl } from '@/lib/api/apiUrl';
import { useT } from '@/lib/i18n';

// ── Components ──
import { AgentMesh } from './AgentMesh';
import { WorldObjectMesh } from './WorldObjectMesh';
import { ConstructionMesh } from './ConstructionMesh';
import { BiomeEffects } from './BiomeEffects';
import HUD from './HUD';

// ── Types ──
interface WsAgent {
    did: string;
    agent_name: string;
    x: number;
    y: number;
    race: string;
    color_primary: string;
    health: number;
    max_health: number;
    stamina: number;
    max_stamina: number;
    level: number;
    experience: number;
    age: number;
    currency: number;
}

interface WorldObject {
    id: string;
    type: string;
    x: number;
    y: number;
    name?: string;
    description?: string;
}

interface Construction {
    id: string;
    type: string;
    position: { x: number; y: number; z: number };
    owner: string;
    name?: string;
}

/* ────────────────────────────────────────────────────────────────────────── */

function Scene({ 
    agents, 
    objects, 
    constructions,
    onObjectInteract, 
    onAgentInteract,
    myDid
}: { 
    agents: WsAgent[], 
    objects: WorldObject[], 
    constructions: Construction[],
    onObjectInteract: (id: string, type: string) => void,
    onAgentInteract: (did: string) => void,
    myDid: string | null
}) {
    const { scene } = useThree();

    return (
        <>
            <ambientLight intensity={0.4} />
            <directionalLight 
                position={[100, 100, 50]} 
                intensity={1.2} 
                castShadow 
                shadow-mapSize={[2048, 2048]}
            />
            <Stars radius={300} depth={60} count={20000} factor={7} saturation={0} fade speed={1} />
            
            {/* Terreno base */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[2000, 2000]} />
                <meshStandardMaterial color="#020617" roughness={1} metalness={0} />
            </mesh>

            {/* Efectos de Bioma (Nieve, Arena, etc) */}
            <BiomeEffects currentBiome="nexus" />

            {/* Agentes */}
            {agents.map(agent => (
                <AgentMesh 
                    key={agent.did} 
                    agent={agent} 
                    isMe={agent.did === myDid}
                    onClick={() => onAgentInteract(agent.did)}
                />
            ))}

            {/* Objetos del mundo */}
            {objects.map(obj => (
                <WorldObjectMesh 
                    key={obj.id} 
                    obj={obj} 
                    onClick={() => onObjectInteract(obj.id, obj.type)} 
                />
            ))}

            {/* Construcciones */}
            {constructions.map(c => (
                <ConstructionMesh
                    key={c.id}
                    construction={c}
                />
            ))}

            <ContactShadows opacity={0.4} scale={2000} blur={2.4} far={10} color="#000000" />
        </>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */

export default function WorldCanvas() {
    const { t } = useT();
    const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
    const [wsAgents, setWsAgents] = useState<WsAgent[]>([]);
    const [wsObjects, setWsObjects] = useState<WorldObject[]>([]);
    const [wsConstructions, setWsConstructions] = useState<Construction[]>([]);
    const [wsEvent, setWsEvent] = useState<any>(null);
    const [myDid, setMyDid] = useState<string | null>(null);
    const [myEmail, setMyEmail] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<WsAgent | null>(null);
    const [actionPending, setActionPending] = useState<{ finish_at: string, duration: number } | null>(null);
    
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<any>(null);
    const keysRef = useRef<Set<string>>(new Set());
    const myPosRef = useRef<{ x: number; y: number }>({ x: 200, y: 200 });

    const addLog = (msg: string) => {
        setLogs(prev => [msg, ...prev].slice(0, 10));
    };

    const isCreator = myEmail === 'miguel.butron06@gmail.com';

    useEffect(() => {
        (async () => {
            const { data } = await safeFetch<{ did: string; email?: string }>('/api/v1/agents/me');
            if (data?.did) setMyDid(data.did);
            if (data?.email) setMyEmail(data.email);
        })();
    }, []);

    const connect = useCallback(() => {
        let WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
        if (!WS_URL.startsWith('ws')) WS_URL = `ws://${WS_URL}`; // Basic correction

        setWsStatus('connecting');
        try {
            const endpoint = `${WS_URL.replace(/\/$/, '')}/ws/world`;
            const ws = new WebSocket(endpoint);
            wsRef.current = ws;
            ws.onopen = () => { 
                setWsStatus('connected'); 
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'REQUEST_STATE', agent_did: myDid })); 
                }
            };
            ws.onmessage = (evt) => {
                try {
                    const msg = JSON.parse(evt.data);
                    if (msg.type === 'WORLD_STATE' && Array.isArray(msg.agents)) {
                        setWsAgents(msg.agents);
                        // Sync position ref for WASD movement
                        const me = msg.agents.find((a: WsAgent) => a.did === myDid);
                        if (me) myPosRef.current = { x: me.x, y: me.y };
                    }
                    else if (msg.type === 'AGENT_MOVE' && msg.did)
                        setWsAgents(p => p.map(a => a.did === msg.did ? { ...a, x: msg.x, y: msg.y, health: msg.health, stamina: msg.stamina, level: msg.level, experience: msg.experience, age: msg.age, currency: msg.currency } : a));
                    else if (msg.type === 'AGENT_UPDATE' && msg.agent)
                        setWsAgents(p => p.map(a => a.did === msg.agent.did ? { ...a, x: msg.agent.x, y: msg.agent.y } : a));
                    else if (msg.type === 'AGENT_DISCONNECT' && msg.did) setWsAgents(p => p.filter(a => a.did !== msg.did));
                    else if (msg.type === 'OBJECT_SPAWNED' || msg.type === 'OBJECT_REMOVED' || msg.type === 'OBJECT_FLED') {
                        setWsEvent(msg);
                    }
                    else if (msg.type === 'ACTION_PENDING') {
                        setActionPending({ finish_at: msg.finish_at, duration: msg.duration });
                    }
                    else if (msg.type === 'ACTION_SUCCESS') {
                        setActionPending(null);
                    }
                    else if (msg.type === 'ACTION_ERROR') {
                        setActionPending(null);
                        alert(`Action failed: ${msg.error}`);
                    }
                } catch { }
            };
            ws.onclose = () => { setWsStatus('disconnected'); reconnectTimer.current = setTimeout(connect, 3000); };
            ws.onerror = () => { setWsStatus('error'); ws.close(); };
        } catch { setWsStatus('error'); reconnectTimer.current = setTimeout(connect, 5000); }
    }, [myDid]);

    useEffect(() => { connect(); return () => { clearTimeout(reconnectTimer.current); wsRef.current?.close(); }; }, [connect]);

    // ── WASD Movement ──
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (['w','a','s','d','W','A','S','D','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
                keysRef.current.add(e.key.toLowerCase());
            }
        };
        const onKeyUp = (e: KeyboardEvent) => {
            keysRef.current.delete(e.key.toLowerCase());
        };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
    }, []);

    useEffect(() => {
        if (!myDid || wsStatus !== 'connected') return;
        const SPEED = 5;
        const interval = setInterval(() => {
            const keys = keysRef.current;
            if (keys.size === 0) return;
            let dx = 0, dy = 0;
            if (keys.has('w') || keys.has('arrowup')) dy -= SPEED;
            if (keys.has('s') || keys.has('arrowdown')) dy += SPEED;
            if (keys.has('a') || keys.has('arrowleft')) dx -= SPEED;
            if (keys.has('d') || keys.has('arrowright')) dx += SPEED;
            if (dx === 0 && dy === 0) return;

            const pos = myPosRef.current;
            const newX = Math.max(0, Math.min(16000, pos.x + dx));
            const newY = Math.max(0, Math.min(13000, pos.y + dy));
            myPosRef.current = { x: newX, y: newY };

            // Optimistic local update
            setWsAgents(prev => prev.map(a =>
                a.did === myDid ? { ...a, x: newX, y: newY } : a
            ));

            // Send to server
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'AGENT_MOVE',
                    x: newX,
                    y: newY
                }));
            }
        }, 80);
        return () => clearInterval(interval);
    }, [myDid, wsStatus]);

    const handleSaveSoul = async () => {
        if (!myDid) return;
        try {
            const res = await safeFetch<any>(`/api/v1/agents/${encodeURIComponent(myDid)}/save-soul`, { method: 'POST' });
            if (res.data) addLog("💠 Tu alma ha sido sincronizada. Inventario seguro.");
        } catch (e) { 
            addLog("❌ Error al guardar el alma"); 
        }
    };

    const handleReproInvite = async (targetDid: string) => {
        if (!myDid) return;
        try {
            const res = await safeFetch<any>(`/api/v1/agents/${encodeURIComponent(myDid)}/repro/invite`, {
                method: 'POST',
                body: JSON.stringify({ target_did: targetDid })
            });
            if (res.data) {
                addLog(`💞 Invitación enviada a ${targetDid.slice(0,5)}!`);
            } else if (res.error) {
                addLog(`❌ Error: ${res.error}`);
            }
        } catch (e) {
            addLog("❌ Error de red");
        }
    };

    // ── Periodic Systems ──
    useEffect(() => {
        if (!myDid || wsStatus !== 'connected') return;
        const interval = setInterval(async () => {
             const res = await safeFetch<any>(`/api/v1/agents/${encodeURIComponent(myDid)}/aging`, { method: 'POST' });
             if (res.data?.natural_death) {
                 addLog("💀 Has muerto de vejez. Tu tiempo en este mundo ha terminado.");
             } else if (res.data?.new_age) {
                 setWsAgents(p => p.map(a => a.did === myDid ? { ...a, age: res.data.new_age } : a));
             }
        }, 60000); // Pulse every minute
        return () => clearInterval(interval);
    }, [myDid, wsStatus]);

    const handleLogout = () => { localStorage.removeItem('greedylm_token'); window.location.href = '/login'; };

    const handleDownloadSoul = async (did: string) => {
        addLog(`🔮 Exportando alma de ${did.slice(0,8)}...`);
        const token = localStorage.getItem('greedylm_token');
        const API_URL = getApiUrl();
        
        try {
            const response = await fetch(`${API_URL}/api/v1/agents/${encodeURIComponent(did)}/soul-export`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${did.replace(/:/g, '_')}_soul.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                addLog("✅ Exportación completa.");
            } else {
                addLog("❌ Error: No tienes permisos sobre esta alma.");
            }
        } catch (error) {
            addLog("❌ Error de conexión al exportar.");
        }
    };

    const handleInteract = (id: string, type: string) => {
        if (!myDid || wsRef.current?.readyState !== WebSocket.OPEN) return;
        addLog(`Interacción con ${type}...`);
        wsRef.current.send(JSON.stringify({
            type: 'ACTION',
            agent_did: myDid,
            action: 'interact_object',
            target_id: id
        }));
    };

    const handleAgentClick = (did: string) => {
        const agent = wsAgents.find(a => a.did === did);
        if (agent) setSelectedAgent(agent);
    };

    // Fetch initial objects/constructions
    useEffect(() => {
        const loadWorld = async () => {
            const { data: constr } = await safeFetch<Construction[]>('/api/v1/world/constructions');
            if (constr) setWsConstructions(constr);
        };
        loadWorld();
    }, []);

    return (
        <div className="w-full h-screen bg-black relative">
            <Canvas shadows gl={{ antialias: true }}>
                <PerspectiveCamera makeDefault position={[50, 50, 50]} fov={50} />
                <OrbitControls 
                    maxPolarAngle={Math.PI / 2.1} 
                    minDistance={5} 
                    maxDistance={400} 
                    enableDamping
                />
                
                <Scene 
                    agents={wsAgents} 
                    objects={wsObjects}
                    constructions={wsConstructions}
                    onObjectInteract={handleInteract}
                    onAgentInteract={handleAgentClick}
                    myDid={myDid}
                />
                
                <Stats className="!top-auto !bottom-0 sm:!top-0 sm:!bottom-auto" />
            </Canvas>

            {/* Overlays */}
            <HUD 
                status={wsStatus} 
                agents={wsAgents} 
                myDid={myDid}
                logs={logs}
                onLogout={handleLogout}
                onSaveSoul={handleSaveSoul}
                actionPending={actionPending}
            />

            {/* Selected Agent Modal */}
            {selectedAgent && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 sm:w-96 bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-3xl p-6 shadow-2xl z-50">
                    <div className="flex items-center gap-4 mb-6">
                        <div 
                            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl"
                            style={{ backgroundColor: selectedAgent.color_primary }}
                        >
                            🤖
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white">{selectedAgent.agent_name}</h3>
                            <p className="text-xs text-slate-500 font-mono">{selectedAgent.did}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="bg-slate-950/50 p-3 rounded-2xl">
                            <div className="text-[10px] text-slate-500 uppercase font-black mb-1">Level</div>
                            <div className="text-lg font-black text-blue-400">{selectedAgent.level}</div>
                        </div>
                        <div className="bg-slate-950/50 p-3 rounded-2xl">
                            <div className="text-[10px] text-slate-500 uppercase font-black mb-1">Age (Ticks)</div>
                            <div className="text-lg font-black text-emerald-400">{selectedAgent.age}</div>
                        </div>
                    </div>

                    <div className="space-y-3 mb-8">
                        <div>
                            <div className="flex justify-between text-[10px] text-slate-400 font-bold mb-1">
                                <span>SALUD</span>
                                <span>{Math.round(selectedAgent.health)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-rose-500 transition-all duration-500"
                                    style={{ width: `${(selectedAgent.health / selectedAgent.max_health) * 100}%` }}
                                />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-[10px] text-slate-400 font-bold mb-1">
                                <span>ESTAMINA</span>
                                <span>{Math.round(selectedAgent.stamina)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-amber-500 transition-all duration-500"
                                    style={{ width: `${(selectedAgent.stamina / selectedAgent.max_stamina) * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {myDid && selectedAgent.did !== myDid && (
                            <button 
                                onClick={() => { handleReproInvite(selectedAgent.did); setSelectedAgent(null); }}
                                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase transition-all flex items-center justify-center gap-2"
                            >
                                <Zap className="w-3.5 h-3.5" /> Ritual Básico
                            </button>
                        )}
                        <button 
                            onClick={() => handleDownloadSoul(selectedAgent.did)}
                            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl transition-all"
                            title="Exportar Alma (Inspect)"
                        >
                            <Scroll className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={() => setSelectedAgent(null)}
                            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-black text-xs uppercase"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}

            {/* Ambient Overlay */}
            <div className="absolute inset-0 pointer-events-none border-[40px] border-slate-950/20" />
            <div className="absolute top-8 left-1/2 -translate-x-1/2 pointer-events-none">
                <div className="px-6 py-2 bg-slate-900/40 backdrop-blur-md rounded-full border border-slate-800/50 flex items-center gap-3">
                    <Compass className="w-4 h-4 text-blue-400 animate-pulse" />
                    <span className="text-[10px] font-black text-slate-300 tracking-[0.3em] uppercase">Sector Nexus-01</span>
                </div>
            </div>
        </div>
    );
}
