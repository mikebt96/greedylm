'use client';
import React from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface ConstructionData {
    id: string;
    type: string;
    position: { x: number; y: number; z: number };
    owner: string;
    name?: string;
}

const TYPE_COLORS: Record<string, string> = {
    house:    '#5c6bc0',
    tower:    '#7e57c2',
    wall:     '#78909c',
    workshop: '#ff8a65',
    shrine:   '#4dd0e1',
};

const ROOF_COLORS: Record<string, string> = {
    house:    '#37474f',
    tower:    '#4a148c',
    wall:     '#546e7a',
    workshop: '#bf360c',
    shrine:   '#006064',
};

export function ConstructionMesh({ construction }: { construction: ConstructionData }) {
    const color     = TYPE_COLORS[construction.type] || '#607d8b';
    const roofColor = ROOF_COLORS[construction.type] || '#455a64';
    const p = construction.position;

    return (
        <group position={[p.x, 0, p.y]}>
            {/* Base */}
            <mesh position={[0, 0.4, 0]}>
                <boxGeometry args={[1.2, 0.8, 1.2]} />
                <meshBasicMaterial color={color} />
            </mesh>
            {/* Roof */}
            <mesh position={[0, 1.0, 0]} rotation={[0, Math.PI / 4, 0]}>
                <coneGeometry args={[1.0, 0.6, 4]} />
                <meshBasicMaterial color={roofColor} />
            </mesh>
            {/* Door */}
            <mesh position={[0, 0.2, 0.61]}>
                <planeGeometry args={[0.25, 0.4]} />
                <meshBasicMaterial color="#1a1a2e" side={THREE.DoubleSide} />
            </mesh>

            <Html position={[0, 1.6, 0]} center distanceFactor={30}>
                <div style={{
                    background: 'rgba(2,6,23,0.8)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6, padding: '2px 8px',
                    fontSize: 10, color: '#94a3b8',
                    whiteSpace: 'nowrap', fontWeight: 600,
                    backdropFilter: 'blur(4px)',
                }}>
                    🏗️ {construction.name || construction.type}
                </div>
            </Html>
        </group>
    );
}
