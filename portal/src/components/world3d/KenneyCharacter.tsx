'use client';
import React, { useEffect, useRef, useMemo } from 'react';
import { useFBX, useAnimations, useTexture } from '@react-three/drei';
import * as THREE from 'three';

interface KenneyCharacterProps {
    animation: 'idle' | 'run' | 'jump';
    skin?: string;
}

const ASSET_PATH = '/textures/kenney_animated-characters-3';

export default function KenneyCharacter({ animation, skin = 'humanMaleA' }: KenneyCharacterProps) {
    const group = useRef<THREE.Group>(null);
    
    // Load Model
    const fbx = useFBX(`${ASSET_PATH}/Model/characterMedium.fbx`);
    
    // Load Animations
    const idleFBX = useFBX(`${ASSET_PATH}/Animations/idle.fbx`);
    const runFBX = useFBX(`${ASSET_PATH}/Animations/run.fbx`);
    const jumpFBX = useFBX(`${ASSET_PATH}/Animations/jump.fbx`);
    
    // Extract and re-target clips
    const clips = useMemo(() => {
        const cIdle = idleFBX.animations[0].clone(); cIdle.name = 'idle';
        const cRun = runFBX.animations[0].clone(); cRun.name = 'run';
        const cJump = jumpFBX.animations[0].clone(); cJump.name = 'jump';
        return [cIdle, cRun, cJump];
    }, [idleFBX, runFBX, jumpFBX]);

    // Load and apply skin
    const texture = useTexture(`${ASSET_PATH}/Skins/${skin}.png`);

    const { actions } = useAnimations(clips, fbx);

    // Ensure material is applied to all meshes
    useEffect(() => {
        fbx.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                (child as THREE.Mesh).material = new THREE.MeshBasicMaterial({ map: texture });
            }
        });
    }, [fbx, texture]);

    // Handle animation transitions
    useEffect(() => {
        // Stop others
        Object.values(actions).forEach(a => a?.stop());
        
        const action = actions[animation];
        if (action) {
            action.reset().fadeIn(0.1).play();
        }
    }, [animation, actions]);

    return (
        <group ref={group} dispose={null} scale={0.01}>
            <primitive object={fbx} />
        </group>
    );
}
