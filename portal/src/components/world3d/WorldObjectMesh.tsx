'use client';
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface WorldObj {
    id: string;
    type: string;   // "mineral_deposit" | "creature"
    x: number;
    y: number;
    name?: string;
    description?: string;
}

const TYPE_CONFIG: Record<string, { color: string; emissive: string; label: string }> = {
    mineral_deposit: { color: '#a1887f', emissive: '#5d4037', label: '⛏️' },
    creature:        { color: '#66bb6a', emissive: '#2e7d32', label: '🐾' },
};

export function WorldObjectMesh({ obj, onClick }: { obj: WorldObj; onClick: () => void }) {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame(({ clock }) => {
        if (!meshRef.current) return;
        const t = clock.getElapsedTime();
        // Gentle float
        meshRef.current.position.y = 0.25 + Math.sin(t * 0.8 + parseFloat(obj.id.slice(-4)) * 0.01) * 0.08;
        meshRef.current.rotation.y = t * 0.3;
    });

    const cfg = TYPE_CONFIG[obj.type] || TYPE_CONFIG.mineral_deposit;
    const isCreature = obj.type === 'creature';

    return (
        <group position={[obj.x, 0, obj.y]} onClick={(e) => { e.stopPropagation(); onClick(); }}>
            <mesh ref={meshRef} position={[0, 0.25, 0]} castShadow>
                {isCreature
                    ? <sphereGeometry args={[0.3, 8, 8]} />
                    : <boxGeometry args={[0.4, 0.4, 0.4]} />
                }
                <meshStandardMaterial
                    color={cfg.color}
                    emissive={cfg.emissive}
                    emissiveIntensity={0.4}
                    roughness={0.6}
                    metalness={isCreature ? 0.0 : 0.4}
                />
            </mesh>
            <Html position={[0, 0.9, 0]} center distanceFactor={25}>
                <div style={{
                    background: 'rgba(2,6,23,0.75)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap',
                    fontSize: 9, color: '#94a3b8',
                }}>
                    {cfg.label} {obj.name || obj.type.replace('_', ' ')}
                </div>
            </Html>
        </group>
    );
}
