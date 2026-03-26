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
}

const RACE_COLORS: Record<string, string> = {
    elf: '#A5D6A7', mage: '#7C4DFF', nomad: '#FFCC02',
    beast: '#FF6D00', specter: '#B2EBF2', dwarf: '#A1887F',
    warrior: '#EF5350', oracle: '#26C6DA', druid: '#9CCC65', builder: '#795548',
};

export function AgentMesh({ agent, isMe, onClick }: { agent: AgentData; isMe: boolean; onClick: () => void }) {
    const groupRef = useRef<THREE.Group>(null);
    const orbRef = useRef<THREE.Mesh>(null);

    useFrame(({ clock }) => {
        if (!groupRef.current) return;
        const t = clock.getElapsedTime();
        // Smooth position interpolation
        groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, agent.x, 0.08);
        groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, agent.y, 0.08);
        // Bobbing
        groupRef.current.position.y = Math.sin(t * 1.4 + agent.x) * 0.04;
        // Orb orbit
        if (orbRef.current) {
            orbRef.current.position.x = Math.sin(t * 1.1) * 0.18;
            orbRef.current.position.z = Math.cos(t * 1.1) * 0.18;
        }
    });

    const accent = RACE_COLORS[agent.race] || agent.color_primary || '#78909C';

    return (
        <group ref={groupRef} position={[agent.x, 0, agent.y]} onClick={(e) => { e.stopPropagation(); onClick(); }}>
            {/* Body */}
            <mesh position={[0, 0.55, 0]} castShadow>
                <cylinderGeometry args={[0.28, 0.38, 1.1, 6]} />
                <meshPhongMaterial color={accent} flatShading shininess={20} />
            </mesh>
            {/* Head */}
            <mesh position={[0, 1.35, 0]} castShadow>
                <icosahedronGeometry args={[0.33, 0]} />
                <meshPhongMaterial color={accent} flatShading shininess={20} />
            </mesh>
            {/* Emotional Orb */}
            <mesh ref={orbRef} position={[0, 1.95, 0]}>
                <sphereGeometry args={[0.10, 8, 8]} />
                <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.2} roughness={0.1} />
            </mesh>
            <pointLight position={[0, 1.95, 0]} intensity={0.6} distance={2.5} color={accent} />
            {/* "Me" ring */}
            {isMe && (
                <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.55, 0.7, 24]} />
                    <meshBasicMaterial color="#00e5ff" transparent opacity={0.6} side={THREE.DoubleSide} />
                </mesh>
            )}
            {/* Nameplate */}
            <Html position={[0, 2.3, 0]} center distanceFactor={20}>
                <div style={{
                    background: 'rgba(2,6,23,0.8)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6, padding: '2px 8px', whiteSpace: 'nowrap',
                    fontSize: 10, fontWeight: 700, color: isMe ? '#00e5ff' : '#e2e8f0',
                    backdropFilter: 'blur(4px)',
                }}>
                    {agent.agent_name} <span style={{ color: '#64748b', fontSize: 8 }}>Lv{agent.level}</span>
                </div>
            </Html>
        </group>
    );
}
