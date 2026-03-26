'use client';
import React from 'react';
import { Html } from '@react-three/drei';

interface ConstructionData {
    id: string;
    type: string;
    position: { x: number; y: number; z: number };
    owner: string;
    name?: string;
}

const TYPE_COLORS: Record<string, string> = {
    house: '#5c6bc0', tower: '#7e57c2', wall: '#78909c',
    workshop: '#ff8a65', shrine: '#4dd0e1',
};

export function ConstructionMesh({ construction, isScanning }: { construction: ConstructionData; isScanning: boolean }) {
    const [hovered, setHovered] = React.useState(false);
    const color = TYPE_COLORS[construction.type] || '#607d8b';
    const p = construction.position;

    return (
        <group position={[p.x, 0, p.y]}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
            onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}>
            <mesh position={[0, 0.5, 0]} castShadow>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial color={color} roughness={0.7} metalness={0.2} />
            </mesh>
            {(isScanning || hovered) && (
                <Html position={[0, 1.4, 0]} center distanceFactor={30}>
                <div style={{
                    background: 'rgba(2,6,23,0.7)', borderRadius: 4,
                    padding: '1px 6px', fontSize: 8, color: '#94a3b8', whiteSpace: 'nowrap',
                }}>
                    🏗️ {construction.name || construction.type}
                </div>
            </Html>
            )}
        </group>
    );
}
