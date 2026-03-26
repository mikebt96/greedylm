'use client';
import React, { useState, useEffect } from 'react';
import { X, Keyboard, MousePointer2, Gamepad2, Eye } from 'lucide-react';

export interface Keybinds {
    forward: string;
    backward: string;
    left: string;
    right: string;
    jump: string;
    sprint: string;
    interact: string;
}

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    keybinds: Keybinds;
    onUpdateKeybinds: (newKeybinds: Keybinds) => void;
    isSpectator: boolean;
    onToggleSpectator: (val: boolean) => void;
}

export default function SettingsPanel({ 
    isOpen, 
    onClose, 
    keybinds, 
    onUpdateKeybinds,
    isSpectator,
    onToggleSpectator
}: SettingsPanelProps) {
    const [listeningForKey, setListeningForKey] = useState<keyof Keybinds | null>(null);

    if (!isOpen) return null;

    const handleKeyChange = (e: React.KeyboardEvent) => {
        if (!listeningForKey) return;
        e.preventDefault();
        const newKey = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
        onUpdateKeybinds({ ...keybinds, [listeningForKey]: newKey === ' ' ? ' ' : newKey });
        setListeningForKey(null);
    };

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div 
                className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl"
                onKeyDown={listeningForKey ? handleKeyChange : undefined}
                tabIndex={0}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-800 shadow-sm bg-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
                            <Keyboard className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-bold text-white tracking-tight">Configuración</h2>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-8 overflow-y-auto max-h-[70vh]">
                    {/* View Mode */}
                    <section className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-2">
                             <Eye className="w-3 h-3" /> Modo de Vista
                        </h3>
                        <div className="flex p-1 bg-slate-1000 border border-slate-800 rounded-2xl">
                            <button 
                                onClick={() => onToggleSpectator(false)}
                                className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${!isSpectator ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <MousePointer2 className="w-3 h-3" /> Jugador
                                </div>
                            </button>
                            <button 
                                onClick={() => onToggleSpectator(true)}
                                className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${isSpectator ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <Eye className="w-3 h-3" /> Espectador
                                </div>
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-600 italic px-2">
                            {isSpectator 
                                ? "La cámara vuela libremente por el mundo." 
                                : "La cámara sigue a tu personaje en tercera persona."}
                        </p>
                    </section>

                    {/* Keybinds */}
                    <section className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-2">
                            <Keyboard className="w-3 h-3" /> Controles de Teclado
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                            {Object.entries(keybinds).map(([action, key]) => (
                                <div key={action} className="flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800/50 rounded-2xl hover:border-slate-700 transition-colors">
                                    <span className="text-xs font-medium text-slate-400 capitalize">{action}</span>
                                    <button 
                                        onClick={() => setListeningForKey(action as keyof Keybinds)}
                                        className={`min-w-[80px] px-3 py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all ${
                                            listeningForKey === action 
                                            ? 'bg-blue-500/20 border-blue-500 text-blue-400 animate-pulse' 
                                            : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-600'
                                        }`}
                                    >
                                        {listeningForKey === action ? 'Presiona...' : key === ' ' ? 'S-SPACE' : key.toUpperCase()}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                    
                    {/* Gamepad Placeholder */}
                    <section className="p-4 bg-slate-950/50 border border-slate-800/50 rounded-3xl flex items-center gap-4">
                        <div className="p-3 bg-slate-900 rounded-2xl text-slate-600">
                            <Gamepad2 className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-slate-400">Control de Mando</h4>
                            <p className="text-[9px] text-slate-600 mt-1">Conecta un mando de Xbox o PS y presiona un botón para activarlo.</p>
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg hover:shadow-blue-500/20 active:scale-95"
                    >
                        Listo
                    </button>
                </div>
            </div>
        </div>
    );
}
