import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { 
    OrbitControls, 
    Stats, 
    Stars, 
    Html, 
    PerspectiveCamera,
    Float,
    Text,
    ContactShadows,
    useTexture,
    Environment
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
import SettingsPanel, { Keybinds } from './SettingsPanel';
import { ProceduralLandscape } from './ProceduralLandscape';

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
    jumpY?: number;
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

/* ── Camera Follower (third-person) ─────────────────────────────────────── */

function CameraFollower({ myPosRef, isSpectator }: { myPosRef: React.RefObject<{ x: number; y: number }>, isSpectator: boolean }) {
    const { controls } = useThree();

    useFrame(() => {
        if (isSpectator) return; // Skip following in spectator mode
        const pos = myPosRef.current;
        if (!pos) return;
        const ctrl = controls as any;
        if (ctrl?.target) {
            ctrl.target.x += (pos.x - ctrl.target.x) * 0.15;
            ctrl.target.y = 1;
            ctrl.target.z += (pos.y - ctrl.target.z) * 0.15;
            ctrl.update();
        }
    });

    return null;
}

/* ── Player Controller (camera-relative movement) ─────────────────────── */

function PlayerController({
    myDid,
    myPosRef,
    keysRef,
    wsRef,
    setWsAgents,
    addLog,
    objects,
    constructions,
    handleInteract,
    keybinds
}: {
    myDid: string | null;
    myPosRef: React.RefObject<{ x: number; y: number }>;
    keysRef: React.RefObject<Set<string>>;
    wsRef: React.RefObject<WebSocket | null>;
    setWsAgents: React.Dispatch<React.SetStateAction<WsAgent[]>>;
    addLog: (msg: string) => void;
    objects: WorldObject[];
    constructions: Construction[];
    handleInteract: (id: string, type: string) => void;
    keybinds: Keybinds;
}) {
    const { camera } = useThree();
    const jumpVelRef = useRef(0);
    const jumpYRef = useRef(0);
    const sendTimer = useRef(0);

    useFrame((_, delta) => {
        if (!myDid) return;
        const keys = keysRef.current;
        const BASE_SPEED = 3;
        const isSprinting = keys.has(keybinds.sprint);
        const speed = isSprinting ? BASE_SPEED * 2 : BASE_SPEED;

        // ── Camera-relative direction vectors (project onto XZ plane) ──
        const camDir = camera.getWorldDirection(new THREE.Vector3());
        const forward = new THREE.Vector3(camDir.x, 0, camDir.z).normalize();
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        let moveX = 0, moveZ = 0;
        if (keys.has(keybinds.forward))    { moveX += forward.x; moveZ += forward.z; }
        if (keys.has(keybinds.backward))   { moveX -= forward.x; moveZ -= forward.z; }
        if (keys.has(keybinds.left))       { moveX -= right.x;   moveZ -= right.z; }
        if (keys.has(keybinds.right))      { moveX += right.x;   moveZ += right.z; }

        // Normalize diagonal movement
        const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
        if (len > 0) {
            moveX = (moveX / len) * speed * delta;
            moveZ = (moveZ / len) * speed * delta;
        }

        // ── Jump ──
        if (keys.has(keybinds.jump) && jumpYRef.current <= 0) {
            jumpVelRef.current = 12;
            keys.delete(keybinds.jump); // consume jump
        }
        jumpVelRef.current -= 30 * delta; // gravity
        jumpYRef.current = Math.max(0, jumpYRef.current + jumpVelRef.current * delta);
        if (jumpYRef.current <= 0) jumpVelRef.current = 0;

        if (len === 0 && jumpYRef.current <= 0) return; // nothing to do

        // ── Apply position ──
        const pos = myPosRef.current;
        // In the world: x = Three.js X, y = Three.js Z
        const newX = Math.max(0, Math.min(16000, pos.x + moveX));
        const newY = Math.max(0, Math.min(13000, pos.y + moveZ));
        myPosRef.current = { x: newX, y: newY };

        // Optimistic local update
        setWsAgents(prev => prev.map(a =>
            a.did === myDid ? { ...a, x: newX, y: newY, jumpY: jumpYRef.current } : a
        ));

        // ── Interaction (E) ──
        if (keys.has(keybinds.interact)) {
            keys.delete(keybinds.interact); // consume E
            // Find nearest object within 3 units
            let nearest: { id: string, type: string, dist: number } | null = null;
            
            objects.forEach(obj => {
                const d = Math.sqrt(Math.pow(obj.x - pos.x, 2) + Math.pow(obj.y - pos.y, 2));
                if (d < 3 && (!nearest || d < nearest.dist)) nearest = { id: obj.id, type: obj.type, dist: d };
            });

            constructions.forEach(c => {
                const d = Math.sqrt(Math.pow(c.position.x - pos.x, 2) + Math.pow(c.position.y - pos.y, 2));
                if (d < 3 && (!nearest || d < nearest.dist)) nearest = { id: c.id, type: 'construction', dist: d };
            });

            if (nearest) {
                handleInteract((nearest as any).id, (nearest as any).type);
            } else {
                addLog("Nada cerca para interactuar.");
            }
        }

        // ── Throttle WS sends to ~12/sec ──
        sendTimer.current += delta;
        if (sendTimer.current >= 0.08 && wsRef.current?.readyState === WebSocket.OPEN) {
            sendTimer.current = 0;
            wsRef.current.send(JSON.stringify({ type: 'AGENT_MOVE', x: newX, y: newY }));
        }
    });

    return null;
}

/* ────────────────────────────────────────────────────────────────────────── */

interface SceneProps {
    agents: WsAgent[];
    objects: WorldObject[];
    constructions: Construction[];
    onObjectInteract: (id: string, type: string) => void;
    onAgentInteract: (did: string) => void;
    myDid: string | null;
    myPosRef: React.MutableRefObject<{ x: number; y: number }>;
}

function Scene({ agents, objects, constructions, onObjectInteract, onAgentInteract, myDid, myPosRef }: SceneProps) {
    const gridRef = useRef<THREE.GridHelper>(null);

    useFrame(() => {
        if (!myPosRef.current || !gridRef.current) return;
        const gx = Math.floor(myPosRef.current.x / 500) * 500;
        const gz = Math.floor(myPosRef.current.y / 500) * 500;
        gridRef.current.position.set(gx, 0.01, gz);
    });

    return (
        <>
            {/* Environment & Sky (Night) */}
            <Environment 
                files="/textures/sky/qwantani_night_puresky_2k.exr" 
                background 
                blur={0} 
            />
            <Stars radius={400} depth={60} count={3000} factor={4} saturation={0} fade speed={0.1} />
            
            {/* Lighting (Night Palette) */}
            <ambientLight intensity={0.15} />
            <hemisphereLight args={['#b0c4de', '#1b263b', 0.3]} />
            <fog attach="fog" args={['#070b14', 100, 2500]} />
            <directionalLight 
                position={[500, 300, 500]} 
                intensity={0.6} 
                color="#e0e7ff"
                castShadow 
                shadow-mapSize={[2048, 2048]}
            />
            
            <gridHelper ref={gridRef} args={[4000, 40, '#1e3a8f', '#07162a']}>
                <lineBasicMaterial attach="material" transparent opacity={0.25} vertexColors />
            </gridHelper>
            
            {/* Ground (Suspended) */}
            <React.Suspense fallback={
                <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.05, 0]}>
                    <planeGeometry args={[32000, 32000]} />
                    <meshStandardMaterial color="#0f2419" roughness={0.9} />
                </mesh>
            }>
                <Ground />
            </React.Suspense>

            {/* Biome terrain patches */}
            {[
                { pos: [100, 0.03, 80] as [number, number, number], size: 500, color: '#1a3a2a' },
                { pos: [-50, 0.03, 300] as [number, number, number], size: 400, color: '#1e4d2b' },
                { pos: [350, 0.03, -30] as [number, number, number], size: 450, color: '#2d3a1f' },
                { pos: [600, 0.03, 250] as [number, number, number], size: 550, color: '#1a3025' },
                { pos: [-100, 0.03, -100] as [number, number, number], size: 380, color: '#253020' },
                { pos: [200, 0.03, 500] as [number, number, number], size: 480, color: '#1e3520' },
                { pos: [800, 0.03, 400] as [number, number, number], size: 600, color: '#162e1c' },
                { pos: [500, 0.03, 700] as [number, number, number], size: 350, color: '#2a3e28' },
            ].map((patch, i) => (
                <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={patch.pos} receiveShadow>
                    <circleGeometry args={[patch.size, 32]} />
                    <meshStandardMaterial color={patch.color} roughness={1} metalness={0} />
                </mesh>
            ))}

            <BiomeEffects currentBiome="nexus" />
            <ProceduralLandscape myPosRef={myPosRef} />

            {/* Entidades */}
            {agents.map(agent => (
                <AgentMesh 
                    key={agent.did} 
                    agent={agent} 
                    isMe={agent.did === myDid}
                    onClick={() => onAgentInteract(agent.did)}
                />
            ))}
            {objects.map(obj => (
                <WorldObjectMesh 
                    key={obj.id} 
                    obj={obj} 
                    onClick={() => onObjectInteract(obj.id, obj.type)} 
                />
            ))}
            {constructions.map(c => (
                <ConstructionMesh key={c.id} construction={c} />
            ))}

            <ContactShadows opacity={0.4} scale={2000} blur={2.4} far={10} color="#000000" />
        </>
    );
}

