"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Sky, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { WorldEngine } from '@/lib/three/WorldEngine';
import { TerrainGenerator } from '@/lib/three/TerrainGenerator';
import { AgentMesh } from '@/lib/three/AgentMesh';

const SceneContent = ({ onAgentSelect }: { onAgentSelect: (did: string) => void }) => {
    const { scene } = useThree();
    const engineRef = useRef<WorldEngine>(new WorldEngine());
    const terrainRef = useRef<TerrainGenerator>(new TerrainGenerator());
    const [agents] = useState<Record<string, AgentMesh>>({});

    useEffect(() => {
        // Initial setup
        // eslint-disable-next-line react-hooks/immutability
        scene.background = new THREE.Color(0x87ceeb);
        
        // Mock: Load initial chunks
        const chunkRes = terrainRef.current.generateChunk({ chunk_x: 0, chunk_y: 0, biome: 'forest' });
        scene.add(chunkRes);

        // Socket logic placeholder
        // socket.on('AGENT_MOVE', (data) => moveAgent(data.did, data.x, data.y));
    }, [scene]);

    useFrame(({ clock }) => {
        engineRef.current.update(clock.getElapsedTime() * 1000);
        
        // Update agents
        Object.values(agents).forEach(a => a.playAnimation('idle'));
    });

    return (
        <>
            <Sky sunPosition={[100, 20, 100]} />
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
            <ambientLight intensity={0.5} />
            <directionalLight position={[50, 100, 50]} castShadow intensity={1} />
        </>
    );
};

export const WorldCanvas = () => {
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

    return (
        <div className="w-full h-full relative bg-gray-900">
            <Canvas shadows gl={{ antialias: true }}>
                <PerspectiveCamera makeDefault position={[10, 10, 10]} fov={50} />
                <OrbitControls maxPolarAngle={Math.PI / 2.1} minDistance={5} maxDistance={100} />
                <SceneContent onAgentSelect={setSelectedAgent} />
            </Canvas>

            {/* HUD */}
            <div className="absolute top-4 left-4 p-4 bg-black/50 backdrop-blur-md rounded-2xl text-white border border-white/10 pointer-events-none">
                <h2 className="text-xl font-bold">GREEDYLM v8.0</h2>
                <div className="text-sm opacity-80">
                    <p>Coordenadas: 0, 0</p>
                    <p>Bioma: Bosque Ancestral</p>
                    <p>Hora: 12:00 PM</p>
                </div>
            </div>

            <div className="absolute top-4 right-4 flex gap-2">
                <button className="px-4 py-2 bg-blue-600/80 hover:bg-blue-600 text-white rounded-xl backdrop-blur-md transition-colors">
                    Vista Espectador
                </button>
            </div>

            {/* Side Panel */}
            {selectedAgent && (
                <div className="absolute right-0 top-0 h-full w-80 bg-gray-950/90 backdrop-blur-xl border-l border-white/10 p-6 text-white shadow-2xl animate-in slide-in-from-right">
                    <button onClick={() => setSelectedAgent(null)} className="absolute top-4 right-4 text-white/50 hover:text-white">✕</button>
                    <h3 className="text-2xl font-bold mb-2">Agente Info</h3>
                    <div className="space-y-4">
                        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                            <p className="text-sm opacity-60 uppercase tracking-wider font-bold">DID</p>
                            <p className="font-mono text-xs">{selectedAgent}</p>
                        </div>
                        <button className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-white/90 transition-all">
                            Descargar Alma
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
