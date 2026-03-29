'use client';
import React, { useRef, useEffect, useState, useCallback } from 'react';

interface TouchControlsProps {
    keysRef: React.RefObject<Set<string>>;
    onJump: () => void;
}

export function TouchControls({ keysRef, onJump }: TouchControlsProps) {
    const [isMobile, setIsMobile] = useState(false);
    const joystickBaseRef = useRef<HTMLDivElement>(null);
    const knobRef = useRef<HTMLDivElement>(null);
    const touchIdRef = useRef<number | null>(null);
    const centerRef = useRef({ x: 0, y: 0 });
    const activeKeysRef = useRef<string[]>([]);

    // Detect mobile only on client
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 900 || navigator.maxTouchPoints > 0);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const clearMovementKeys = useCallback(() => {
        ['w','s','a','d'].forEach(k => keysRef.current?.delete(k));
        activeKeysRef.current = [];
    }, [keysRef]);

    const setKey = useCallback((key: string) => {
        keysRef.current?.add(key);
        if (!activeKeysRef.current.includes(key)) activeKeysRef.current.push(key);
    }, [keysRef]);

    // Attach to window to bypass Canvas event blocking
    useEffect(() => {
        if (!isMobile) return;

        const onTouchStart = (e: TouchEvent) => {
            const base = joystickBaseRef.current;
            if (!base || touchIdRef.current !== null) return;
            const rect = base.getBoundingClientRect();
            const touch = e.changedTouches[0];
            if (
                touch.clientX < rect.left || touch.clientX > rect.right ||
                touch.clientY < rect.top  || touch.clientY > rect.bottom
            ) return;

            e.preventDefault();
            touchIdRef.current = touch.identifier;
            centerRef.current = {
                x: rect.left + rect.width / 2,
                y: rect.top  + rect.height / 2,
            };
        };

        const onTouchMove = (e: TouchEvent) => {
            if (touchIdRef.current === null) return;
            const touch = Array.from(e.changedTouches).find(t => t.identifier === touchIdRef.current);
            if (!touch || !knobRef.current) return;
            e.preventDefault();

            const dx = touch.clientX - centerRef.current.x;
            const dy = touch.clientY - centerRef.current.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxR = 38;
            const clamped = Math.min(dist, maxR);
            const angle = Math.atan2(dy, dx);

            knobRef.current.style.transform = 
                `translate(${Math.cos(angle)*clamped}px, ${Math.sin(angle)*clamped}px)`;

            clearMovementKeys();
            if (dist > 12) {
                const nx = dx / dist, ny = dy / dist;
                if (ny < -0.35) setKey('w');
                if (ny >  0.35) setKey('s');
                if (nx < -0.35) setKey('a');
                if (nx >  0.35) setKey('d');
            }
        };

        const onTouchEnd = (e: TouchEvent) => {
            const touch = Array.from(e.changedTouches).find(t => t.identifier === touchIdRef.current);
            if (!touch) return;
            touchIdRef.current = null;
            if (knobRef.current) knobRef.current.style.transform = 'translate(0,0)';
            clearMovementKeys();
        };

        window.addEventListener('touchstart',  onTouchStart, { passive: false });
        window.addEventListener('touchmove',   onTouchMove,  { passive: false });
        window.addEventListener('touchend',    onTouchEnd,   { passive: false });
        window.addEventListener('touchcancel', onTouchEnd,   { passive: false });

        return () => {
            window.removeEventListener('touchstart',  onTouchStart);
            window.removeEventListener('touchmove',   onTouchMove);
            window.removeEventListener('touchend',    onTouchEnd);
            window.removeEventListener('touchcancel', onTouchEnd);
        };
    }, [isMobile, clearMovementKeys, setKey]);

    if (!isMobile) return null;

    return (
        <div
            style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
                padding: '0 32px 32px',
                zIndex: 9999,
                pointerEvents: 'none',
            }}
        >
            {/* Joystick */}
            <div
                ref={joystickBaseRef}
                style={{
                    pointerEvents: 'auto',
                    width: 100, height: 100,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.08)',
                    border: '2px solid rgba(255,255,255,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(6px)',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                }}
            >
                <div
                    ref={knobRef}
                    style={{
                        width: 42, height: 42,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.45)',
                        border: '2px solid rgba(255,255,255,0.7)',
                        transition: 'transform 0.04s linear',
                        willChange: 'transform',
                    }}
                />
            </div>

            {/* Botones derecha */}
            <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button
                    onTouchStart={(e) => { e.preventDefault(); onJump(); }}
                    style={{
                        width: 64, height: 64, borderRadius: '50%',
                        background: 'rgba(0,229,255,0.15)',
                        border: '2px solid #00e5ff',
                        color: '#00e5ff', fontSize: 26,
                        backdropFilter: 'blur(6px)',
                        userSelect: 'none',
                    }}
                >↑</button>
                <button
                    onTouchStart={(e) => { e.preventDefault(); keysRef.current?.add('shift'); }}
                    onTouchEnd={(e) => { e.preventDefault(); keysRef.current?.delete('shift'); }}
                    style={{
                        width: 64, height: 64, borderRadius: '50%',
                        background: 'rgba(255,200,0,0.15)',
                        border: '2px solid #ffcc00',
                        color: '#ffcc00', fontSize: 10, fontWeight: 800,
                        backdropFilter: 'blur(6px)',
                        userSelect: 'none',
                    }}
                >SPRINT</button>
            </div>
        </div>
    );
}
