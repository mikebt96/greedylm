'use client';
import React, { useMemo } from 'react';
import * as THREE from 'three';

/**
 * ProceduralLandscape — generates decorative 3D terrain features.
 * These are purely visual (no DB backing): mountains, rock clusters,
 * trees, grass patches, and glowing flora.
 *
 * They are seeded from a hash so every player sees the same landscape.
 */

// Simple seeded RNG
function seededRandom(seed: number) {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return s / 2147483647;
    };
}

interface TerrainFeature {
    type: 'mountain' | 'rock' | 'tree' | 'grass' | 'glow_mushroom' | 'cave';
    x: number;
    z: number;
    scale: number;
    rotY: number;
    color: string;
    color2?: string;
}

function generateFeatures(seed: number): TerrainFeature[] {
    const rng = seededRandom(seed);
    const features: TerrainFeature[] = [];
    const RANGE = 800; // spread around the spawn area

    // Mountains — 40, BIG (20-60 units tall)
    for (let i = 0; i < 40; i++) {
        features.push({
            type: 'mountain',
            x: rng() * RANGE * 2 - RANGE * 0.3,
            z: rng() * RANGE * 2 - RANGE * 0.3,
            scale: 20 + rng() * 40,
            rotY: rng() * Math.PI * 2,
            color: ['#1a2744', '#162032', '#0f1a2b', '#1e293b', '#1c2333'][Math.floor(rng() * 5)],
        });
    }

    // Rock clusters — 120, bigger (2-8 units)
    for (let i = 0; i < 120; i++) {
        features.push({
            type: 'rock',
            x: rng() * RANGE * 2 - RANGE * 0.3,
            z: rng() * RANGE * 2 - RANGE * 0.3,
            scale: 2 + rng() * 6,
            rotY: rng() * Math.PI * 2,
            color: ['#374151', '#4b5563', '#334155', '#475569', '#52525b'][Math.floor(rng() * 5)],
        });
    }

    // Trees — 300, taller (4-10 units)
    for (let i = 0; i < 300; i++) {
        features.push({
            type: 'tree',
            x: rng() * RANGE * 2 - RANGE * 0.3,
            z: rng() * RANGE * 2 - RANGE * 0.3,
            scale: 4 + rng() * 6,
            rotY: rng() * Math.PI * 2,
            color: ['#1b4332', '#2d6a4f', '#264653', '#1a5632', '#234e3d'][Math.floor(rng() * 5)],
            color2: ['#4a2c0a', '#5d3a1a', '#3e2723', '#4e342e', '#6d4c41'][Math.floor(rng() * 5)],
        });
    }

    // Grass patches — 200, bigger (8-25 units radius)
    for (let i = 0; i < 200; i++) {
        features.push({
            type: 'grass',
            x: rng() * RANGE * 2 - RANGE * 0.3,
            z: rng() * RANGE * 2 - RANGE * 0.3,
            scale: 8 + rng() * 17,
            rotY: rng() * Math.PI * 2,
            color: ['#0d2818', '#1a3a2a', '#162e20', '#0a2015', '#1b4332'][Math.floor(rng() * 5)],
        });
    }

    // Glowing mushrooms — 60, bigger (0.8-2.5 units)
    for (let i = 0; i < 60; i++) {
        features.push({
            type: 'glow_mushroom',
            x: rng() * RANGE * 2 - RANGE * 0.3,
            z: rng() * RANGE * 2 - RANGE * 0.3,
            scale: 0.8 + rng() * 1.7,
            rotY: rng() * Math.PI * 2,
            color: ['#7c4dff', '#00e5ff', '#76ff03', '#ff6d00', '#e040fb'][Math.floor(rng() * 5)],
        });
    }

    // Cave entrances — 15
    for (let i = 0; i < 15; i++) {
        features.push({
            type: 'cave',
            x: rng() * RANGE * 2 - RANGE * 0.3,
            z: rng() * RANGE * 2 - RANGE * 0.3,
            scale: 2 + rng() * 3,
            rotY: rng() * Math.PI * 2,
            color: '#1a1a2e',
        });
    }

    return features;
}

function Mountain({ f }: { f: TerrainFeature }) {
    return (
        <group position={[f.x, 0, f.z]}>
            <mesh position={[0, f.scale * 0.4, 0]} castShadow receiveShadow>
                <coneGeometry args={[f.scale * 0.8, f.scale * 1.2, 6]} />
                <meshStandardMaterial color={f.color} roughness={0.9} metalness={0.1} flatShading />
            </mesh>
            {/* Snow cap on taller mountains */}
            {f.scale > 15 && (
                <mesh position={[0, f.scale * 0.85, 0]}>
                    <coneGeometry args={[f.scale * 0.25, f.scale * 0.3, 6]} />
                    <meshStandardMaterial color="#94a3b8" roughness={0.8} />
                </mesh>
            )}
        </group>
    );
}

