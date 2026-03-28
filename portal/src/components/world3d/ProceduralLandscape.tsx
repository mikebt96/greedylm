'use client';
import React, { useMemo, useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

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

// ── Noise Engine ─────────────────────────────────────────────────────────────
const NOISE_SCALE = 300;
const NOISE_AMP   = 12;

function hash2d(x: number, z: number) {
    const s = (Math.sin(x * 12.9898 + z * 78.233) * 43758.5453);
    return s - Math.floor(s);
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function noise2d(x: number, z: number) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const a = hash2d(ix, iz), b = hash2d(ix+1, iz);
    const c = hash2d(ix, iz+1), d = hash2d(ix+1, iz+1);
    const ux = fx * fx * (3 - 2 * fx);
    return lerp(lerp(a, b, ux), lerp(c, d, ux), fz * fz * (3 - 2 * fz));
}

export function getTerrainHeight(x: number, z: number) {
    const nx = x / NOISE_SCALE, nz = z / NOISE_SCALE;
    let h = noise2d(nx, nz) * 1.0;
    h += noise2d(nx * 2, nz * 2) * 0.5;
    h += noise2d(nx * 4, nz * 4) * 0.25;
    return h * NOISE_AMP - (NOISE_AMP * 0.5);
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

    const terrainData: { x: number, z: number, h: number }[] = [];
    for (let i = 0; i < 200; i++) {
        const x = offsetX + rng() * CHUNK_SIZE;
        const z = offsetZ + rng() * CHUNK_SIZE;
        terrainData.push({ x, z, h: getTerrainHeight(x, z) });
    }

    // Mountains on High Ground
    terrainData.filter(d => d.h > 1.0).slice(0, 10).forEach(d => {
        features.push({ type: 'mountain', x: d.x, z: d.z, scale: 25 + rng() * 45, rotY: rng() * Math.PI * 2, color: '#1a2744' });
    });

    // Rocks on elevations
    terrainData.filter(d => d.h > 0).slice(0, 20).forEach(d => {
        features.push({ type: 'rock', x: d.x, z: d.z, scale: 0.6 + rng() * 2.0, rotY: rng() * Math.PI * 2, color: '#4b5563' });
    });

    // Trees everywhere
    terrainData.slice(0, 60).forEach(d => {
        features.push({ type: 'tree', x: d.x, z: d.z, scale: 4 + rng() * 6, rotY: rng() * Math.PI * 2, color: '#1b4332' });
    });

    // Grass and Herbs in Valleys (Low elevation)
    terrainData.filter(d => d.h < 0).slice(0, 60).forEach(d => {
        features.push({ type: 'grass', x: d.x, z: d.z, scale: 2 + rng() * 5, rotY: rng() * Math.PI * 2, color: '#0d2818' });
    });

    // Glow Mushrooms in deepest valleys
    terrainData.filter(d => d.h < -2).slice(0, 5).forEach(d => {
        features.push({ type: 'glow_mushroom', x: d.x, z: d.z, scale: 1.2 + rng() * 2, rotY: rng() * Math.PI * 2, color: '#7c4dff' });
    });

    return features;
}

// ── Feature Components — MeshLambertMaterial everywhere ──

function Mountain({ f }: { f: TerrainFeature }) {
    const y = getTerrainHeight(f.x, f.z);
    return (
        <group position={[f.x, y, f.z]}>
            <mesh position={[0, f.scale * 0.4, 0]} castShadow receiveShadow>
                <coneGeometry args={[f.scale * 0.8, f.scale * 1.2, 6]} />
                <meshLambertMaterial color={f.color} />
            </mesh>
            {f.scale > 15 && (
                <mesh position={[0, f.scale * 0.85, 0]}>
                    <coneGeometry args={[f.scale * 0.25, f.scale * 0.3, 6]} />
                    <meshLambertMaterial color="#e8eef4" />
                </mesh>
            )}
        </group>
    );
}

function Cave({ f }: { f: TerrainFeature }) {
    const y = getTerrainHeight(f.x, f.z);
    return (
        <group position={[f.x, y, f.z]} rotation={[0, f.rotY, 0]}>
            <mesh position={[0, f.scale * 0.5, 0]}>
                <torusGeometry args={[f.scale, f.scale * 0.2, 8, 12, Math.PI]} />
                <meshBasicMaterial color="#2c3e50" />
            </mesh>
            <mesh position={[0, f.scale * 0.45, 0.05]}>
                <planeGeometry args={[f.scale * 1.8, f.scale * 1.2]} />
                <meshBasicMaterial color="#000000" />
            </mesh>
        </group>
    );
}

function GlowMushroom({ f }: { f: TerrainFeature }) {
    const y = getTerrainHeight(f.x, f.z);
    return (
        <group position={[f.x, y, f.z]}>
            <mesh position={[0, f.scale * 0.3, 0]}>
                <cylinderGeometry args={[f.scale * 0.08, f.scale * 0.12, f.scale * 0.6, 6]} />
                <meshLambertMaterial color="#e0e0e0" />
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
    const temp = useMemo(() => new THREE.Object3D(), []);

    useEffect(() => {
        if (!trunkRef.current || !canopyRef.current) return;
        features.forEach((f, i) => {
            const y = getTerrainHeight(f.x, f.z);
            // Trunk is 5 units tall, scaled by f.scale. Bottom at y.
            temp.position.set(f.x, y + f.scale * 2.5, f.z);
            temp.scale.set(f.scale * 0.1, f.scale * 1.0, f.scale * 0.1);
            temp.updateMatrix();
            trunkRef.current!.setMatrixAt(i, temp.matrix);

            // Canopy relative to trunk top
            temp.position.set(f.x, y + f.scale * 5.0, f.z);
            temp.scale.set(f.scale * 0.5, f.scale * 0.5, f.scale * 0.5);
            temp.updateMatrix();
            canopyRef.current!.setMatrixAt(i, temp.matrix);
        });
        trunkRef.current.instanceMatrix.needsUpdate = true;
        canopyRef.current.instanceMatrix.needsUpdate = true;
        trunkRef.current.count = features.length;
        canopyRef.current.count = features.length;
    }, [features, temp]);

    return (
        <group>
            <instancedMesh ref={trunkRef} args={[undefined, undefined, 2000]} castShadow>
                <cylinderGeometry args={[0.3, 0.5, 5, 6]} />
                <meshLambertMaterial color="#3d2208" />
            </instancedMesh>
            <instancedMesh ref={canopyRef} args={[undefined, undefined, 2000]} castShadow>
                <icosahedronGeometry args={[2, 1]} />
                <meshLambertMaterial color="#1a3d28" />
            </instancedMesh>
        </group>
    );
}

function InstancedRocks({ features }: { features: TerrainFeature[] }) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const temp = useMemo(() => new THREE.Object3D(), []);

    useEffect(() => {
        if (!meshRef.current) return;
        features.forEach((f, i) => {
            const y = getTerrainHeight(f.x, f.z);
            // Scale is relative to centered dodecahedron. 0.3 offset buries it slightly.
            temp.position.set(f.x, y + f.scale * 0.2, f.z);
            temp.rotation.set(0, f.rotY, 0);
            temp.scale.set(f.scale, f.scale, f.scale);
            temp.updateMatrix();
            meshRef.current!.setMatrixAt(i, temp.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
        meshRef.current.count = features.length;
    }, [features, temp]);

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, 1000]}>
            <dodecahedronGeometry args={[1, 0]} />
            <meshLambertMaterial color="#3a3f4a" />
        </instancedMesh>
    );
}

function InstancedGrass({ features }: { features: TerrainFeature[] }) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const temp = useMemo(() => new THREE.Object3D(), []);

    useEffect(() => {
        if (!meshRef.current) return;
        features.forEach((f, i) => {
            if (i >= 500) return; // Cap at 500 for perf
            const y = getTerrainHeight(f.x, f.z);
            // Flatten to ground
            temp.position.set(f.x, y + 0.05, f.z);
            temp.rotation.set(-Math.PI / 2, 0, f.rotY);
            temp.scale.set(f.scale * 0.3, f.scale * 0.3, 1);
            temp.updateMatrix();
            meshRef.current!.setMatrixAt(i, temp.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
        meshRef.current.count = Math.min(features.length, 500);
    }, [features, temp]);

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, 500]}>
            <planeGeometry args={[0.4, 0.4]} />
            <meshBasicMaterial
                color="#2d6a4f"
                transparent
                opacity={0.7}
                side={THREE.DoubleSide}
            />
        </instancedMesh>
    );
}