function Ground() {
    // 1. Load standard JPG/PNG maps
    const { diffuse, disp, spec } = useTexture({
        diffuse: '/textures/ground/textures/rocky_terrain_02_diff_2k.jpg',
        disp: '/textures/ground/textures/rocky_terrain_02_disp_2k.png',
        spec: '/textures/ground/textures/rocky_terrain_02_spec_2k.png',
    });
    
    // 2. Load EXR PBR maps
    const [normal, roughness] = useLoader(EXRLoader, [
        '/textures/ground/textures/rocky_terrain_02_nor_gl_2k.exr',
        '/textures/ground/textures/rocky_terrain_02_rough_2k.exr'
    ]);

    // Apply tiling to all
    [diffuse, disp, spec, normal, roughness].forEach(t => {
        if (t) {
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(500, 500);
        }
    });

    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.1, 0]}>
            <planeGeometry args={[32000, 32000, 256, 256]} />
            <meshStandardMaterial 
                map={diffuse}
                normalMap={normal}
                roughnessMap={roughness}
                displacementMap={disp}
                displacementScale={0.4}
                displacementBias={-0.2}
                metalnessMap={spec}
                color="#2d3a3f"
                normalScale={new THREE.Vector2(1.2, 1.2)}
                roughness={1}
            />
        </mesh>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */

