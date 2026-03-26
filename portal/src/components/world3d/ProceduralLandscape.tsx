'use client';
import React, { useMemo, useState, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

/**
 * ProceduralLandscape — generates decorative 3D terrain features in chunks.
 * These are purely visual: mountains, rock clusters, trees, grass, and caves.
 */

// Simple seeded RNG
function seededRandom(seed: number) {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return s / 2147483647;
    };
}

// Generate a seed from chunk coordinates
function getChunkSeed(cx: number, cz: number, globalSeed: number) {
    return (cx * 73856093) ^ (cz * 19349663) ^ globalSeed;
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

const CHUNK_SIZE = 500;

function generateFeatures(cx: number, cz: number, seed: number): TerrainFeature[] {
    const rng = seededRandom(seed);
    const features: TerrainFeature[] = [];
    
    // Offset for the chunk's world position
    const offsetX = cx * CHUNK_SIZE;
    const offsetZ = cz * CHUNK_SIZE;

    // Density settings (scaled by CHUNK_SIZE/800 relative to previous setup)
    // 800 was the previous RANGE. So we scale counts by (500/800)^2 ≈ 0.4
    
    // Mountains — 15 per chunk
    for (let i = 0; i < 15; i++) {
        features.push({
            type: 'mountain',
            x: offsetX + rng() * CHUNK_SIZE,
            z: offsetZ + rng() * CHUNK_SIZE,
            scale: 20 + rng() * 40,
            rotY: rng() * Math.PI * 2,
            color: ['#1a2744', '#162032', '#0f1a2b', '#1e293b', '#1c2333'][Math.floor(rng() * 5)],
        });
    }

    // Rock clusters — 40 per chunk
    for (let i = 0; i < 40; i++) {
        features.push({
            type: 'rock',
            x: offsetX + rng() * CHUNK_SIZE,
            z: offsetZ + rng() * CHUNK_SIZE,
            scale: 2 + rng() * 6,
            rotY: rng() * Math.PI * 2,
            color: ['#374151', '#4b5563', '#334155', '#475569', '#52525b'][Math.floor(rng() * 5)],
        });
    }

    // Trees — 100 per chunk
    for (let i = 0; i < 100; i++) {
        features.push({
            type: 'tree',
            x: offsetX + rng() * CHUNK_SIZE,
            z: offsetZ + rng() * CHUNK_SIZE,
            scale: 4 + rng() * 6,
            rotY: rng() * Math.PI * 2,
            color: ['#1b4332', '#2d6a4f', '#264653', '#1a5632', '#234e3d'][Math.floor(rng() * 5)],
            color2: ['#4a2c0a', '#5d3a1a', '#3e2723', '#4e342e', '#6d4c41'][Math.floor(rng() * 5)],
        });
    }

    // Grass patches — 60 per chunk
    for (let i = 0; i < 60; i++) {
        features.push({
            type: 'grass',
            x: offsetX + rng() * CHUNK_SIZE,
            z: offsetZ + rng() * CHUNK_SIZE,
            scale: 8 + rng() * 17,
            rotY: rng() * Math.PI * 2,
            color: ['#0d2818', '#1a3a2a', '#162e20', '#0a2015', '#1b4332'][Math.floor(rng() * 5)],
        });
    }

    // Glowing mushrooms — 15 per chunk
    for (let i = 0; i < 15; i++) {
        features.push({
            type: 'glow_mushroom',
            x: offsetX + rng() * CHUNK_SIZE,
            z: offsetZ + rng() * CHUNK_SIZE,
            scale: 0.8 + rng() * 1.7,
            rotY: rng() * Math.PI * 2,
            color: ['#7c4dff', '#00e5ff', '#76ff03', '#ff6d00', '#e040fb'][Math.floor(rng() * 5)],
        });
    }

    // Cave entrances — 4 per chunk
    for (let i = 0; i < 4; i++) {
        features.push({
            type: 'cave',
            x: offsetX + rng() * CHUNK_SIZE,
            z: offsetZ + rng() * CHUNK_SIZE,
            scale: 2 + rng() * 3,
            rotY: rng() * Math.PI * 2,
            color: '#1a1a2e',
        });
    }

    return features;
}

function ProceduralChunk({ cx, cz, globalSeed }: { cx: number, cz: number, globalSeed: number }) {
    const features = useMemo(() => {
        const seed = getChunkSeed(cx, cz, globalSeed);
        return generateFeatures(cx, cz, seed);
    }, [cx, cz, globalSeed]);

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

// ── Feature Components (Mountain, Rock, Tree, etc.) ──

function Mountain({ f }: { f: TerrainFeature }) {
    return (
        <group position={[f.x, 0, f.z]}>
            <mesh position={[0, f.scale * 0.4, 0]} castShadow receiveShadow>
                <coneGeometry args={[f.scale * 0.8, f.scale * 1.2, 6]} />
                <meshStandardMaterial color={f.color} roughness={0.9} metalness={0.1} flatShading />
            </mesh>
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
            <mesh position={[0, f.scale * 0.5, 0]} castShadow>
                <cylinderGeometry args={[f.scale * 0.06, f.scale * 0.1, f.scale * 1.0, 6]} />
                <meshStandardMaterial color={f.color2 || '#4a2c0a'} roughness={0.9} />
            </mesh>
            <mesh position={[0, f.scale * 1.1, 0]} castShadow>
                <icosahedronGeometry args={[f.scale * 0.5, 1]} />
                <meshStandardMaterial color={f.color} roughness={0.8} metalness={0} flatShading />
            </mesh>
            <mesh position={[f.scale * 0.2, f.scale * 0.9, f.scale * 0.15]} castShadow>
                <icosahedronGeometry args={[f.scale * 0.35, 1]} />
                <meshStandardMaterial color={f.color} roughness={0.8} flatShading />
            </mesh>
        </group>
    );
}

function GrassPatch({ f }: { f: TerrainFeature }) {
    return (
        <mesh rotation={[-Math.PI / 2, 0, f.rotY]} position={[f.x, 0.04, f.z]} receiveShadow>
            <circleGeometry args={[f.scale, 16]} />
            <meshStandardMaterial color={f.color} roughness={1} metalness={0} transparent opacity={0.8} />
        </mesh>
    );
}

function Cave({ f }: { f: TerrainFeature }) {
    return (
        <group position={[f.x, 0, f.z]} rotation={[0, f.rotY, 0]}>
            <mesh position={[0, f.scale * 0.5, 0]} castShadow>
                <torusGeometry args={[f.scale, f.scale * 0.2, 8, 12, Math.PI]} />
                <meshStandardMaterial color="#2c3e50" roughness={0.9} />
            </mesh>
            <mesh position={[0, f.scale * 0.45, 0.05]}>
                <planeGeometry args={[f.scale * 1.8, f.scale * 1.2]} />
                <meshStandardMaterial color="#000000" />
            </mesh>
            {/* Reduced distance for performance */}
            <pointLight position={[0, f.scale * 0.5, f.scale * 0.5]} intensity={0.5} distance={8} color="#34495e" />
        </group>
    );
}

function GlowMushroom({ f }: { f: TerrainFeature }) {
    return (
        <group position={[f.x, 0, f.z]}>
            <mesh position={[0, f.scale * 0.3, 0]} castShadow>
                <cylinderGeometry args={[f.scale * 0.08, f.scale * 0.12, f.scale * 0.6, 6]} />
                <meshStandardMaterial color="#e0e0e0" roughness={0.7} />
            </mesh>
            <mesh position={[0, f.scale * 0.65, 0]}>
                <sphereGeometry args={[f.scale * 0.3, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial color={f.color} emissive={f.color} emissiveIntensity={1.5} roughness={0.3} transparent opacity={0.85} />
            </mesh>
            <pointLight position={[0, f.scale * 0.5, 0]} intensity={0.6} distance={4} color={f.color} />
        </group>
    );
}

// ── Main Controller ──

export function ProceduralLandscape({ myPosRef }: { myPosRef: React.MutableRefObject<{ x: number; y: number }> }) {
    // Initialize with 3x3 grid around origin for immediate spawn rendering
    const [chunks, setChunks] = useState<{cx: number, cz: number}[]>(() => {
        const initial = [];
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                initial.push({ cx: dx, cz: dz });
            }
        }
        return initial;
    });
    const lastChunk = useRef<{cx: number, cz: number}>({ cx: 0, cz: 0 });

    useFrame(() => {
        if (!myPosRef.current) return;
        
        const cx = Math.floor(myPosRef.current.x / CHUNK_SIZE);
        const cz = Math.floor(myPosRef.current.y / CHUNK_SIZE);

        if (!lastChunk.current || lastChunk.current.cx !== cx || lastChunk.current.cz !== cz) {
            lastChunk.current = { cx, cz };
            
            // Generate a 3x3 grid around the current chunk
            const newChunks = [];
            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    newChunks.push({ cx: cx + dx, cz: cz + dz });
                }
            }
            setChunks(newChunks);
        }
    });

    return (
        <group>
            {chunks.map(c => (
                <ProceduralChunk key={`${c.cx}-${c.cz}`} cx={c.cx} cz={c.cz} globalSeed={42} />
            ))}
        </group>
    );
}
