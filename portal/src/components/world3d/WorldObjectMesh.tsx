'use client';
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface WorldObj {
    id: string;
    type: string;   // "mineral_deposit" | "creature" | "herb" | "cave_entrance"
    subtype?: string;
    x: number;
    y: number;
    health?: number;
    name?: string;
    description?: string;
}

const TYPE_CONFIG: Record<string, { color: string; emissive: string; label: string; scale: number }> = {
    mineral_deposit: { color: '#b0bec5', emissive: '#5d4037', label: '⛏️', scale: 1.0 },
    creature:        { color: '#66bb6a', emissive: '#2e7d32', label: '🐾', scale: 1.0 },
    herb:            { color: '#81c784', emissive: '#388e3c', label: '🌿', scale: 0.7 },
    cave_entrance:   { color: '#455a64', emissive: '#263238', label: '🕳️', scale: 1.5 },
};

const SUBTYPE_COLORS: Record<string, string> = {
    iron_vein:       '#78909c',
    gold_vein:       '#ffd54f',
    silver_vein:     '#cfd8dc',
    crystal_node:    '#ce93d8',
    greedystone:     '#00e5ff',
    luminos_beast:   '#ffeb3b',
    shadow_beast:    '#7c4dff',
    firemoss:        '#ff7043',
    moonpetal:       '#80cbc4',
};

