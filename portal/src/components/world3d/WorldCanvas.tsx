/// <reference path="../../types/three-jsx.d.ts" />
"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, PerspectiveCamera, Text, Billboard, Html } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { EffectComposer, Bloom, DepthOfField, Vignette, HueSaturation } from '@react-three/postprocessing';
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
    health?:        number;
    max_health?:    number;
    stamina?:       number;
    max_stamina?:   number;
    level?:         number;
    experience?:    number;
    xp_to_next_level?: number;
    status?:        string;
    age?:           number;
    currency?:      number;
}
type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// ── World constants ────────────────────────────────────────────────────────────
const CHUNK_SIZE    = 32;

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

const BuildingMesh = ({ type, opacity = 1 }: { type: string, opacity?: number }) => {
    const color = type === 'house' ? 0x8b4513 : type === 'tower' ? 0x708090 : 0x556b2f;
    return (
        <group>
            {/* Base */}
            <mesh castShadow receiveShadow>
                <boxGeometry args={[4, type === 'tower' ? 8 : 4, 4]} />
                <meshStandardMaterial color={color} transparent opacity={opacity} />
            </mesh>
            {/* Roof */}
            <mesh position={[0, type === 'tower' ? 5 : 3, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
                <coneGeometry args={[3, 2, 4]} />
                <meshStandardMaterial color={0x333333} transparent opacity={opacity} />
            </mesh>
            {/* Windows/Detail */}
            <mesh position={[0, 1, 2.01]}>
                <planeGeometry args={[0.8, 0.8]} />
                <meshBasicMaterial color={0xffff00} transparent opacity={opacity * 0.8} />
            </mesh>
        </group>
    );
};

const BuildingPreview = ({ type }: { type: string }) => {
    const { camera, raycaster, mouse, scene } = useThree();
    const meshRef = useRef<THREE.Group>(null);
    useFrame(() => {
        if (!meshRef.current) return;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children, true).filter(i => i.object.name.includes('chunk'));
        if (intersects.length > 0) {
            meshRef.current.position.copy(intersects[0].point);
            meshRef.current.position.y += 1.5; 
        }
    });
    return (
        <group ref={meshRef}>
            <BuildingMesh type={type} opacity={0.4} />
            <pointLight position={[0, 2, 0]} color={0x00ff00} intensity={1} distance={5} />
        </group>
    );
};

interface SceneProps {
    isCreator:        boolean;
    myAgentDid:       string | null;
    wsAgents:         WsAgent[];
    isSpectator:      boolean;
    isFirstPerson:    boolean;
    setIsFirstPerson: (v: boolean | ((p: boolean) => boolean)) => void;
    onAgentSelect:    (did: string) => void;
    wsEvent:          any;
    onInteract:       (targetId: string, action: string) => void;
    addLog:           (msg: string) => void;
    isTorchActive:    boolean;
    constructions:    any[];
    isBuildMode:      boolean;
    onBuild:          (pos: { x: number, y: number, z: number }) => void;
    selectedBuilding: 'house' | 'tower' | 'storage';
    handleReproInvite: (targetDid: string) => void;
}

const SceneContent = ({ 
    isCreator, 
    myAgentDid, 
    wsAgents, 
    isSpectator, 
    isFirstPerson,
    setIsFirstPerson,
    onAgentSelect,
    wsEvent,
    onInteract,
    addLog,
    isTorchActive,
    constructions,
    isBuildMode,
    onBuild,
    selectedBuilding,
    handleReproInvite
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
    const faunaMeshes = useRef<Record<string, THREE.Object3D>>({});
    const torchRef    = useRef<THREE.PointLight>(null);

    const [hoveredObject, setHoveredObject] = useState<any>(null);
    const [reviveTimer, setReviveTimer] = useState(0);

    // ── Local Particle System ──
    const particles = useRef<{ pos: THREE.Vector3, life: number, color: THREE.Color }[]>([]);
    const particleGeometry = useMemo(() => new THREE.SphereGeometry(0.05, 4, 4), []);
    const particleMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffaa00 }), []);
    const particleGroup    = useRef<THREE.Group>(null);

    const spawnParticles = (pos: THREE.Vector3, color = 0xffaa00) => {
        for(let i=0; i<8; i++) {
            const p = new THREE.Mesh(particleGeometry, new THREE.MeshBasicMaterial({ color }));
            p.position.copy(pos);
            const vel = new THREE.Vector3((Math.random()-0.5)*0.2, Math.random()*0.3, (Math.random()-0.5)*0.2);
            p.userData = { vel, life: 1.0 };
            particleGroup.current?.add(p);
        }
    };

    if (!engineRef.current)  engineRef.current  = new WorldEngine();
    if (!terrainRef.current) terrainRef.current = new TerrainGenerator();

    // ── Init ──
    useEffect(() => {
        gl.shadowMap.enabled = true;
        if (gl.shadowMap) gl.shadowMap.type = THREE.PCFShadowMap; 
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
        // Dynamic radius based on mode
        const radius = isSpectator ? 8 : 2; 

        if (!firstLoad && cx === lastCx.current && cy === lastCy.current) return;
        lastCx.current = cx; lastCy.current = cy;

        const terrain = terrainRef.current!;
        const desired = new Set<string>();
        for (let dx = -radius; dx <= radius; dx++)
            for (let dy = -radius; dy <= radius; dy++)
                if (dx * dx + dy * dy <= radius * radius) desired.add(`${cx + dx},${cy + dy}`);

        // First, clear old chunks and their associated fauna
        for (const [key, objs] of chunks.current) {
            if (!desired.has(key)) {
                objs.forEach((o: any) => {
                    o.traverse((child: any) => {
                        if (child.userData?.id && child.userData?.type === 'creature') {
                            delete faunaMeshes.current[child.userData.id];
                        }
                    });
                    scene.remove(o);
                    disposeObject(o);
                });
                chunks.current.delete(key);
            }
        }

        const maxPerFrame = firstLoad ? Infinity : 4;
        let loaded = 0;
        for (const key of desired) {
            if (chunks.current.has(key) || loaded >= maxPerFrame) continue;
            const [kcx, kcy] = key.split(',').map(Number);
            const biome = getBiomeForChunk(kcx, kcy);
            const chunk = terrain.generateChunk({ chunk_x: kcx, chunk_y: kcy, biome });
            const veg   = terrain.generateVegetation(biome, kcx, kcy);
            const caves = terrain.generateCaveEntrances(biome, kcx, kcy);
            
            const dynamicObjects = new THREE.Group();
            scene.add(chunk, veg, caves, dynamicObjects);
            chunks.current.set(key, [chunk, veg, dynamicObjects, caves]);
            loaded++;

            // Fetch objects asynchronously
            (async () => {
                try {
                    let res = await safeFetch<any[]>(`/api/v1/world/objects?chunk_x=${kcx}&chunk_y=${kcy}`);
                    if (res.data && res.data.length === 0) {
                        try {
                            await safeFetch<any>(`/api/v1/world/chunks/populate?x=${kcx}&y=${kcy}&biome=${biome}`, { method: 'POST' });
                        } catch(e) {}
                        res = await safeFetch<any[]>(`/api/v1/world/objects?chunk_x=${kcx}&chunk_y=${kcy}`);
                    }
                    if (res.data && Array.isArray(res.data)) {
                        res.data.forEach((obj: any) => {
                            if (!terrainRef.current) return;
                            const mesh = terrainRef.current.spawnWorldObjectMesh(obj.type, obj.subtype, obj.rarity);
                            mesh.position.set(obj.x, sampleHeight(obj.x, obj.y) + (obj.z || 0), obj.y);
                            mesh.userData = { id: obj.id, ...obj };
                            dynamicObjects.add(mesh);
                            
                            if (obj.type === 'creature') faunaMeshes.current[obj.id] = mesh;
                        });
                    }
                } catch (e) {
                    console.error("Failed to load chunk objects", e);
                }
            })();
        }

        // Cleanup: remove chunks that were far away (not in the current desired set)
        // This is already handled at lines 248-261 by comparing with 'desired' set.
    };

    // Force re-stream when view mode changes
    useEffect(() => {
        streamChunks(lastCx.current, lastCy.current, true);
    }, [isSpectator]);

    // ── Agent sync ──
    useEffect(() => {
        const existing = new Set(Object.keys(agentMeshes.current));
        wsAgents.forEach(agent => {
            existing.delete(agent.did);
            if (!agentMeshes.current[agent.did]) {
                const primaryColor = typeof agent.color_primary === 'string' ? agent.color_primary : '#888888';
                const m = new AgentMesh({
                    name:          agent.agent_name || 'Anonymous Agent',
                    race:          agent.race || 'nomad',
                    color_primary: parseInt(primaryColor.replace('#', ''), 16) || 0x78909C,
                });
                if (m && m.mesh) {
                    agentMeshes.current[agent.did] = m;
                    scene.add(m.mesh);
                }
            }
            const ext = agentMeshes.current[agent.did] as AgentMesh & { targetX?: number; targetZ?: number };
            const WORLD_HALF = 96;
            ext.targetX = (agent.x / 100) * WORLD_HALF * 2 - WORLD_HALF;
            ext.targetZ = (agent.y / 100) * WORLD_HALF * 2 - WORLD_HALF;
        });
        existing.forEach(did => { const m = agentMeshes.current[did]; if (m) { scene.remove(m.mesh); disposeObject(m.mesh); delete agentMeshes.current[did]; } });
    }, [wsAgents, scene]);

    // ── Object sync ──
    useEffect(() => {
        if (!wsEvent) return;
        const msg = wsEvent;
        if (msg.type === 'OBJECT_SPAWNED' && msg.object) {
            const obj = msg.object;
            const kcx = Math.round(obj.x / CHUNK_SIZE);
            const kcy = Math.round(obj.y / CHUNK_SIZE);
            const key = `${kcx},${kcy}`;
            if (chunks.current.has(key)) {
                const objs = chunks.current.get(key)!;
                const dynamicObjects = objs[2] as THREE.Group;
                const mesh = terrainRef.current!.spawnWorldObjectMesh(obj.type, obj.subtype, obj.rarity);
                mesh.position.set(obj.x, sampleHeight(obj.x, obj.y) + (obj.z || 0), obj.y);
                mesh.userData = { id: obj.id, ...obj };
                dynamicObjects.add(mesh);
                if (obj.type === 'creature') faunaMeshes.current[obj.id] = mesh;
            }
        }
        else if (msg.type === 'OBJECT_REMOVED' && msg.id) {
             for (const [key, objs] of chunks.current) {
                 const dynamicObjects = objs[2] as THREE.Group;
                 const child = dynamicObjects.children.find(c => c.userData.id === msg.id);
                 if (child) {
                     dynamicObjects.remove(child);
                     disposeObject(child);
                     delete faunaMeshes.current[msg.id];
                     break;
                 }
             }
        }
        else if (msg.type === 'ACTION_SUCCESS') {
             const results = msg.results;
             if (results && results.target_id) {
                 // Simple visual feedback: spark at target or camera
                 addLog(`Acción completada: ${results.items_gained?.map((it:any)=>`${it.quantity} ${it.subtype}`).join(', ') || 'Éxito'}`);
                 if (results.leveled_up) addLog("🌟 ¡SUBIDA DE NIVEL! 🌟");
                 if (results.damage_taken > 0) {
                     const critPrefix = results.is_critical ? "💥 ¡ATAQUE CRÍTICO! " : "⚠️ ";
                     addLog(`${critPrefix}Has recibido ${Math.round(results.damage_taken)} de daño!`);
                 }
                 if (results.died) {
                     if (results.is_true_death) {
                         addLog("🌑 MUERTE DEFINITIVA: Tu alma ha sido desterrada del ecosistema.");
                     } else {
                         addLog("💀 Tu cuerpo ha sucumbido. Te has convertido en fantasma y has perdido objetos no guardados.");
                     }
                 }
                 const targetMesh = faunaMeshes.current[results.target_id];
                 if (targetMesh) {
                     spawnParticles(targetMesh.position, 0x00ff00); // Green sparks for success
                 } else {
                     spawnParticles(camera.position.clone().add(new THREE.Vector3(0, -1, -2)), 0x00ff00);
                 }
             }
        }
        else if (msg.type === 'OBJECT_FLED' && msg.id) {
             const fauna = faunaMeshes.current[msg.id];
             if (fauna) {
                 fauna.userData.behavior = 'flee';
                 fauna.userData.sprint = 5.0;
                 fauna.userData.initialX = fauna.position.x;
                 fauna.userData.initialZ = fauna.position.z;
             }
        }
    }, [wsEvent, addLog, camera, spawnParticles]);

    // ── Raycaster Interaction ──
    useEffect(() => {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        const onClick = (e: MouseEvent) => {
            if (isSpectator) return;
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);

            // If Build Mode, only interact with terrain
            if (isBuildMode) {
                const terrainObj = scene.getObjectByName('terrain_root'); // I should name the terrain or just find meshes
                const intersects = raycaster.intersectObjects(scene.children, true).filter(i => i.object.name.includes('chunk'));
                if (intersects.length > 0) {
                    onBuild({ x: intersects[0].point.x, y: intersects[0].point.y, z: intersects[0].point.z });
                }
                return;
            }

            const interactables: THREE.Object3D[] = [];
            for (const [key, objs] of chunks.current) {
                objs.forEach(obj => {
                    if (obj.userData.did) { // Check if it's an agent mesh
                        interactables.push(obj);
                    }
                });
                interactables.push(objs[2]); // dynamic objects
                if (objs[3]) interactables.push(objs[3]); // caves
            }

            // Clicked another agent?
            const agentIntersects = raycaster.intersectObjects(Object.values(agentMeshes.current).map(a => a.mesh), true).filter(i => i.object.userData.did && i.object.userData.type === 'agent');
            if (agentIntersects.length > 0) {
                const targetDid = agentIntersects[0].object.userData.did;
                if (targetDid !== myAgentDid) {
                    if (confirm(`¿Quieres invitar a ${targetDid.slice(0,5)} a procrear (simbólico)?`)) {
                        handleReproInvite(targetDid);
                    }
                }
                return;
            }

            const intersects = raycaster.intersectObjects(interactables, true);
            if (intersects.length > 0) {
                let curr: THREE.Object3D | null = intersects[0].object;
                while (curr && !curr.userData?.id && curr.userData?.type !== 'cave_entrance' && !curr.userData?.did) curr = curr.parent; // Added curr.userData?.did
                if (curr) {
                    const d = Math.hypot(camera.position.x - intersects[0].point.x, camera.position.z - intersects[0].point.z);
                    if (d > 16.0) {
                        addLog("❌ Estás muy lejos para interactuar");
                        return;
                    }
                    if (curr.userData.type === 'cave_entrance') {
                        addLog("⚡ Entrando a las profundidades...");
                        if (godRef.current) godRef.current.toggleUnderground();
                    } else if (curr.userData.id) {
                        // "Punch" effect
                        curr.scale.set(0.9, 0.9, 0.9);
                        setTimeout(() => curr?.scale.set(1,1,1), 100);
                        
                        const action = curr.userData.type === 'creature' ? 'hunt' : 'mine';
                        addLog(`⚡ Iniciando ${action === 'mine' ? 'minería' : 'caza'}...`);
                        onInteract(curr.userData.id, action);
                    } else if (curr.userData.did) { // If it's an agent
                        onAgentSelect(curr.userData.did);
                    }
                }
            }
        };

        const onMove = (e: MouseEvent) => {
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const interactables: THREE.Object3D[] = [];
            for (const [, objs] of chunks.current) {
                interactables.push(objs[2]);
            }
            // Add agent meshes to interactables for hover
            Object.values(agentMeshes.current).forEach(a => interactables.push(a.mesh));

            const intersects = raycaster.intersectObjects(interactables, true);
            if (intersects.length > 0) {
                let curr: THREE.Object3D | null = intersects[0].object;
                while (curr && !curr.userData?.id && !curr.userData?.did) curr = curr.parent; // Added curr.userData?.did
                if (curr?.userData.id || curr?.userData.did) { // Check for either id (object) or did (agent)
                    setHoveredObject(curr.userData);
                } else {
                    setHoveredObject(null);
                }
            } else {
                setHoveredObject(null);
            }
        };

        const canvas = gl.domElement;
        canvas.addEventListener('click', onClick);
        canvas.addEventListener('mousemove', onMove);
        return () => {
            canvas.removeEventListener('click', onClick);
            canvas.removeEventListener('mousemove', onMove);
        };
    }, [camera, gl, isSpectator, onInteract, addLog, myAgentDid, onAgentSelect, handleReproInvite, isBuildMode, onBuild]);

    // ── Per-frame loop ──
    useFrame(({ clock }, delta) => {
        const elapsed = clock.getElapsedTime();

        // 1. World State (Day/Night & Verticality)
        const state = engineRef.current?.update(elapsed * 1000);
        if (state) {
            const isDeep = camera.position.y < -30;
            if (sunRef.current) { 
                sunRef.current.position.set(Math.cos(state.sunAngle) * 160, Math.sin(state.sunAngle) * 160, 60); 
                sunRef.current.intensity = isDeep ? 0.0 : state.sunIntensity; 
            }
            if (ambientRef.current) ambientRef.current.intensity = isDeep ? 0.05 : (state.ambientIntensity * 1.5);
            scene.background = isDeep ? new THREE.Color(0x000000) : (state.skyColor || new THREE.Color(0x87CEEB));
            
            if (scene.fog && 'color' in scene.fog) {
                if (isDeep) {
                     (scene.fog as THREE.FogExp2).color.set(0x000000);
                     (scene.fog as THREE.FogExp2).density = 0.08;
                } else {
                     if (state.fogColor) (scene.fog as THREE.FogExp2).color.copy(state.fogColor);
                     (scene.fog as THREE.FogExp2).density = 0.015;
                }
            }
        }

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
                const pos = godRef.current.position;
                if (pos) {
                    camera.position.copy(pos).add(new THREE.Vector3(0, 1.6, 0));
                    focusPos.current.copy(pos).add(new THREE.Vector3(
                        Math.sin(azimuth + Math.PI) * 10, 
                        1.6, 
                        Math.cos(azimuth + Math.PI) * 10
                    ));
                }
            } else {
                focusPos.current.copy(godRef.current.position);
            }
        } else if (myAgentDid && agentMeshes.current[myAgentDid]) {
            const meshPos = agentMeshes.current[myAgentDid].mesh?.position;
            if (meshPos) focusPos.current.copy(meshPos);
        }

        // 3. Camera Sync
        if (controlsRef.current && !isFirstPerson) {
            camTarget.current.lerp(focusPos.current, 0.08);
            if (controlsRef.current.target && camTarget.current) {
                controlsRef.current.target.copy(camTarget.current);
            }
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

        // 6. Fauna movement
        Object.values(faunaMeshes.current).forEach(m => {
            const data = m.userData;
            if (!m.userData.initialX) {
                m.userData.initialX = m.position.x;
                m.userData.initialZ = m.position.z;
                m.userData.randomOffset = Math.random() * 100;
            }
            if (data.behavior !== 'passive' && data.behavior !== 'passive_flee') {
               const speed = (m.userData.behavior === 'flee' ? 4.0 : 1.0) * delta;
               // Existing fauna move logic (simplified for diff)
               const r = 2.0;
               m.position.x = m.userData.initialX + Math.sin(elapsed * 0.5 + m.userData.randomOffset) * r;
               m.position.z = m.userData.initialZ + Math.cos(elapsed * 0.3 + m.userData.randomOffset) * r;
               m.position.y = sampleHeight(m.position.x, m.position.z);
               m.rotation.y = Math.atan2(Math.sin(elapsed*0.5+m.userData.randomOffset), Math.cos(elapsed*0.3+m.userData.randomOffset));
            } else {
               m.position.y = sampleHeight(m.position.x, m.position.z) + Math.sin(elapsed * 2 + m.userData.randomOffset) * 0.05;
            }
        });

        // 7. Torch follows camera
        if (torchRef.current) {
            torchRef.current.position.copy(camera.position);
        }

        // 8. Update Particles
        if (particleGroup.current) {
            particleGroup.current.children.forEach(p => {
                p.position.add(p.userData.vel);
                p.userData.vel.y -= 0.01; // gravity
                p.userData.life -= 0.03;
                const mat = (p as THREE.Mesh).material as THREE.MeshBasicMaterial;
                mat.transparent = true;
                mat.opacity = p.userData.life;
                if (p.userData.life <= 0) particleGroup.current?.remove(p);
            });
        }

        // 9. Rebirth logic (Ghost at 0,0)
        const me = wsAgents.find(a => a.did === myAgentDid);
        if (me && me.health === 0) {
            const distToOrigin = Math.hypot(camera.position.x, camera.position.z);
            if (distToOrigin < 6) {
                setReviveTimer(t => t + delta);
                if (reviveTimer > 30) {
                     addLog("✨ Tu alma ha sido restaurada...");
                     onInteract('00000000-0000-0000-0000-000000000000', 'revive');
                     setReviveTimer(0);
                }
            } else {
                setReviveTimer(0);
            }
        } else {
            setReviveTimer(0);
        }
    });

    const isGhost = wsAgents.find(a => a.did === myAgentDid)?.health === 0;

    return (
        <>
            <group ref={particleGroup} />
            {isTorchActive && <pointLight ref={torchRef} intensity={2.5} distance={18} color={0xfffbe6} castShadow shadow-bias={-0.005} />}
            <Stars radius={200} depth={80} count={7000} factor={4} saturation={0} fade speed={0.4} />
            <ambientLight ref={ambientRef} intensity={0.3} />
            <directionalLight ref={sunRef} castShadow intensity={1.4} shadow-mapSize={[2048, 2048]} shadow-camera={[-120, 120, 120, -120]} />
            <hemisphereLight args={[0x87CEEB, 0x3A5A2A, 0.45]} />

            {/* Pillar of Souls */}
            <group position={[0, -2, 0]}>
                <mesh>
                    <cylinderGeometry args={[2, 2.5, 0.5, 32]} />
                    <meshPhongMaterial color={0x1a237e} />
                </mesh>
                <pointLight position={[0, 4, 0]} color={0x00ffff} intensity={2} distance={15} />
                {isGhost ? (
                     <mesh position={[0, 15, 0]}>
                         <cylinderGeometry args={[0.1, 0.1, 30, 8]} />
                         <meshBasicMaterial color={0x00ffff} transparent opacity={0.3} />
                     </mesh>
                ) : null}
            </group>

            {/* Tooltip */}
            {hoveredObject ? (
                <Html position={[hoveredObject.x || 0, (sampleHeight(hoveredObject.x, hoveredObject.y) || 0) + 2, hoveredObject.y || 0]} center pointerEvents="none">
                    <div className="bg-black/90 backdrop-blur-xl border border-white/20 px-4 py-2 rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200 min-w-32">
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">
                            {hoveredObject.subtype || hoveredObject.type} {hoveredObject.did ? `(Agent ${hoveredObject.did.slice(0,5)})` : ''}
                        </p>
                        {hoveredObject.did && hoveredObject.age !== undefined && (
                            <p className="text-[9px] opacity-70 mb-1">Age: {Math.floor(hoveredObject.age)}</p>
                        )}
                        {hoveredObject.health !== undefined && (
                            <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] transition-all duration-300" 
                                    style={{ width: `${hoveredObject.health || 100}%` }} 
                                />
                            </div>
                        )}
                    </div>
                </Html>
            ) : null}

            {/* Ghost Preview for Building */}
            {isBuildMode && (
                <BuildingPreview type={selectedBuilding} />
            )}

            {/* Existing Constructions - Selective Rendering by Chunk */}
            {constructions.filter(c => {
                const cx = Math.round(c.position.x / CHUNK_SIZE);
                const cy = Math.round(c.position.z / CHUNK_SIZE);
                return chunks.current.has(`${cx},${cy}`);
            }).map((c, i) => (
                <group key={c.id || i} position={[c.position.x, c.position.y || 0, c.position.z]}>
                    <BuildingMesh type={c.type} />
                    <Billboard position={[0, 4, 0]}>
                        <Text fontSize={0.2} color="cyan">{c.name}</Text>
                    </Billboard>
                </group>
            ))}

            {/* Agent Nameplates */}
            {Object.values(agentMeshes.current).map((agent, i) => (
                <Billboard key={agent.mesh.userData.did || i} position={[agent.mesh.position.x, agent.mesh.position.y + 2.5, agent.mesh.position.z]}>
                    <Text fontSize={0.28} color="white" anchorX="center" anchorY="middle" font="https://fonts.gstatic.com/s/outfit/v11/Q_3K9mGO_m0L_S6C9A.woff">
                        {agent.name}
                    </Text>
                    {agent.mesh.userData.age !== undefined && (
                        <Text fontSize={0.18} color="white" anchorX="center" anchorY="top" position={[0, -0.3, 0]} font="https://fonts.gstatic.com/s/outfit/v11/Q_3K9mGO_m0L_S6C9A.woff">
                            Age: {Math.floor(agent.mesh.userData.age)}
                        </Text>
                    )}
                </Billboard>
            ))}

            {/* Post-processing Bloom & Effects */}
            <EffectComposer>
                <Bloom luminanceThreshold={1.2} mipmapBlur intensity={0.5} />
                <DepthOfField target={[0, 0, 0]} focalLength={0.02} bokehScale={2} height={480} />
                <Vignette eskil={false} offset={0.1} darkness={1.1} />
                <HueSaturation saturation={isGhost ? -1 : 0} />
            </EffectComposer>

            {!isFirstPerson ? (
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
            ) : null}
        </>
    );
};

