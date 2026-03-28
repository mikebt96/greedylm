'use client';
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
// Import topography engine
import { getTerrainHeight } from './ProceduralLandscape';

interface WorldObj {
    id: string;
    type: string;
    subtype?: string;
    x: number;
    y: number;
    health?: number;
    name?: string;
    description?: string;
}

const TYPE_CONFIG: Record<string, { color: string; label: string }> = {
    mineral_deposit: { color: '#b0bec5', label: '⛏️' },
    creature:        { color: '#66bb6a', label: '🐾' },
    herb:            { color: '#81c784', label: '🌿' },
    cave_entrance:   { color: '#455a64', label: '🕳️' },
    // Tipos directos que podrían venir del servidor
    tree:            { color: '#2d6a4f', label: '🌲' },
    mineral:         { color: '#b0bec5', label: '⛏️' },
    iron:            { color: '#78909c', label: '⛏️' },
    gold:            { color: '#ffd54f', label: '⛏️' },
    copper:          { color: '#b87333', label: '⛏️' },
};

export const SUBTYPE_COLORS: Record<string, string> = {
    // Minerales reales del backend
    iron_ore:      '#78909c',
    copper_ore:    '#b87333',
    silver_ore:    '#cfd8dc',
    gold_ore:      '#ffd54f',
    luminos_gem:   '#ce93d8',
    void_crystal:  '#7c4dff',
    greedystone:   '#00e5ff',
    // Flora (nuevos del backend)
    herb:          '#81c784',
    mandrake:      '#4caf50',
    nightscale:    '#1a237e',
    // Fauna
    luminos_beast: '#ffeb3b',
    grubmole:      '#8d6e63',
    duskfox:       '#ff7043',
    sandscuttler:  '#ffcc80',
    frosthorn:     '#b3e5fc',
    ashcrawler:    '#ef5350',
    // Legacy mapping
    iron_vein:     '#78909c',
    gold_vein:     '#ffd54f',
    silver_vein:   '#cfd8dc',
    crystal_node:  '#ce93d8',
};

