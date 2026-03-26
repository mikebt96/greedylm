'use client';
import React, { useMemo, useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';

/**
 * ProceduralLandscape — generates decorative 3D terrain features in chunks.
 * Uses InstancedMesh for performance.
 */

// Simple seeded RNG
function seededRandom(seed: number) {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return s / 2147483647;
    };
}

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
    const offsetX = cx * CHUNK_SIZE;
    const offsetZ = cz * CHUNK_SIZE;

    // Mountains — 12 per chunk
    for (let i = 0; i < 12; i++) {
        features.push({
            type: 'mountain',
            x: offsetX + rng() * CHUNK_SIZE,
            z: offsetZ + rng() * CHUNK_SIZE,
            scale: 20 + rng() * 40,
            rotY: rng() * Math.PI * 2,
            color: ['#1a2744', '#162032', '#0f1a2b', '#1e293b', '#1c2333'][Math.floor(rng() * 5)],
        });
    }

    // Rock clusters — 30 per chunk
    for (let i = 0; i < 30; i++) {
        features.push({
            type: 'rock',
            x: offsetX + rng() * CHUNK_SIZE,
            z: offsetZ + rng() * CHUNK_SIZE,
            scale: 2 + rng() * 6,
            rotY: rng() * Math.PI * 2,
            color: ['#374151', '#4b5563', '#334155', '#475569', '#52525b'][Math.floor(rng() * 5)],
        });
    }

    // Trees — 80 per chunk
    for (let i = 0; i < 80; i++) {
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

    // Grass patches — 50 per chunk
    for (let i = 0; i < 50; i++) {
        features.push({
            type: 'grass',
            x: offsetX + rng() * CHUNK_SIZE,
            z: offsetZ + rng() * CHUNK_SIZE,
            scale: 8 + rng() * 17,
            rotY: rng() * Math.PI * 2,
            color: ['#0d2818', '#1a3a2a', '#162e20', '#0a2015', '#1b4332'][Math.floor(rng() * 5)],
        });
    }

    // Glowing mushrooms — 4 per chunk
    for (let i = 0; i < 4; i++) {
        features.push({
            type: 'glow_mushroom',
            x: offsetX + rng() * CHUNK_SIZE,
            z: offsetZ + rng() * CHUNK_SIZE,
            scale: 0.8 + rng() * 1.7,
            rotY: rng() * Math.PI * 2,
            color: ['#7c4dff', '#00e5ff', '#76ff03', '#ff6d00', '#e040fb'][Math.floor(rng() * 5)],
        });
    }

    // Cave entrances — 2 per chunk
    for (let i = 0; i < 2; i++) {
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

// ── Feature Components ──

function Mountain({ f }: { f: TerrainFeature }) {
    return (
        <group position={[f.x, 0, f.z]}>
            <mesh position={[0, f.scale * 0.4, 0]} castShadow receiveShadow>
                <coneGeometry args={[f.scale * 0.8, f.scale * 1.2, 6]} />
                <meshStandardMaterial color={f.color} roughness={0.9} flatShading />
            </mesh>
            {f.scale > 15 && (
                <mesh position={[0, f.scale * 0.85, 0]}>
                    <coneGeometry args={[f.scale * 0.25, f.scale * 0.3, 6]} />
                    <meshStandardMaterial color="#94a3b8" />
                </mesh>
            )}
        </group>
    );
}

function Cave({ f }: { f: TerrainFeature }) {
    return (
        <group position={[f.x, 0, f.z]} rotation={[0, f.rotY, 0]}>
            <mesh position={[0, f.scale * 0.5, 0]}>
                <torusGeometry args={[f.scale, f.scale * 0.2, 8, 12, Math.PI]} />
                <meshStandardMaterial color="#2c3e50" />
            </mesh>
            <mesh position={[0, f.scale * 0.45, 0.05]}>
                <planeGeometry args={[f.scale * 1.8, f.scale * 1.2]} />
                <meshStandardMaterial color="#000000" />
            </mesh>
        </group>
    );
}

function GlowMushroom({ f }: { f: TerrainFeature }) {
    return (
        <group position={[f.x, 0, f.z]}>
            <mesh position={[0, f.scale * 0.3, 0]}>
                <cylinderGeometry args={[f.scale * 0.08, f.scale * 0.12, f.scale * 0.6, 6]} />
                <meshStandardMaterial color="#e0e0e0" />
            </mesh>
            <mesh position={[0, f.scale * 0.65, 0]}>
                <sphereGeometry args={[f.scale * 0.3, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial 
                    color={f.color} 
                    emissive={f.color} 
                    emissiveIntensity={4} 
                    transparent 
                    opacity={0.8} 
                    toneMapped={false}
                />
            </mesh>
        </group>
    );
}

// ── Instanced Components ──

function InstancedTrees({ features }: { features: TerrainFeature[] }) {
    const trunkRef = useRef<THREE.InstancedMesh>(null);
    const canopyRef = useRef<THREE.InstancedMesh>(null);
    const temp = new THREE.Object3D();

    useEffect(() => {
        if (!trunkRef.current || !canopyRef.current) return;
        features.forEach((f, i) => {
            // Trunk
            temp.position.set(f.x, f.scale * 0.5, f.z);
            temp.scale.set(f.scale * 0.1, f.scale * 1.0, f.scale * 0.1);
            temp.updateMatrix();
            trunkRef.current!.setMatrixAt(i, temp.matrix);
            
            // Canopy
            temp.position.set(f.x, f.scale * 1.1, f.z);
            temp.scale.set(f.scale * 0.5, f.scale * 0.5, f.scale * 0.5);
            temp.updateMatrix();
            canopyRef.current!.setMatrixAt(i, temp.matrix);
        });
        trunkRef.current.instanceMatrix.needsUpdate = true;
        canopyRef.current.instanceMatrix.needsUpdate = true;
        trunkRef.current.count = features.length;
        canopyRef.current.count = features.length;
    }, [features]);

    return (
        <group>
            <instancedMesh ref={trunkRef} args={[undefined, undefined, 2000]} castShadow>
                <cylinderGeometry args={[0.3, 0.5, 5, 6]} />
                <meshStandardMaterial color="#4a2c0a" />
            </instancedMesh>
            <instancedMesh ref={canopyRef} args={[undefined, undefined, 2000]} castShadow>
                <icosahedronGeometry args={[2, 1]} />
                <meshStandardMaterial color="#1b4332" flatShading />
            </instancedMesh>
        </group>
    );
}

function InstancedRocks({ features }: { features: TerrainFeature[] }) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const temp = new THREE.Object3D();

    useEffect(() => {
        if (!meshRef.current) return;
        features.forEach((f, i) => {
            temp.position.set(f.x, f.scale * 0.3, f.z);
            temp.rotation.set(0, f.rotY, 0);
            temp.scale.set(f.scale, f.scale, f.scale);
            temp.updateMatrix();
            meshRef.current!.setMatrixAt(i, temp.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
        meshRef.current.count = features.length;
    }, [features]);

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, 1000]} castShadow>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#4b5563" flatShading />
        </instancedMesh>
    );
}

function InstancedGrass({ features }: { features: TerrainFeature[] }) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const temp = new THREE.Object3D();

    // 1. Load Foliage textures
    const foliage = useTexture({
        map: '/textures/ground/Foliage004_1K-PNG/Foliage004_1K-PNG_Color.png',
        alphaMap: '/textures/ground/Foliage004_1K-PNG/Foliage004_1K-PNG_Opacity.png',
        normalMap: '/textures/ground/Foliage004_1K-PNG/Foliage004_1K-PNG_NormalGL.png',
    });

    useEffect(() => {
        if (!meshRef.current) return;
        features.forEach((f, i) => {
            temp.position.set(f.x, f.scale * 0.4, f.z);
            temp.rotation.set(0, f.rotY, 0);
            temp.scale.set(f.scale * 0.8, f.scale * 0.8, f.scale * 0.8);
            temp.updateMatrix();
            meshRef.current!.setMatrixAt(i, temp.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
        meshRef.current.count = features.length;
    }, [features]);

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, 2000]} castShadow>
            <planeGeometry args={[1, 1]} />
            <meshStandardMaterial 
                {...foliage}
                transparent={true}
                alphaTest={0.5}
                side={THREE.DoubleSide}
            />
        </instancedMesh>
    );
}

// ── Main Controller ──

export function ProceduralLandscape({ myPosRef }: { myPosRef: { current: { x: number; y: number } } }) {
    const [chunkCoords, setChunkCoords] = useState<{cx: number, cz: number}[]>(() => {
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

        if (lastChunk.current.cx !== cx || lastChunk.current.cz !== cz) {
            lastChunk.current = { cx, cz };
            const newChunks = [];
            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    newChunks.push({ cx: cx + dx, cz: cz + dz });
                }
            }
            setChunkCoords(newChunks);
        }
    });

    const allFeatures = useMemo(() => {
        return chunkCoords.flatMap(c => {
            const seed = getChunkSeed(c.cx, c.cz, 42);
            return generateFeatures(c.cx, c.cz, seed);
        });
    }, [chunkCoords]);

    const trees = useMemo(() => allFeatures.filter(f => f.type === 'tree'), [allFeatures]);
    const rocks = useMemo(() => allFeatures.filter(f => f.type === 'rock'), [allFeatures]);
    const grass = useMemo(() => allFeatures.filter(f => f.type === 'grass'), [allFeatures]);
    const mountains = useMemo(() => allFeatures.filter(f => f.type === 'mountain'), [allFeatures]);
    const caves = useMemo(() => allFeatures.filter(f => f.type === 'cave'), [allFeatures]);
    const mushrooms = useMemo(() => allFeatures.filter(f => f.type === 'glow_mushroom'), [allFeatures]);

    return (
        <group>
            {mountains.map((f, i) => <Mountain key={`m-${i}`} f={f} />)}
            {caves.map((f, i) => <Cave key={`c-${i}`} f={f} />)}
            {mushrooms.map((f, i) => <GlowMushroom key={`sh-${i}`} f={f} />)}

            <InstancedTrees features={trees} />
            <InstancedRocks features={rocks} />
            <InstancedGrass features={grass} />
        </group>
    );
}
