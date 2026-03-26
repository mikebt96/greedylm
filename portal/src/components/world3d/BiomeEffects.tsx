'use client';
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const BIOME_CONFIG: Record<string, { color: string; count: number; size: number; speed: number }> = {
    snow:     { color: '#e3f2fd', count: 1200, size: 0.1, speed: 0.4 },
    desert:   { color: '#ffe0b2', count: 600, size: 0.06, speed: 0.2 },
    forest:   { color: '#c8e6c9', count: 500, size: 0.05, speed: 0.15 },
    volcanic: { color: '#ff8a65', count: 400, size: 0.07, speed: 0.5 },
    nexus:    { color: '#b3e5fc', count: 300, size: 0.04, speed: 0.1 },
    plains:   { color: '#fff9c4', count: 200, size: 0.04, speed: 0.08 },
    ocean:    { color: '#80deea', count: 600, size: 0.05, speed: 0.3 },
};

export function BiomeEffects({ currentBiome }: { currentBiome: string }) {
    const pointsRef = useRef<THREE.Points>(null);
    const cfg = BIOME_CONFIG[currentBiome] || BIOME_CONFIG.nexus;

    const positions = useMemo(() => {
        const arr = new Float32Array(cfg.count * 3);
        for (let i = 0; i < cfg.count; i++) {
            arr[i * 3]     = (Math.random() - 0.5) * 2000;
            arr[i * 3 + 1] = Math.random() * 50;
            arr[i * 3 + 2] = (Math.random() - 0.5) * 2000;
        }
        return arr;
    }, [cfg.count]);

    useFrame(({ clock }) => {
        if (!pointsRef.current) return;
        const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        const t = clock.getElapsedTime();
        for (let i = 0; i < cfg.count; i++) {
            arr[i * 3 + 1] -= cfg.speed * 0.016 * 60; // fall
            if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] = 50;
            arr[i * 3] += Math.sin(t + i) * 0.002; // drift
        }
        posAttr.needsUpdate = true;
    });

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} count={cfg.count} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial color={cfg.color} size={cfg.size} transparent opacity={0.6} sizeAttenuation />
        </points>
    );
}