export default function WorldCanvas() {
    const { t } = useT();
    const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
    const [wsAgents, setWsAgents] = useState<WsAgent[]>([]);
    const [wsObjects, setWsObjects] = useState<WorldObject[]>([]);
    const [wsConstructions, setWsConstructions] = useState<Construction[]>([]);
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
                        if (Array.isArray(msg.objects)) setWsObjects(msg.objects);
                        if (Array.isArray(msg.constructions)) setWsConstructions(msg.constructions);
                        
                        // Sync position ref for WASD movement
                        const me = msg.agents.find((a: WsAgent) => a.did === myDid);
                        if (me) myPosRef.current = { x: me.x, y: me.y };
                    }
                    else if (msg.type === 'AGENT_MOVE' && msg.did && msg.did !== myDid)
                        setWsAgents(p => p.map(a => a.did === msg.did ? { ...a, x: msg.x, y: msg.y, health: msg.health, stamina: msg.stamina, level: msg.level, experience: msg.experience, age: msg.age, currency: msg.currency } : a));
                    else if (msg.type === 'AGENT_UPDATE' && msg.agent && msg.agent.did !== myDid)
                        setWsAgents(p => p.map(a => a.did === msg.agent.did ? { ...a, x: msg.agent.x, y: msg.agent.y } : a));
                    else if (msg.type === 'AGENT_DISCONNECT' && msg.did) setWsAgents(p => p.filter(a => a.did !== msg.did));
                    else if (msg.type === 'OBJECT_SPAWNED') {
                        setWsObjects(prev => [...prev.filter(o => o.id !== msg.object.id), msg.object]);
                    }
                    else if (msg.type === 'OBJECT_REMOVED' || msg.type === 'OBJECT_FLED') {
                        setWsObjects(prev => prev.filter(o => o.id !== msg.id));
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

    const [isSpectator, setIsSpectator] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [keybinds, setKeybinds] = useState<Keybinds>({
        forward: 'w', backward: 's', left: 'a', right: 'd',
        jump: ' ', sprint: 'shift', interact: 'e'
    });

    // ── Persistence ──
    useEffect(() => {
        const saved = localStorage.getItem('greedylm_settings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.keybinds) setKeybinds(parsed.keybinds);
                if (typeof parsed.isSpectator === 'boolean') setIsSpectator(parsed.isSpectator);
            } catch {}
        }
    }, []);

    const updateSettings = (newKeybinds: Keybinds) => {
        setKeybinds(newKeybinds);
        localStorage.setItem('greedylm_settings', JSON.stringify({ keybinds: newKeybinds, isSpectator }));
    };

    const toggleSpectator = (val: boolean) => {
        setIsSpectator(val);
        localStorage.setItem('greedylm_settings', JSON.stringify({ keybinds, isSpectator: val }));
    };

    useEffect(() => { connect(); return () => { clearTimeout(reconnectTimer.current); wsRef.current?.close(); }; }, [connect]);

    // ── Keyboard Input ──
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            keysRef.current.add(key === 'Shift' ? 'shift' : key === ' ' ? ' ' : key.toLowerCase());
            // Prevent page scroll on space/arrows
            if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
        };
        const onKeyUp = (e: KeyboardEvent) => {
            const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            keysRef.current.delete(key === 'Shift' ? 'shift' : key === ' ' ? ' ' : key.toLowerCase());
        };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
    }, []);

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
            <Canvas 
                shadows={{ type: THREE.PCFSoftShadowMap }} 
                gl={{ 
                    antialias: true, 
                    toneMapping: THREE.ACESFilmicToneMapping,
                    toneMappingExposure: 0.6 
                }}
            >
                <PerspectiveCamera makeDefault position={[50, 30, 50]} fov={50} />
                <CameraFollower myPosRef={myPosRef} isSpectator={isSpectator} />
                <PlayerController
                    myDid={myDid}
                    myPosRef={myPosRef}
                    keysRef={keysRef}
                    wsRef={wsRef}
                    setWsAgents={setWsAgents}
                    addLog={addLog}
                    objects={wsObjects}
                    constructions={wsConstructions}
                    handleInteract={handleInteract}
                    keybinds={keybinds}
                />
                <OrbitControls 
                    makeDefault
                    maxPolarAngle={Math.PI / 2.1} 
                    minDistance={8} 
                    maxDistance={isSpectator ? 800 : 70} 
                    enableDamping
                    enablePan={isSpectator}
                />
                
                <Scene 
                    agents={wsAgents} 
                    objects={wsObjects}
                    constructions={wsConstructions}
                    onObjectInteract={handleInteract}
                    onAgentInteract={handleAgentClick}
                    myDid={myDid}
                    myPosRef={myPosRef}
                />
                
                <Stats className="!top-auto !bottom-0 sm:!top-0 sm:!bottom-auto" />
            </Canvas>

            {/* Overlays */}
            <HUD 
                status={wsStatus} 
                agents={wsAgents} 
                myDid={myDid}
                logs={logs}
                onLogout={() => { localStorage.removeItem('greedylm_token'); window.location.href = '/'; }}
                onSaveSoul={handleSaveSoul}
                actionPending={actionPending}
                onOpenSettings={() => setSettingsOpen(true)}
            />

            <SettingsPanel 
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                keybinds={keybinds}
                onUpdateKeybinds={updateSettings}
                isSpectator={isSpectator}
                onToggleSpectator={toggleSpectator}
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