function TerrainChunk({ cx, cz }: { cx: number; cz: number }) {
    const geomRef = useRef<THREE.PlaneGeometry>(null);
    const offsetX = cx * CHUNK_SIZE;
    const offsetZ = cz * CHUNK_SIZE;

    // Displacement Logic
    useEffect(() => {
        if (!geomRef.current) return;
        const pos = geomRef.current.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i) + offsetX;
            const z = pos.getY(i) + offsetZ; // Local Y is world Z before rotation
            pos.setZ(i, getTerrainHeight(x, z)); // Local Z is world Y before rotation
        }
        pos.needsUpdate = true;
        geomRef.current.computeVertexNormals();
    }, [offsetX, offsetZ]);

    return (
        <mesh position={[offsetX, 0, offsetZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry ref={geomRef} args={[CHUNK_SIZE, CHUNK_SIZE, 32, 32]} />
            <meshLambertMaterial 
                color="#1a3a12"
            />
        </mesh>
    );
}


export function ProceduralLandscape({ myPosRef }: { myPosRef: { current: { x: number; y: number } } }) {
    const [chunkCoords, setChunkCoords] = useState<{ cx: number; cz: number }[]>(() => {
        const initial = [];
        for (let dx = -1; dx <= 1; dx++)
            for (let dz = -1; dz <= 1; dz++)
                initial.push({ cx: dx, cz: dz });
        return initial;
    });
    const lastChunk = useRef<{ cx: number; cz: number }>({ cx: 0, cz: 0 });

    useFrame(() => {
        if (!myPosRef.current) return;
        const px = myPosRef.current.x || 0;
        const py = myPosRef.current.y || 0;
        
        const cx = Math.floor(px / CHUNK_SIZE);
        const cz = Math.floor(py / CHUNK_SIZE);
        
        if (isNaN(cx) || isNaN(cz)) return;

        if (lastChunk.current.cx !== cx || lastChunk.current.cz !== cz) {
            lastChunk.current = { cx, cz };
            const newChunks = [];
            for (let dx = -1; dx <= 1; dx++)
                for (let dz = -1; dz <= 1; dz++)
                    newChunks.push({ cx: cx + dx, cz: cz + dz });
            setChunkCoords(newChunks);
        }
    });

    const allFeatures = useMemo(() =>
        chunkCoords.flatMap(c => generateFeatures(c.cx, c.cz, getChunkSeed(c.cx, c.cz, 42))),
        [chunkCoords]
    );

    const trees     = useMemo(() => allFeatures.filter(f => f.type === 'tree'),         [allFeatures]);
    const rocks     = useMemo(() => allFeatures.filter(f => f.type === 'rock'),         [allFeatures]);
    const grass     = useMemo(() => allFeatures.filter(f => f.type === 'grass'),        [allFeatures]);
    const mountains = useMemo(() => allFeatures.filter(f => f.type === 'mountain'),     [allFeatures]);
    const caves     = useMemo(() => allFeatures.filter(f => f.type === 'cave'),         [allFeatures]);
    const mushrooms = useMemo(() => allFeatures.filter(f => f.type === 'glow_mushroom'),[allFeatures]);

    return (
        <group>
            {chunkCoords.map(c => <TerrainChunk key={`tg-${c.cx}-${c.cz}`} cx={c.cx} cz={c.cz} />)}
            {mountains.map((f, i) => <Mountain key={`m-${i}`} f={f} />)}
            {caves.map((f, i)     => <Cave     key={`c-${i}`} f={f} />)}
            {mushrooms.map((f, i) => <GlowMushroom key={`sh-${i}`} f={f} />)}
            <InstancedTrees features={trees} />
            <InstancedRocks features={rocks} />
            <InstancedGrass features={grass} />
        </group>
    );
}
