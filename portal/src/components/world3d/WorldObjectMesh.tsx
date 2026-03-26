'use client';
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

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
};

const SUBTYPE_COLORS: Record<string, string> = {
    iron_vein:    '#78909c',
    gold_vein:    '#ffd54f',
    silver_vein:  '#cfd8dc',
    crystal_node: '#ce93d8',
    greedystone:  '#00e5ff',
    luminos_beast:'#ffeb3b',
    shadow_beast: '#7c4dff',
    firemoss:     '#ff7043',
    moonpetal:    '#80cbc4',
};

export function WorldObjectMesh({ obj, onClick }: { obj: WorldObj; onClick: () => void }) {
    const groupRef = useRef<THREE.Group>(null);
    const meshRef  = useRef<THREE.Mesh>(null);

    const seed = useMemo(() => {
        let h = 0;
        for (let i = 0; i < obj.id.length; i++) h = ((h << 5) - h + obj.id.charCodeAt(i)) | 0;
        return Math.abs(h) / 2147483647;
    }, [obj.id]);

    const wanderRef = useRef({ ox: 0, oz: 0, targetX: 0, targetZ: 0, timer: 0 });

    useFrame(({ clock }, delta) => {
        if (!groupRef.current || !meshRef.current) return;
        const t = clock.getElapsedTime();

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
            groupRef.current.position.x = obj.x + w.ox;
            groupRef.current.position.z = obj.y + w.oz;
            meshRef.current.position.y = 0.6 + Math.abs(Math.sin(t * 3 + seed * 10)) * 0.15;
            const dx = w.targetX - w.ox, dz = w.targetZ - w.oz;
            if (Math.abs(dx) + Math.abs(dz) > 0.1) meshRef.current.rotation.y = Math.atan2(dx, dz);
        } else {
            meshRef.current.position.y = 0.5 + Math.sin(t * 0.6 + seed * 20) * 0.1;
            meshRef.current.rotation.y = t * 0.2;
        }
    });

    const cfg = TYPE_CONFIG[obj.type] || TYPE_CONFIG.mineral_deposit;
    const mainColor = (obj.subtype ? SUBTYPE_COLORS[obj.subtype] : undefined) || cfg.color;
    const isCreature = obj.type === 'creature';
    const isMineral  = obj.type === 'mineral_deposit';
    const isHerb     = obj.type === 'herb';
    const isCave     = obj.type === 'cave_entrance';

    return (
        <group ref={groupRef} position={[obj.x, 0, obj.y]}
            onClick={(e) => { e.stopPropagation(); onClick(); }}>

            {/* MINERAL — crystal pillars, meshBasicMaterial */}
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

            {/* CREATURE — quadruped, meshBasicMaterial */}
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
                    {/* Eyes — white emissive via basic white */}
                    <mesh position={[0.12, 0.25, 0.7]}>
                        <sphereGeometry args={[0.06, 6, 6]} />
                        <meshBasicMaterial color="#ffffff" />
                    </mesh>
                    <mesh position={[-0.12, 0.25, 0.7]}>
                        <sphereGeometry args={[0.06, 6, 6]} />
                        <meshBasicMaterial color="#ffffff" />
                    </mesh>
                    {/* Legs */}
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

            <Html position={[0, 2.5, 0]} center distanceFactor={30}>
                <div style={{
                    background: 'rgba(2,6,23,0.8)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6, padding: '2px 8px', whiteSpace: 'nowrap',
                    fontSize: 10, color: '#cbd5e1', fontWeight: 600,
                    backdropFilter: 'blur(4px)',
                }}>
                    {cfg.label} {obj.subtype?.replace(/_/g, ' ') || obj.name || obj.type.replace(/_/g, ' ')}
                </div>
            </Html>
        </group>
    );
}