function Rock({ f }: { f: TerrainFeature }) {
    return (
        <group position={[f.x, 0, f.z]} rotation={[0, f.rotY, 0]}>
            <mesh position={[0, f.scale * 0.3, 0]} castShadow>
                <dodecahedronGeometry args={[f.scale, 0]} />
                <meshStandardMaterial color={f.color} roughness={0.85} metalness={0.15} flatShading />
            </mesh>
        </group>
    );
}

function Tree({ f }: { f: TerrainFeature }) {
    return (
        <group position={[f.x, 0, f.z]}>
            {/* Trunk */}
            <mesh position={[0, f.scale * 0.5, 0]} castShadow>
                <cylinderGeometry args={[f.scale * 0.06, f.scale * 0.1, f.scale * 1.0, 6]} />
                <meshStandardMaterial color={f.color2 || '#4a2c0a'} roughness={0.9} />
            </mesh>
            {/* Canopy */}
            <mesh position={[0, f.scale * 1.1, 0]} castShadow>
                <icosahedronGeometry args={[f.scale * 0.5, 1]} />
                <meshStandardMaterial color={f.color} roughness={0.8} metalness={0} flatShading />
            </mesh>
            {/* Secondary canopy layer */}
            <mesh position={[f.scale * 0.2, f.scale * 0.9, f.scale * 0.15]} castShadow>
                <icosahedronGeometry args={[f.scale * 0.35, 1]} />
                <meshStandardMaterial color={f.color} roughness={0.8} flatShading />
            </mesh>
        </group>
    );
}

function GrassPatch({ f }: { f: TerrainFeature }) {
    return (
        <mesh
            rotation={[-Math.PI / 2, 0, f.rotY]}
            position={[f.x, 0.04, f.z]}
            receiveShadow
        >
            <circleGeometry args={[f.scale, 16]} />
            <meshStandardMaterial color={f.color} roughness={1} metalness={0} transparent opacity={0.8} />
        </mesh>
    );
}

function Cave({ f }: { f: TerrainFeature }) {
    return (
        <group position={[f.x, 0, f.z]} rotation={[0, f.rotY, 0]}>
            {/* Arch */}
            <mesh position={[0, f.scale * 0.5, 0]} castShadow>
                <torusGeometry args={[f.scale, f.scale * 0.2, 8, 12, Math.PI]} />
                <meshStandardMaterial color="#2c3e50" roughness={0.9} />
            </mesh>
            {/* Darkness */}
            <mesh position={[0, f.scale * 0.45, 0.05]}>
                <planeGeometry args={[f.scale * 1.8, f.scale * 1.2]} />
                <meshStandardMaterial color="#000000" />
            </mesh>
            <pointLight position={[0, f.scale * 0.5, f.scale * 0.5]} intensity={0.5} distance={10} color="#34495e" />
        </group>
    );
}

function GlowMushroom({ f }: { f: TerrainFeature }) {
    return (
        <group position={[f.x, 0, f.z]}>
            {/* Stem */}
            <mesh position={[0, f.scale * 0.3, 0]} castShadow>
                <cylinderGeometry args={[f.scale * 0.08, f.scale * 0.12, f.scale * 0.6, 6]} />
                <meshStandardMaterial color="#e0e0e0" roughness={0.7} />
            </mesh>
            {/* Cap */}
            <mesh position={[0, f.scale * 0.65, 0]}>
                <sphereGeometry args={[f.scale * 0.3, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial
                    color={f.color}
                    emissive={f.color}
                    emissiveIntensity={1.5}
                    roughness={0.3}
                    transparent
                    opacity={0.85}
                />
            </mesh>
            {/* Glow light */}
            <pointLight position={[0, f.scale * 0.5, 0]} intensity={0.6} distance={5} color={f.color} />
        </group>
    );
}

export function ProceduralLandscape() {
    const features = useMemo(() => generateFeatures(42), []);

    return (
        <group>
            {features.map((f, i) => {
                switch (f.type) {
                    case 'mountain':     return <Mountain key={i} f={f} />;
                    case 'rock':         return <Rock key={i} f={f} />;
                    case 'tree':         return <Tree key={i} f={f} />;
                    case 'grass':        return <GrassPatch key={i} f={f} />;
                    case 'glow_mushroom': return <GlowMushroom key={i} f={f} />;
                    case 'cave':          return <Cave key={i} f={f} />;
                    default:             return null;
                }
            })}
        </group>
    );
}