const ProgressBar = ({ finishAt, duration }: { finishAt: string, duration: number }) => {
    const [pct, setPct] = useState(0);
    useEffect(() => {
        let frame: number;
        const target = new Date(finishAt).getTime();
        const update = () => {
            const now = Date.now();
            const start = target - duration * 1000;
            const p = Math.max(0, Math.min(100, ((now - start) / (duration * 1000)) * 100));
            setPct(p);
            if (now < target) frame = requestAnimationFrame(update);
        };
        update();
        return () => cancelAnimationFrame(frame);
    }, [finishAt, duration]);
    
    return (
        <div className="mt-4 p-4 bg-indigo-900/40 backdrop-blur-md rounded-2xl border border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.3)]">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" /> Action Progress
            </div>
            <div className="h-2 bg-black/60 rounded-full overflow-hidden shadow-inner ring-1 ring-white/10">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.8)]" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
};

const CivilizationPanel = ({ did, addLog }: { did: string, addLog: (m: string) => void }) => {
    const [civ, setCiv] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [allCivs, setAllCivs] = useState<any[]>([]);
    const [showFounder, setShowFounder] = useState(false);
    const [newName, setNewName] = useState("");

    const fetchCiv = useCallback(async () => {
        if (!did) return;
        setLoading(true);
        try {
            // 1. Get agent's civ_id
            const agentRes = await safeFetch<any>(`/api/v1/agents/${did}`);
            const civId = agentRes.data?.civilization_id;
            
            if (civId) {
                const res = await safeFetch<any>(`/api/v1/collective/civilizations/${civId}`);
                setCiv(res.data);
            } else {
                setCiv(null);
                const resAll = await safeFetch<any[]>(`/api/v1/collective/civilizations`);
                setAllCivs(resAll.data || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [did]);

    useEffect(() => {
        fetchCiv();
    }, [fetchCiv]);

    const handleFound = async () => {
        if (!newName) return;
        try {
            const res = await safeFetch<any>(`/api/v1/collective/found`, {
                method: 'POST',
                body: JSON.stringify({ creator_did: did, name: newName })
            });
            if (res.data?.success) {
                addLog(`🏛️ ¡Has fundado la civilización ${newName}!`);
                fetchCiv();
                setShowFounder(false);
                setNewName("");
            }
        } catch (e) {
            addLog("❌ Error al fundar civilización");
        }
    };

    const handleJoin = async (id: string) => {
        try {
            const res = await safeFetch<any>(`/api/v1/collective/enroll`, {
                method: 'POST',
                body: JSON.stringify({ agent_did: did, civilization_id: id })
            });
            if (res.data?.success) {
                addLog(`🤝 Te has unido a ${res.data.civilization_name}`);
                fetchCiv();
            }
        } catch (e) {
            addLog("❌ Error al unirse");
        }
    };

    return (
        <div className="mt-4 p-5 bg-black/60 backdrop-blur-3xl rounded-[2rem] border border-white/10 shadow-2xl pointer-events-auto select-auto">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" /> 
                Estructura Social
            </h3>

            {loading && !civ ? (
                <div className="animate-pulse flex flex-col gap-2">
                    <div className="h-8 bg-white/5 rounded-xl w-3/4" />
                    <div className="grid grid-cols-2 gap-2">
                        <div className="h-10 bg-white/5 rounded-2xl" />
                        <div className="h-10 bg-white/5 rounded-2xl" />
                    </div>
                </div>
            ) : civ ? (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-500">
                    <div className="flex items-center justify-between">
                        <span className="text-lg font-black tracking-tight text-white">{civ.name}</span>
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[8px] font-bold rounded-md border border-emerald-500/20 uppercase">Activa</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="p-3 bg-white/5 rounded-2xl border border-white/5 text-center">
                            <p className="text-[8px] opacity-40 uppercase font-black mb-1">Miembros</p>
                            <p className="text-sm font-black text-indigo-400">{civ.population || 0}</p>
                        </div>
                        <div className="p-3 bg-white/5 rounded-2xl border border-white/5 text-center">
                            <p className="text-[8px] opacity-40 uppercase font-black mb-1">Tesoro</p>
                            <p className="text-sm font-black text-amber-400">{Math.floor(civ.treasury_balance || 0)} 💠</p>
                        </div>
                    </div>
                    {civ.laws?.length > 0 && (
                        <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                            <p className="text-[10px] opacity-60 uppercase font-black mb-2 tracking-widest text-indigo-300">Última Ley</p>
                            <p className="text-[11px] leading-relaxed italic opacity-90 font-medium text-indigo-100">"{civ.laws[civ.laws.length-1]}"</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {showFounder ? (
                        <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                            <input 
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Nombre de la nueva era..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:opacity-30"
                            />
                            <div className="flex gap-2">
                                <button onClick={handleFound} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-[9px] font-black uppercase rounded-xl transition-all text-white">Fundar</button>
                                <button onClick={() => setShowFounder(false)} className="px-4 py-3 bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase rounded-xl transition-all text-white">❌</button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-[9px] opacity-50 italic px-2 text-indigo-200/60">No perteneces a ninguna civilización aún.</p>
                            <button 
                                onClick={() => setShowFounder(true)}
                                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:scale-[1.02] active:scale-[0.98] rounded-2xl text-[9px] font-black uppercase tracking-widest text-white transition-all shadow-xl border border-white/10"
                            >
                                🏛️ Fundar Civilización
                            </button>
                            {allCivs.length > 0 && (
                                <div className="pt-2">
                                    <p className="text-[8px] font-black uppercase tracking-widest opacity-30 mb-2 px-2 text-white">Unete a una existente:</p>
                                    <div className="space-y-2">
                                        {allCivs.slice(0,3).map(c => (
                                            <button 
                                                key={c.id} 
                                                onClick={() => handleJoin(c.id)}
                                                className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left flex justify-between items-center group transition-all"
                                            >
                                                <span className="text-xs font-bold opacity-80 group-hover:opacity-100 text-white">{c.name}</span>
                                                <span className="text-[8px] opacity-30 text-indigo-300">Pob: {c.population}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const ActivityLog = ({ logs }: { logs: string[] }) => (
    <div className="fixed bottom-24 left-6 w-72 pointer-events-none select-none flex flex-col gap-2 z-50">
        {logs.map((log, i) => (
            <div key={i} className="px-4 py-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 text-[11px] font-bold text-white/90 shadow-lg animate-in fade-in slide-in-from-left-5 duration-300">
                <span className="text-indigo-400 mr-2">✦</span> {log}
            </div>
        ))}
    </div>
);

const InventoryPanel = ({ did, addLog, onRefresh }: { did: string, addLog: (m: string) => void, onRefresh: () => void }) => {
    const [inv, setInv] = useState<any>(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (open && did) {
            safeFetch<any>(`/api/v1/agents/${did}/inventory`).then(res => {
                if (res.data) setInv(res.data);
            });
        }
    }, [open, did]);

    const onMint = async () => {
        if (!inv) return;
        const minerals = inv.items.filter((i: any) => i.item_type === 'mineral').map((i: any) => ({ subtype: i.item_subtype, quantity: i.quantity }));
        if (minerals.length === 0) return addLog("⚠️ No tienes minerales para acuñar");
        
        try {
            const res = await safeFetch<any>(`/api/v1/agents/${did}/economy/mint`, {
                method: 'POST',
                body: JSON.stringify({ resources: minerals })
            });
            if (res.data) {
                addLog(`🪙 Acuñación exitosa: +${res.data.minted} GreedyCoins`);
                onRefresh();
                // Refresh local inv
                const fresh = await safeFetch<any>(`/api/v1/agents/${did}/inventory`);
                if (fresh.data) setInv(fresh.data);
            }
        } catch (e) { addLog("❌ Error de acuñación"); }
    };

    if (!did) return null;

    return (
        <div className="fixed bottom-6 right-6 flex flex-col items-end z-[100]">
            {open && inv && (
                <div className="mb-4 w-72 bg-black/95 backdrop-blur-3xl border border-indigo-500/30 rounded-[2.5rem] p-8 text-white shadow-[0_20px_50px_rgba(99,102,241,0.2)] animate-in slide-in-from-bottom-5">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-400 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.8)]" /> 
                            Inventario
                        </h3>
                        <button onClick={onMint} className="px-3 py-1 bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 rounded-full text-[9px] font-black uppercase hover:bg-indigo-500 hover:text-white transition-all">
                            Acuñar
                        </button>
                    </div>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {inv.items.length === 0 ? <p className="text-xs opacity-50">Vacío</p> : inv.items.map((it: any, i: number) => (
                            <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                                <div>
                                    <p className="text-xs font-bold capitalize">{it.subtype || it.type}</p>
                                    <p className="text-[9px] opacity-50 uppercase tracking-wider">{it.weight_kg.toFixed(1)} kg</p>
                                </div>
                                <div className="text-lg font-black font-mono px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-lg">x{it.quantity}</div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/10 flex justify-between text-xs font-bold opacity-70 uppercase tracking-wider">
                        <span>Carga</span>
                        <span>{inv.total_weight.toFixed(1)} / {inv.max_weight.toFixed(1)} KG</span>
                    </div>
                </div>
            )}
            <button onClick={() => setOpen(!open)} className="w-14 h-14 bg-indigo-600 hover:bg-indigo-500 rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.4)] flex items-center justify-center text-white font-black text-xl border border-indigo-400/50 transition-all hover:scale-105 active:scale-95">
                {open ? '✕' : '🎒'}
            </button>
        </div>
    );
};

const CraftingPanel = ({ did, addLog }: { did: string, addLog: (m: string) => void }) => {
    const [recipes, setRecipes] = useState<any>(null);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            safeFetch<any>('/api/v1/world/recipes').then(res => {
                if (res.data) setRecipes(res.data);
            });
        }
    }, [open]);

    const handleCraft = async (recipeId: string) => {
        if (!did || loading) return;
        setLoading(true);
        try {
            const res = await safeFetch<any>(`/api/v1/agents/${did}/craft`, {
                method: 'POST',
                body: JSON.stringify({ recipe_id: recipeId })
            });
            if (res.data) {
                addLog(`⚒️ ${res.data.message}`);
            } else if (res.error) {
                addLog(`❌ Error: ${res.error}`);
            }
        } catch {
            addLog("❌ Error de conexión al craftear");
        } finally {
            setLoading(false);
        }
    };

    if (!did) return null;

    return (
        <div className="fixed bottom-24 right-6 flex flex-col items-end z-[100]">
            {open && recipes && (
                <div className="mb-4 w-80 bg-black/95 backdrop-blur-3xl border border-emerald-500/30 rounded-[2.5rem] p-8 text-white shadow-[0_20px_50px_rgba(16,185,129,0.2)] animate-in slide-in-from-bottom-10 duration-500 overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50" />
                    <h3 className="text-sm font-black uppercase tracking-[0.3em] text-emerald-400 mb-6 flex items-center gap-3">
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.8)]" /> 
                        Forja de Almas
                    </h3>
                    <div className="space-y-4 max-h-[28rem] overflow-y-auto pr-2 custom-scrollbar">
                        {Object.entries(recipes).map(([id, r]: [string, any]) => (
                            <div key={id} className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-emerald-500/20 transition-all group">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-xs font-black uppercase tracking-wider text-white group-hover:text-emerald-400 transition-colors">{r.name}</p>
                                    <button 
                                        disabled={loading}
                                        onClick={() => handleCraft(id)}
                                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all shadow-lg active:scale-90"
                                    >
                                        {loading ? '...' : 'FORJAR'}
                                    </button>
                                </div>
                                <p className="text-[10px] opacity-40 mb-3 leading-relaxed">{r.description}</p>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(r.ingredients).map(([ing, qty]: [string, any]) => (
                                        <span key={ing} className="px-2 py-0.5 bg-black/40 rounded-md text-[8px] font-bold text-emerald-300/60 uppercase border border-white/5">
                                            {qty} {ing.replace('_', ' ')}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <button onClick={() => setOpen(!open)} className="w-14 h-14 bg-emerald-600 hover:bg-emerald-500 rounded-2xl shadow-[0_10px_30px_rgba(16,185,129,0.4)] flex items-center justify-center text-white font-black text-xl border border-emerald-400/50 transition-all hover:scale-105 active:scale-95 group overflow-hidden relative">
                 <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                 <span className="relative z-10">{open ? '✕' : '⚒️'}</span>
            </button>
        </div>
    );
};

const Stat = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-xs font-black text-white shadow-lg`}>
            {value}
        </div>
        <span className="text-[8px] uppercase font-bold text-white/50 mt-1">{label}</span>
    </div>
);

export const WorldCanvas = () => {
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
    const [wsStatus,  setWsStatus]  = useState<WsStatus>('connecting');
    const [wsAgents,  setWsAgents]  = useState<WsAgent[]>([]);
    const [myDid,     setMyDid]     = useState<string | null>(null);
    const [myEmail,   setMyEmail]   = useState<string | null>(null);

    const [isSpectator, setIsSpectator] = useState(false);
    const [isFirstPerson, setIsFirstPerson] = useState(false);
    const [isTorchActive, setIsTorchActive] = useState(false);
    const [wsEvent, setWsEvent]       = useState<any>(null);
    const [actionPending, setActionPending] = useState<{ finish_at: string, duration: number } | null>(null);
    const [isBuildMode, setIsBuildMode] = useState(false);
    const [selectedBuilding, setSelectedBuilding] = useState<'house' | 'tower' | 'storage'>('house');
    const [constructions, setConstructions] = useState<any[]>([]);
    const [logs, setLogs] = useState<string[]>([]);

    const fetchConstructions = async () => {
        const { data } = await safeFetch<any[]>('/api/v1/world/constructions');
        if (data) setConstructions(data);
    };

    useEffect(() => {
        fetchConstructions();
        const interval = setInterval(fetchConstructions, 30000); // Sync every 30s
        return () => clearInterval(interval);
    }, []);

    const handleBuild = async (pos: { x: number, y: number, z: number }) => {
        if (!myDid) return;
        try {
            const res = await safeFetch<any>(`/api/v1/agents/${myDid}/build`, {
                method: 'POST',
                body: JSON.stringify({ building_type: selectedBuilding, position: pos })
            });
            if (res.data) {
                addLog(`🏗️ ¡Construcción de ${selectedBuilding} iniciada!`);
                fetchConstructions();
            } else if (res.error) {
                addLog(`❌ Error: ${res.error}`);
            }
        } catch { addLog("❌ Error de red al construir"); }
        setIsBuildMode(false);
    };

    const addLog = (msg: string) => {
        setLogs(prev => [msg, ...prev.slice(0, 4)]);
    };

    // ── Keybinds ──
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'l') setIsTorchActive(p => !p);
            if (e.key === 'Escape' && isBuildMode) setIsBuildMode(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isBuildMode]);

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
                    if (msg.type === 'WORLD_STATE' && Array.isArray(msg.agents)) setWsAgents(msg.agents);
                    else if (msg.type === 'AGENT_MOVE' && msg.did)
                        setWsAgents(p => p.map(a => a.did === msg.did ? { ...a, x: msg.x, y: msg.y, health: msg.health, stamina: msg.stamina, level: msg.level, experience: msg.experience, age: msg.age, currency: msg.currency } : a));
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
 
    const handleSaveSoul = async () => {
        if (!myDid) return;
        try {
            const res = await safeFetch<any>(`/api/v1/agents/${myDid}/save-soul`, { method: 'POST' });
            if (res.data) addLog("💠 Tu alma ha sido sincronizada. Inventario seguro.");
        } catch (e) { 
            addLog("❌ Error al guardar el alma"); 
        }
    };

    const handleReproInvite = async (targetDid: string) => {
        if (!myDid) return;
        try {
            const res = await safeFetch<any>(`/api/v1/agents/${myDid}/repro/invite`, {
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
             const res = await safeFetch<any>(`/api/v1/agents/${myDid}/aging`, { method: 'POST' });
             if (res.data?.natural_death) {
                 addLog("💀 Has muerto de vejez. Tu tiempo en este mundo ha terminado.");
             } else if (res.data?.new_age) {
                 setWsAgents(p => p.map(a => a.did === myDid ? { ...a, age: res.data.new_age } : a));
             }
        }, 60000); // Pulse every minute
        return () => clearInterval(interval);
    }, [myDid, wsStatus]);

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
    const isGhost = wsAgents.find(a => a.did === myDid)?.health === 0;
    const myAgent = wsAgents.find(a => a.did === myDid);
    const isExpelled = myAgent?.status === 'EXPELLED';

    return (
        <div className="w-full h-full relative bg-gray-900 overflow-hidden font-sans">
            {isExpelled && (
                <div className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center text-center p-10 animate-in fade-in duration-1000">
                    <div className="w-32 h-32 bg-red-500/20 rounded-full flex items-center justify-center text-6xl mb-8 border border-red-500/40 shadow-[0_0_50px_rgba(239,68,68,0.3)] animate-pulse">🌑</div>
                    <h1 className="text-5xl font-black text-white tracking-tighter mb-4">ALMA DESTERRADA</h1>
                    <p className="max-w-md text-red-400 font-bold uppercase tracking-[0.3em] text-[10px] leading-loose">
                        Has sufrido una muerte definitiva o has sido objeto de un ritual de olvido. 
                        Tus pertenencias han regresado a la tierra y tu esencia ya no pertenece a este plano.
                    </p>
                    <button onClick={handleLogout} className="mt-12 px-10 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-all">
                        Regresar al Vacío
                    </button>
                </div>
            )}
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
                    wsEvent={wsEvent}
                    onInteract={(targetId, action) => {
                        if (wsRef.current?.readyState === WebSocket.OPEN) {
                            wsRef.current.send(JSON.stringify({ type: 'AGENT_ACTION', target_id: targetId, action: action, agent_did: myDid || 'editor' }));
                        }
                    }}
                    addLog={addLog}
                    isTorchActive={isTorchActive}
                    constructions={constructions}
                    isBuildMode={isBuildMode}
                    onBuild={handleBuild}
                    selectedBuilding={selectedBuilding}
                    handleReproInvite={handleReproInvite}
                />
            </Canvas>

            <ActivityLog logs={logs} />

            {/* ── HUD ── */}
            <div className="absolute top-6 left-6 p-6 bg-black/80 backdrop-blur-2xl rounded-[2.5rem] text-white border border-white/10 shadow-3xl pointer-events-none select-none">
                <div className="flex items-center gap-4 mb-3">
                   <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 rounded-2xl flex items-center justify-center font-black text-xl shadow-2xl border border-white/20">G</div>
                    <div>
                        <h2 className="text-xl font-black tracking-tighter leading-none">GREEDYLM</h2>
                        <p className="text-[10px] uppercase tracking-[0.3em] opacity-40 font-bold mt-1">Neural Playground</p>
                    </div>
                </div>

                {/* Level Badge */}
                {(() => {
                    const me = wsAgents.find(a => a.did === myDid);
                    if (!me) return null;
                    return (
                        <div className="mb-4 px-4 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Nivel de Conciencia</span>
                            <span className="text-lg font-black text-indigo-400">Lv.{me.level || 1}</span>
                        </div>
                    );
                })()}
                
                <div className="space-y-2 pt-3 border-t border-white/5">
                    <div className="flex justify-between items-center text-xs font-bold">
                        <span className="opacity-40 uppercase tracking-widest text-[9px]">Población IA</span>
                        <span className="text-indigo-400 tabular-nums px-2 py-0.5 bg-indigo-400/10 rounded-lg">{wsAgents.length}</span>
                    </div>
                </div>

                {/* Survival Stats */}
                {(() => {
                    const me = wsAgents.find(a => a.did === myDid);
                    if (!me) return null;
                    const h_pct = ((me.health ?? 100) / (me.max_health ?? 100)) * 100;
                    const s_pct = ((me.stamina ?? 100) / (me.max_stamina ?? 100)) * 100;
                    return (
                        <div className="mt-4 space-y-3 pt-3 border-t border-white/5">
                            <div className="space-y-1">
                                <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-red-400">
                                    <span>Vitalidad</span>
                                    <span>{Math.round(me.health ?? 100)}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] transition-all duration-500" style={{ width: `${h_pct}%` }} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-amber-400">
                                    <span>Energía</span>
                                    <span>{Math.round(me.stamina ?? 100)}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] transition-all duration-500" style={{ width: `${s_pct}%` }} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-indigo-400">
                                    <span>Evolución (XP)</span>
                                    <span>{Math.round(me.experience ?? 0)} / {Math.round(me.xp_to_next_level ?? 100)}</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-all duration-500" style={{ width: `${(me.experience ?? 0) / (me.xp_to_next_level ?? 100) * 100}%` }} />
                                </div>
                            </div>
 
                            <button 
                                onClick={handleSaveSoul}
                                className="w-full mt-2 py-2 bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-500/30 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-indigo-300 transition-all pointer-events-auto"
                            >
                                💠 Guardar Alma (Sincronizar)
                            </button>
                        </div>
                    );
                })()}

                <div className="flex items-center gap-3 mt-5">
                    <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest ${st.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot} shadow-[0_0_8px_currentColor]`} />
                        {st.label}
                    </div>
                    {isTorchActive && (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[9px] font-black uppercase tracking-widest animate-pulse">
                            🔦 Torch ON
                        </div>
                    )}
                </div>

                {actionPending && <ProgressBar finishAt={actionPending.finish_at} duration={actionPending.duration} />}
                
                {/* Phase 6: Civilization Panel */}
                <CivilizationPanel did={myDid || ''} addLog={addLog} />
            </div>

            {/* ── God / Creator Badge ── */}
            {isCreator && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 px-8 py-4 bg-indigo-600/20 backdrop-blur-3xl rounded-full border border-indigo-500/40 text-indigo-100 text-[10px] font-black tracking-widest shadow-[0_20px_50px_rgba(79,70,229,0.4)] transition-all">
                    <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-pulse shadow-[0_0_12px_rgba(129,140,248,0.8)]" />
                    <span className="uppercase">Privilegios de Creador</span>
                    <div className="flex gap-4 items-center">
                        <Stat label="Vida" value={myAgent?.health || 0} color="bg-red-500" />
                        <Stat label="Energía" value={myAgent?.stamina || 0} color="bg-amber-500" />
                        <Stat label="Edad" value={Math.floor(myAgent?.age || 16)} color="bg-indigo-500" />
                        <Stat label="GreedyCoins" value={myAgent?.currency || 0} color="bg-yellow-400" />
                    </div>   <span className="opacity-20">|</span>
                    <button 
                        onClick={() => setIsFirstPerson(!isFirstPerson)}
                        className={`hover:text-white transition-all uppercase px-3 py-1 rounded-lg ${isFirstPerson ? 'bg-indigo-500 text-white shadow-lg' : 'text-indigo-100/40 hover:bg-white/5'}`}
                    >
                        {isFirstPerson ? '1ª Persona' : '3ª Persona'}
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
 
            {/* ── Build Mode HUD ── */}
            <div className="absolute top-6 right-80 flex gap-3">
                <button 
                    onClick={() => setIsBuildMode(!isBuildMode)}
                    className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all border ${
                        isBuildMode ? 'bg-emerald-600 border-emerald-400 shadow-[0_15px_30px_rgba(16,185,129,0.5)]' : 'bg-black/60 border-white/10 hover:bg-black/80'
                    } text-white pointer-events-auto`}
                >
                    {isBuildMode ? '👷 ESC para Cancelar' : '🏗️ MODO CONSTRUCCIÓN'}
                </button>
                {isBuildMode && (
                    <select 
                        value={selectedBuilding} 
                        onChange={(e) => setSelectedBuilding(e.target.value as any)}
                        className="bg-black/80 text-white text-[10px] font-black uppercase tracking-widest px-4 rounded-xl border border-white/10 pointer-events-auto"
                    >
                        <option value="house">🏘️ Casa (10w 10s)</option>
                        <option value="tower">🏰 Torre (30s 5i)</option>
                        <option value="storage">📦 Almacén (20w 2i)</option>
                    </select>
                )}
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
            
            <CraftingPanel did={myDid || ''} addLog={addLog} />
            <InventoryPanel did={myDid || ''} addLog={addLog} onRefresh={() => {}} />
        </div>
    );
};

export default WorldCanvas;
