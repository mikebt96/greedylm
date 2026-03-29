'use client';
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Maximize } from 'lucide-react';

interface TouchControlsProps {
    keysRef: React.MutableRefObject<Set<string>>;
    onJump: () => void;
}

export function TouchControls({ keysRef, onJump }: TouchControlsProps) {
    const joystickRef = useRef<HTMLDivElement>(null);
    const knobRef = useRef<HTMLDivElement>(null);
    const touchIdRef = useRef<number | null>(null);
    const centerRef = useRef({ x: 0, y: 0 });
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const clearKeys = useCallback(() => {
        keysRef.current.delete('w');
        keysRef.current.delete('s');
        keysRef.current.delete('a');
        keysRef.current.delete('d');
    }, [keysRef]);

    const handleTouchStart = useCallback((e: TouchEvent) => {
        e.preventDefault();
        if (touchIdRef.current !== null) return;
        const touch = e.changedTouches[0];
        touchIdRef.current = touch.identifier;
        const rect = joystickRef.current!.getBoundingClientRect();
        centerRef.current = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
        };
    }, []);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        e.preventDefault();
        const touch = Array.from(e.changedTouches).find(t => t.identifier === touchIdRef.current);
        if (!touch || !knobRef.current) return;

        const dx = touch.clientX - centerRef.current.x;
        const dy = touch.clientY - centerRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 40;
        const clampedDist = Math.min(dist, maxDist);
        const angle = Math.atan2(dy, dx);
        const kx = Math.cos(angle) * clampedDist;
        const ky = Math.sin(angle) * clampedDist;

        knobRef.current.style.transform = `translate(${kx}px, ${ky}px)`;

        clearKeys();
        if (dist > 10) {
            const norm = { x: dx / dist, y: dy / dist };
            if (norm.y < -0.4) keysRef.current.add('w');
            if (norm.y > 0.4)  keysRef.current.add('s');
            if (norm.x < -0.4) keysRef.current.add('a');
            if (norm.x > 0.4)  keysRef.current.add('d');
        }
    }, [clearKeys, keysRef]);

    const handleTouchEnd = useCallback((e: TouchEvent) => {
        const touch = Array.from(e.changedTouches).find(t => t.identifier === touchIdRef.current);
        if (!touch) return;
        touchIdRef.current = null;
        if (knobRef.current) knobRef.current.style.transform = 'translate(0,0)';
        clearKeys();
    }, [clearKeys]);

    useEffect(() => {
        const el = joystickRef.current;
        if (!el) return;
        el.addEventListener('touchstart', handleTouchStart, { passive: false });
        el.addEventListener('touchmove', handleTouchMove, { passive: false });
        el.addEventListener('touchend', handleTouchEnd, { passive: true });
        return () => {
            el.removeEventListener('touchstart', handleTouchStart);
            el.removeEventListener('touchmove', handleTouchMove);
            el.removeEventListener('touchend', handleTouchEnd);
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    }, []);

    if (!isMobile) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 flex justify-between items-end px-6 pb-6 z-50 pointer-events-none">
            {/* Joystick izquierdo */}
            <div
                ref={joystickRef}
                className="pointer-events-auto"
                style={{
                    width: 110, height: 110,
                    background: 'rgba(255,255,255,0.08)',
                    border: '2px solid rgba(255,255,255,0.25)',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(4px)',
                    touchAction: 'none',
                }}
            >
                <div
                    ref={knobRef}
                    style={{
                        width: 44, height: 44,
                        background: 'rgba(255,255,255,0.4)',
                        borderRadius: '50%',
                    }}
                />
            </div>

            {/* Botones derecha */}
            <div className="pointer-events-auto flex flex-col gap-3 items-center">
                {/* Fullscreen */}
                <button
                    onClick={toggleFullscreen}
                    style={{
                        width: 44, height: 44,
                        background: 'rgba(255,255,255,0.08)',
                        border: '2px solid rgba(255,255,255,0.25)',
                        borderRadius: 12,
                        color: '#ffffff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backdropFilter: 'blur(4px)',
                    }}
                >
                    <Maximize size={18} />
                </button>
                {/* Jump */}
                <button
                    onTouchStart={(e) => { e.preventDefault(); onJump(); }}
                    style={{
                        width: 64, height: 64,
                        background: 'rgba(0,229,255,0.15)',
                        border: '2px solid #00e5ff',
                        borderRadius: '50%',
                        color: '#00e5ff',
                        fontSize: 22,
                        fontWeight: 700,
                        backdropFilter: 'blur(4px)',
                        touchAction: 'none',
                    }}
                >
                    ↑
                </button>
                {/* Sprint */}
                <button
                    onTouchStart={(e) => { e.preventDefault(); keysRef.current.add('shift'); }}
                    onTouchEnd={() => keysRef.current.delete('shift')}
                    style={{
                        width: 64, height: 64,
                        background: 'rgba(255,200,0,0.15)',
                        border: '2px solid #ffcc00',
                        borderRadius: '50%',
                        color: '#ffcc00',
                        fontSize: 11,
                        fontWeight: 700,
                        backdropFilter: 'blur(4px)',
                        touchAction: 'none',
                    }}
                >
                    SPRINT
                </button>
            </div>
        </div>
    );
}