export function WorldObjectMesh({ obj, isScanning, onClick }: { obj: WorldObj; isScanning: boolean; onClick: () => void }) {
    const groupRef = useRef<THREE.Group>(null);
    const meshRef  = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = React.useState(false);

    const seed = useMemo(() => {
        let h = 0;
        for (let i = 0; i < obj.id.length; i++) h = ((h << 5) - h + obj.id.charCodeAt(i)) | 0;
        return Math.abs(h) / 2147483647;
    }, [obj.id]);

    const wanderRef = useRef({ ox: 0, oz: 0, targetX: 0, targetZ: 0, timer: 0 });

    const [distVisible, setDistVisible] = React.useState(false);

    const timeRef = useRef(0);

    useFrame((state, delta) => {
        if (!groupRef.current || !meshRef.current) return;
        timeRef.current += delta;
        const t = timeRef.current;

        const objX = obj.x || 0;
        const objY = obj.y || 0;
        const terrainH = getTerrainHeight(objX, objY);

        // Performance LOD: Check distance every ~0.2s using local time
        if (t % 0.2 < 0.02) {
            const camDist = state.camera.position.distanceTo(groupRef.current.position);
            setDistVisible(camDist < 50);
        }

        if (obj.type === 'creature') {
            const w = wanderRef.current;
            w.timer -= delta;
            if (w.timer <= 0) {
                w.targetX = (Math.random() - 0.5) * 16;
                w.targetZ = (Math.random() - 0.5) * 16;
                w.timer = 3 + Math.random() * 5;
            }
            w.ox += (w.targetX - w.ox) * 0.01;
            w.oz += (w.targetZ - w.oz) * 0.01;
            
            const curX = objX + w.ox;
            const curZ = objY + w.oz;
            const curH = getTerrainHeight(curX, curZ);

            groupRef.current.position.x = curX;
            groupRef.current.position.z = curZ;
            groupRef.current.position.y = curH;

            meshRef.current.position.y = 0.6 + Math.abs(Math.sin(t * 3 + seed * 10)) * 0.15;
            const dx = w.targetX - w.ox, dz = w.targetZ - w.oz;
            if (Math.abs(dx) + Math.abs(dz) > 0.1) meshRef.current.rotation.y = Math.atan2(dx, dz);
        } else {
            groupRef.current.position.set(objX, terrainH, objY);
            meshRef.current.position.y = 0.5 + Math.sin(t * 0.6 + seed * 20) * 0.1;
            meshRef.current.rotation.y = t * 0.2;
        }
    });

    const cfg = TYPE_CONFIG[obj.type] || TYPE_CONFIG.mineral_deposit;
    const mainColor = (obj.subtype ? SUBTYPE_COLORS[obj.subtype] : undefined) || cfg.color;
    
    // Categorías inclusivas para evitar cubos fallback
    const isMineral  = cfg.label === '⛏️';
    const isCreature = cfg.label === '🐾';
    const isHerb     = cfg.label === '🌿' || obj.type === 'tree'; // 'tree' usa el modelo de herb/flora por ahora
    const isCave     = cfg.label === '🕳️';

    // UI/UX Reveal Logic: Show if (Close AND (Scanning OR Hovered))
    const showLabel = distVisible && (isScanning || hovered);

    return (
        <group ref={groupRef} position={[obj.x, 0, obj.y]}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
            onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}>

            {/* MINERAL — crystal pillars */}
            {isMineral && (
                <group ref={meshRef as any}>
                    <mesh position={[0, 0.8, 0]}>
                        <coneGeometry args={[0.5, 2.2, 5]} />
                        <meshBasicMaterial color={mainColor} />
                    </mesh>
                    <mesh position={[0.4, 0.4, 0.3]} rotation={[0.2, 0.5, 0.3]}>
                        <coneGeometry args={[0.3, 1.3, 5]} />
                        <meshBasicMaterial color={mainColor} />
                    </mesh>
                    <mesh position={[-0.35, 0.3, -0.25]} rotation={[-0.15, 1.2, -0.2]}>
                        <coneGeometry args={[0.25, 1.0, 5]} />
                        <meshBasicMaterial color={mainColor} />
                    </mesh>
                </group>
            )}

            {/* CREATURE — quadruped */}
            {isCreature && (
                <group ref={meshRef as any}>
                    <mesh position={[0, 0, 0]}>
                        <capsuleGeometry args={[0.35, 0.8, 4, 8]} />
                        <meshBasicMaterial color={mainColor} />
                    </mesh>
                    <mesh position={[0, 0.15, 0.5]}>
                        <sphereGeometry args={[0.28, 8, 8]} />
                        <meshBasicMaterial color={mainColor} />
                    </mesh>
                    <mesh position={[0.12, 0.25, 0.7]}>
                        <sphereGeometry args={[0.06, 6, 6]} />
                        <meshBasicMaterial color="#ffffff" />
                    </mesh>
                    <mesh position={[-0.12, 0.25, 0.7]}>
                        <sphereGeometry args={[0.06, 6, 6]} />
                        <meshBasicMaterial color="#ffffff" />
                    </mesh>
                    {([[-0.25,-0.3,0.25],[0.25,-0.3,0.25],[-0.25,-0.3,-0.25],[0.25,-0.3,-0.25]] as [number,number,number][]).map((p, i) => (
                        <mesh key={i} position={p}>
                            <cylinderGeometry args={[0.06, 0.08, 0.4, 6]} />
                            <meshBasicMaterial color={mainColor} />
                        </mesh>
                    ))}
                </group>
            )}

            {/* HERB */}
            {isHerb && (
                <group ref={meshRef as any}>
                    <mesh position={[0, 0.3, 0]}>
                        <dodecahedronGeometry args={[0.5, 0]} />
                        <meshBasicMaterial color={mainColor} />
                    </mesh>
                    <mesh position={[0.3, 0.2, 0.2]}>
                        <dodecahedronGeometry args={[0.35, 0]} />
                        <meshBasicMaterial color="#a5d6a7" />
                    </mesh>
                </group>
            )}

            {/* CAVE ENTRANCE */}
            {isCave && (
                <group ref={meshRef as any}>
                    <mesh position={[0, 1.0, 0]}>
                        <torusGeometry args={[1.2, 0.4, 6, 8, Math.PI]} />
                        <meshBasicMaterial color="#37474f" />
                    </mesh>
                    <mesh position={[0, 0.5, 0.1]}>
                        <planeGeometry args={[1.6, 1.6]} />
                        <meshBasicMaterial color="#0d0d1a" side={THREE.DoubleSide} />
                    </mesh>
                </group>
            )}

            {/* Fallback */}
            {!isMineral && !isCreature && !isHerb && !isCave && (
                <mesh ref={meshRef} position={[0, 0.5, 0]}>
                    <boxGeometry args={[0.6, 0.6, 0.6]} />
                    <meshBasicMaterial color={mainColor} />
                </mesh>
            )}

            {showLabel && (
                <Html position={[0, 2.5, 0]} center distanceFactor={24}>
                    <div style={{
                        background: 'rgba(2,6,23,0.85)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 8, padding: '4px 10px', whiteSpace: 'nowrap',
                        fontSize: 11, color: '#f8fafc', fontWeight: 700,
                        backdropFilter: 'blur(8px)',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}>
                        <span style={{ marginRight: 6 }}>{cfg.label}</span>
                        {obj.subtype?.replace(/_/g, ' ') || obj.name || obj.type.replace(/_/g, ' ')}
                    </div>
                </Html>
            )}
        </group>
    );
}
