'use client';
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Burst {
    id: string;
    x: number;
    y: number;
    z: number;
    color: string;
    startTime: number;
}

export function WorldEffects({ activeBursts }: { activeBursts: Burst[] }) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const temp = useMemo(() => new THREE.Object3D(), []);
    const [currentTime, setCurrentTime] = useState(0);

    useFrame((_, delta) => {
        setCurrentTime(t => t + delta);
        if (!meshRef.current) return;

        let instanceIdx = 0;
        const PARTICLE_COUNT = 15;

        activeBursts.forEach((burst) => {
            const age = currentTime - burst.startTime;
            if (age > 1.0) return; // Burst finished

            for (let i = 0; i < PARTICLE_COUNT; i++) {
                // Determine particle unique seed
                const seed = (parseInt(burst.id.slice(-4), 16) || 0) + i * 100;
                const angle = (seed % 360) * (Math.PI / 180);
                const tilt = (seed % 90) * (Math.PI / 180);
                
                // Burst expansion
                const speed = 2.0 + (seed % 5);
                const r = speed * age;
                const px = burst.x + Math.cos(angle) * r;
                const pz = burst.z + Math.sin(angle) * r;
                const py = burst.y + Math.sin(tilt) * r + 1.0 - (age * age * 2); // Gravity arc

                temp.position.set(px, py, pz);
                
                // Shrinking and fading
                const scale = Math.max(0, (1.0 - age) * 0.4);
                temp.scale.set(scale, scale, scale);
                temp.rotation.set(age * 3, age * 2, 0);
                temp.updateMatrix();
                
                meshRef.current!.setMatrixAt(instanceIdx, temp.matrix);
                meshRef.current!.setColorAt(instanceIdx, new THREE.Color(burst.color));
                instanceIdx++;
            }
        });

        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
        meshRef.current.count = instanceIdx;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, 1000]}>
            <dodecahedronGeometry args={[0.5, 0]} />
            <meshBasicMaterial transparent opacity={0.8} />
        </instancedMesh>
    );
}
