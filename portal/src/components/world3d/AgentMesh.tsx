'use client';
import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
// Import animated character
import KenneyCharacter from './KenneyCharacter';

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

// Import topography engine
import { getTerrainHeight } from './ProceduralLandscape';

export function AgentMesh({ agent, isMe, isScanning, onClick }: { agent: AgentData; isMe: boolean; isScanning: boolean; onClick: () => void }) {
    const groupRef = useRef<THREE.Group>(null);
    const orbRef = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = React.useState(false);

    const timeRef = useRef(0);
    const [anim, setAnim] = React.useState<'idle' | 'run' | 'jump'>('idle');
    const lastPos = useRef({ x: agent.x, z: agent.y });
    // ← ref separado para el target de posicion para evitar conflicto R3F
    const targetRef = useRef({ x: agent.x, z: agent.y });

    // Actualizar target cuando cambien las props
    useEffect(() => {
        targetRef.current = { x: agent.x, z: agent.y };
    }, [agent.x, agent.y]);

    // Inicializar posición en mount
    useEffect(() => {
        if (groupRef.current) {
            groupRef.current.position.set(agent.x, getTerrainHeight(agent.x, agent.y), agent.y);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useFrame((state, delta) => {
        if (!groupRef.current) return;
        timeRef.current += delta;
        const t = timeRef.current;
        
        const targetX = targetRef.current.x;
        const targetZ = targetRef.current.z;
        const terrainH = getTerrainHeight(targetX, targetZ);
        
        if (isMe) {
            // Sin lerp — posición instantánea para el jugador propio para evitar lag
            groupRef.current.position.x = targetX;
            groupRef.current.position.z = targetZ;
        } else {
            const lerpFactor = 0.08;
            groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX, lerpFactor);
            groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, targetZ, lerpFactor);
        }

        const jumpY = agent.jumpY || 0;
        groupRef.current.position.y = terrainH + jumpY + Math.sin(t * 1.4 + targetX) * 0.04;

        // Animation State Logic
        const dx = targetX - lastPos.current.x;
        const dz = targetZ - lastPos.current.z;
        const speed = Math.sqrt(dx * dx + dz * dz) / delta;
        lastPos.current = { x: targetX, z: targetZ };

        if (jumpY > 0.1) {
            if (anim !== 'jump') setAnim('jump');
        } else if (speed > 0.1) {
            if (anim !== 'run') setAnim('run');
        } else {
            if (anim !== 'idle') setAnim('idle');
        }

        // Face movement direction
        if (speed > 0.1) {
            const angle = Math.atan2(dx, dz);
            groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, angle, 0.15);
        }
    });

    const accent = RACE_COLORS[agent.race] || agent.color_primary || '#78909C';

    const skinMap: Record<string, string> = {
        zombie: 'zombieMaleA',
        beast: 'zombieMaleA',
        specter: 'zombieFemaleA',
        elf: 'humanFemaleA',
        mage: 'humanFemaleA',
        oracle: 'humanFemaleA',
    };
    const skin = skinMap[agent.race] || 'humanMaleA';

    return (
        // ← Sin prop position para que useFrame tenga el control total
        <group ref={groupRef}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
            onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}>
            
            <group>
                {/* Torso */}
                <mesh position={[0, 0.9, 0]}>
                    <boxGeometry args={[0.5, 0.6, 0.25]} />
                    <meshLambertMaterial color={accent} />
                </mesh>
                {/* Cabeza */}
                <mesh position={[0, 1.45, 0]}>
                    <boxGeometry args={[0.35, 0.35, 0.35]} />
                    <meshLambertMaterial color={accent} />
                </mesh>
                {/* Pierna izq */}
                <mesh position={[-0.13, 0.3, 0]}>
                    <boxGeometry args={[0.18, 0.55, 0.2]} />
                    <meshLambertMaterial color={accent} />
                </mesh>
                {/* Pierna der */}
                <mesh position={[0.13, 0.3, 0]}>
                    <boxGeometry args={[0.18, 0.55, 0.2]} />
                    <meshLambertMaterial color={accent} />
                </mesh>
                {/* Brazo izq */}
                <mesh position={[-0.34, 0.9, 0]}>
                    <boxGeometry args={[0.16, 0.5, 0.18]} />
                    <meshLambertMaterial color={accent} />
                </mesh>
                {/* Brazo der */}
                <mesh position={[0.34, 0.9, 0]}>
                    <boxGeometry args={[0.16, 0.5, 0.18]} />
                    <meshLambertMaterial color={accent} />
                </mesh>
            </group>

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
