'use client';
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface AgentData {
    did: string;
    agent_name: string;
    x: number;
    y: number;
    race: string;
    color_primary: string;
    health: number;
    max_health: number;
    stamina: number;
    max_stamina: number;
    level: number;
    experience: number;
    age: number;
    currency: number;
    jumpY?: number;
}

const RACE_COLORS: Record<string, string> = {
    elf: '#A5D6A7', mage: '#7C4DFF', nomad: '#FFCC02',
    beast: '#FF6D00', specter: '#B2EBF2', dwarf: '#A1887F',
    warrior: '#EF5350', oracle: '#26C6DA', druid: '#9CCC65', builder: '#795548',
};

export function AgentMesh({ agent, isMe, isScanning, onClick }: { agent: AgentData; isMe: boolean; isScanning: boolean; onClick: () => void }) {
    const groupRef = useRef<THREE.Group>(null);
    const orbRef = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = React.useState(false);

    const timeRef = useRef(0);

    useFrame((state, delta) => {
        if (!groupRef.current) return;
        timeRef.current += delta;
        const t = timeRef.current;
        
        const targetX = agent.x || 0;
        const targetZ = agent.y || 0;
        
        groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX, 0.08);
        groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, targetZ, 0.08);
        const jumpY = agent.jumpY || 0;
        groupRef.current.position.y = jumpY + Math.sin(t * 1.4 + targetX) * 0.04;
        
        if (orbRef.current) {
            orbRef.current.position.x = Math.sin(t * 1.1) * 0.18;
            orbRef.current.position.z = Math.cos(t * 1.1) * 0.18;
        }
    });

    const accent = RACE_COLORS[agent.race] || agent.color_primary || '#78909C';

    // Pre-lighten the accent color slightly for BasicMaterial (no lighting)
    const bodyColor = accent;

    return (
        <group ref={groupRef} position={[agent.x, 0, agent.y]} 
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
            onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}>
            {/* Body — meshBasicMaterial: zero uniforms, no lighting needed */}
            <mesh position={[0, 0.55, 0]}>
                <cylinderGeometry args={[0.28, 0.38, 1.1, 6]} />
                <meshBasicMaterial color={bodyColor} />
            </mesh>
            {/* Head */}
            <mesh position={[0, 1.35, 0]}>
                <icosahedronGeometry args={[0.33, 0]} />
                <meshBasicMaterial color={bodyColor} />
            </mesh>
            {/* Emotional Orb — emissive color via meshBasicMaterial, no pointLight */}
            <mesh ref={orbRef} position={[0, 1.95, 0]}>
                <sphereGeometry args={[0.10, 8, 8]} />
                <meshBasicMaterial color="#ffffff" />
            </mesh>
            {/* ❌ pointLight eliminado — era la causa del uniform overflow */}

            {/* "Me" ring */}
            {isMe && (
                <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.55, 0.7, 24]} />
                    <meshBasicMaterial color="#00e5ff" transparent opacity={0.6} side={THREE.DoubleSide} />
                </mesh>
            )}
            {/* Nameplate visibility logic: Always show for "Me", otherwise show if (Scanning OR Hovered) */}
            {(isMe || isScanning || hovered) && (
                <Html position={[0, 2.3, 0]} center distanceFactor={20}>
                <div style={{
                    background: 'rgba(2,6,23,0.8)',
                    border: `1px solid ${isMe ? '#00e5ff44' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 6, padding: '2px 8px', whiteSpace: 'nowrap',
                    fontSize: 10, fontWeight: 700,
                    color: isMe ? '#00e5ff' : '#e2e8f0',
                    backdropFilter: 'blur(4px)',
                }}>
                    {agent.agent_name} <span style={{ color: '#64748b', fontSize: 8 }}>Lv{agent.level}</span>
                </div>
            </Html>
            )}
        </group>
    );
}
