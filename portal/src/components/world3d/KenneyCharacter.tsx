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
    
    // Extract and re-target clips with fallback
    const clips = useMemo(() => {
        const getClip = (fbxObj: any, name: string) => {
            if (!fbxObj || !fbxObj.animations || fbxObj.animations.length === 0) return null;
            const clip = fbxObj.animations[0].clone();
            clip.name = name;
            return clip;
        };
        const cIdle = getClip(idleFBX, 'idle');
        const cRun = getClip(runFBX, 'run') || cIdle; // Use idle as fallback to prevent T-pose
        const cJump = getClip(jumpFBX, 'jump') || cIdle;
        return [cIdle, cRun, cJump].filter(c => !!c) as THREE.AnimationClip[];
    }, [idleFBX, runFBX, jumpFBX]);

    // Load and apply skin
    const texture = useTexture(`${ASSET_PATH}/Skins/${skin}.png`);

    // Nuclear Animation Fix: Merge clips into the FBX object for reliable targeting
    useMemo(() => {
        if (!fbx) return;
        fbx.animations = clips;
    }, [fbx, clips]);

    const { actions } = useAnimations(fbx.animations, fbx);
    
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
        if (!actions) return;
        // Fade out all currently playing actions safely
        Object.values(actions).forEach(a => a?.fadeOut(0.2));
        
        const action = actions[animation];
        if (action) {
            action.reset().fadeIn(0.2).play();
        }
    }, [animation, actions]);

    return (
        <group ref={group} dispose={null} scale={0.01}>
            <primitive object={fbx} />
        </group>
    );
}
