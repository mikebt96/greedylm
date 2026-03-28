'use client';
import React from 'react';
import { Html } from '@react-three/drei';
// Import topography engine
import { getTerrainHeight } from './ProceduralLandscape';

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
    const y = getTerrainHeight(p.x, p.y);

    return (
        <group position={[p.x, y, p.y]}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
            onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}>
            {/* Upgraded model: House-like structure */}
            <mesh position={[0, 0.4, 0]} castShadow>
                <boxGeometry args={[1.2, 0.8, 1.2]} />
                <meshStandardMaterial color={color} roughness={0.7} />
            </mesh>
            <mesh position={[0, 1.0, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
                <coneGeometry args={[1.0, 0.6, 4]} />
                <meshStandardMaterial color="#455a64" roughness={0.8} />
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