export function WorldObjectMesh({ obj, onClick }: { obj: WorldObj; onClick: () => void }) {
    const groupRef = useRef<THREE.Group>(null);
    const meshRef = useRef<THREE.Mesh>(null);

    // Stable random seed from ID for creature wandering
    const seed = useMemo(() => {
        let h = 0;
        const s = obj.id;
        for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
        return Math.abs(h) / 2147483647;
    }, [obj.id]);

    // Creature wander offset
    const wanderRef = useRef({ ox: 0, oz: 0, targetX: 0, targetZ: 0, timer: 0 });

    useFrame(({ clock }, delta) => {
        if (!groupRef.current || !meshRef.current) return;
        const t = clock.getElapsedTime();

        if (obj.type === 'creature') {
            // Autonomous wandering AI
            const w = wanderRef.current;
            w.timer -= delta;
            if (w.timer <= 0) {
                // Pick a new wander target within 8 units of origin
                w.targetX = (Math.random() - 0.5) * 16;
                w.targetZ = (Math.random() - 0.5) * 16;
                w.timer = 3 + Math.random() * 5; // Move every 3-8 seconds
            }
            // Lerp toward target
            w.ox += (w.targetX - w.ox) * 0.01;
            w.oz += (w.targetZ - w.oz) * 0.01;

            groupRef.current.position.x = obj.x + w.ox;
            groupRef.current.position.z = obj.y + w.oz;

            // Bobbing walk animation
            meshRef.current.position.y = 0.6 + Math.abs(Math.sin(t * 3 + seed * 10)) * 0.15;

            // Face movement direction
            const dx = w.targetX - w.ox;
            const dz = w.targetZ - w.oz;
            if (Math.abs(dx) + Math.abs(dz) > 0.1) {
                meshRef.current.rotation.y = Math.atan2(dx, dz);
            }
        } else {
            // Static objects: gentle float + rotation
            meshRef.current.position.y = 0.5 + Math.sin(t * 0.6 + seed * 20) * 0.1;
            meshRef.current.rotation.y = t * 0.2;
        }
    });

    const cfg = TYPE_CONFIG[obj.type] || TYPE_CONFIG.mineral_deposit;
    const subtypeColor = obj.subtype ? SUBTYPE_COLORS[obj.subtype] : undefined;
    const mainColor = subtypeColor || cfg.color;
    const isCreature = obj.type === 'creature';
    const isMineral = obj.type === 'mineral_deposit';
    const isHerb = obj.type === 'herb';
    const isCave = obj.type === 'cave_entrance';

    return (
        <group
            ref={groupRef}
            position={[obj.x, 0, obj.y]}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
        >
            {/* === MINERAL DEPOSIT: Crystal pillar cluster === */}
            {isMineral && (
                <group ref={meshRef as any}>
                    {/* Main crystal */}
                    <mesh position={[0, 0.8, 0]} castShadow>
                        <coneGeometry args={[0.5, 2.2, 5]} />
                        <meshStandardMaterial
                            color={mainColor}
                            emissive={subtypeColor || cfg.emissive}
                            emissiveIntensity={0.6}
                            roughness={0.3}
                            metalness={0.7}
                        />
                    </mesh>
                    {/* Secondary crystal */}
                    <mesh position={[0.4, 0.4, 0.3]} rotation={[0.2, 0.5, 0.3]} castShadow>
                        <coneGeometry args={[0.3, 1.3, 5]} />
                        <meshStandardMaterial
                            color={mainColor}
                            emissive={subtypeColor || cfg.emissive}
                            emissiveIntensity={0.4}
                            roughness={0.3}
                            metalness={0.7}
                        />
                    </mesh>
                    {/* Third crystal */}
                    <mesh position={[-0.35, 0.3, -0.25]} rotation={[-0.15, 1.2, -0.2]} castShadow>
                        <coneGeometry args={[0.25, 1.0, 5]} />
                        <meshStandardMaterial
                            color={mainColor}
                            emissive={subtypeColor || cfg.emissive}
                            emissiveIntensity={0.5}
                            roughness={0.3}
                            metalness={0.7}
                        />
                    </mesh>
                    {/* Glow light */}
                    <pointLight
                        position={[0, 1.2, 0]}
                        intensity={0.8}
                        distance={6}
                        color={subtypeColor || cfg.emissive}
                    />
                </group>
            )}

            {/* === CREATURE: Quadruped body === */}
            {isCreature && (
                <group ref={meshRef as any}>
                    {/* Body */}
                    <mesh position={[0, 0, 0]} castShadow>
                        <capsuleGeometry args={[0.35, 0.8, 4, 8]} />
                        <meshStandardMaterial
                            color={mainColor}
                            emissive={subtypeColor || cfg.emissive}
                            emissiveIntensity={0.3}
                            roughness={0.6}
                        />
                    </mesh>
                    {/* Head */}
                    <mesh position={[0, 0.15, 0.5]} castShadow>
                        <sphereGeometry args={[0.28, 8, 8]} />
                        <meshStandardMaterial
                            color={mainColor}
                            emissive={subtypeColor || cfg.emissive}
                            emissiveIntensity={0.3}
                            roughness={0.6}
                        />
                    </mesh>
                    {/* Eyes */}
                    <mesh position={[0.12, 0.25, 0.7]}>
                        <sphereGeometry args={[0.06, 6, 6]} />
                        <meshStandardMaterial emissive="#ffffff" emissiveIntensity={2} color="#ffffff" />
                    </mesh>
                    <mesh position={[-0.12, 0.25, 0.7]}>
                        <sphereGeometry args={[0.06, 6, 6]} />
                        <meshStandardMaterial emissive="#ffffff" emissiveIntensity={2} color="#ffffff" />
                    </mesh>
                    {/* Legs (4) */}
                    {[[-0.25, -0.3, 0.25], [0.25, -0.3, 0.25], [-0.25, -0.3, -0.25], [0.25, -0.3, -0.25]].map((p, i) => (
                        <mesh key={i} position={p as [number, number, number]} castShadow>
                            <cylinderGeometry args={[0.06, 0.08, 0.4, 6]} />
                            <meshStandardMaterial color={mainColor} roughness={0.7} />
                        </mesh>
                    ))}
                    {/* Creature glow */}
                    <pointLight position={[0, 0.3, 0]} intensity={0.4} distance={4} color={subtypeColor || '#66bb6a'} />
                </group>
            )}

            {/* === HERB: Bush with leaves === */}
            {isHerb && (
                <group ref={meshRef as any}>
                    <mesh position={[0, 0.3, 0]} castShadow>
                        <dodecahedronGeometry args={[0.5, 0]} />
                        <meshStandardMaterial
                            color={mainColor}
                            emissive={subtypeColor || cfg.emissive}
                            emissiveIntensity={0.4}
                            roughness={0.8}
                        />
                    </mesh>
                    <mesh position={[0.3, 0.2, 0.2]} castShadow>
                        <dodecahedronGeometry args={[0.35, 0]} />
                        <meshStandardMaterial color="#a5d6a7" roughness={0.8} />
                    </mesh>
                </group>
            )}

            {/* === CAVE ENTRANCE: Dark arch === */}
            {isCave && (
                <group ref={meshRef as any}>
                    <mesh position={[0, 1.0, 0]} castShadow>
                        <torusGeometry args={[1.2, 0.4, 6, 8, Math.PI]} />
                        <meshStandardMaterial color="#37474f" roughness={0.9} metalness={0.1} />
                    </mesh>
                    <mesh position={[0, 0.5, 0.1]}>
                        <planeGeometry args={[1.6, 1.6]} />
                        <meshStandardMaterial color="#000000" emissive="#1a237e" emissiveIntensity={0.3} side={THREE.DoubleSide} />
                    </mesh>
                    <pointLight position={[0, 0.5, 0.5]} intensity={0.3} distance={5} color="#1a237e" />
                </group>
            )}

            {/* Fallback for unknown types */}
            {!isMineral && !isCreature && !isHerb && !isCave && (
                <mesh ref={meshRef} position={[0, 0.5, 0]} castShadow>
                    <boxGeometry args={[0.6, 0.6, 0.6]} />
                    <meshStandardMaterial color={mainColor} emissive={cfg.emissive} emissiveIntensity={0.4} />
                </mesh>
            )}

            {/* Label */}
            <Html position={[0, 2.5, 0]} center distanceFactor={30}>
                <div style={{
                    background: 'rgba(2,6,23,0.8)', border: '1px solid rgba(255,255,255,0.1)',
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
