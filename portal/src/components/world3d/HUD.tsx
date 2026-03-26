'use client';
import React from 'react';
import { Activity, LogOut, Save, Compass } from 'lucide-react';

interface WsAgent {
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

interface HUDProps {
    status: 'connecting' | 'connected' | 'disconnected' | 'error';
    agents: WsAgent[];
    myDid: string | null;
    logs: string[];
    onLogout: () => void;
    onSaveSoul: () => void;
    actionPending: { finish_at: string; duration: number } | null;
}

const STATUS_COLORS = {
    connecting: 'text-amber-400',
    connected: 'text-emerald-400',
    disconnected: 'text-slate-500',
    error: 'text-red-400',
};

export default function HUD({ status, agents, myDid, logs, onLogout, onSaveSoul, actionPending }: HUDProps) {
    const me = agents.find(a => a.did === myDid);

    return (
        <>
            {/* Top-left: Connection + controls */}
            <div className="absolute top-4 left-4 z-30 space-y-2 pointer-events-auto" style={{ maxWidth: 220 }}>
                {/* Status Badge */}
                <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-2 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${STATUS_COLORS[status]}`}>{status}</span>
                    <span className="text-[10px] text-slate-500 ml-auto">{agents.length} online</span>
                </div>

                {/* My stats */}
                {me && (
                    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-3 space-y-2">
                        <div className="text-xs font-black text-white">{me.agent_name}</div>
                        <div className="text-[10px] text-slate-500">Lv{me.level} · {me.race}</div>
                        {/* Health */}
                        <div>
                            <div className="flex justify-between text-[9px] text-slate-400 mb-0.5">
                                <span>HP</span><span>{Math.round(me.health)}/{me.max_health}</span>
                            </div>
                            <div className="h-1 bg-slate-950 rounded-full overflow-hidden">
                                <div className="h-full bg-rose-500 transition-all" style={{ width: `${(me.health / me.max_health) * 100}%` }} />
                            </div>
                        </div>
                        {/* Stamina */}
                        <div>
                            <div className="flex justify-between text-[9px] text-slate-400 mb-0.5">
                                <span>STA</span><span>{Math.round(me.stamina)}/{me.max_stamina}</span>
                            </div>
                            <div className="h-1 bg-slate-950 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500 transition-all" style={{ width: `${(me.stamina / me.max_stamina) * 100}%` }} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Movement hint */}
                <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/50 rounded-xl px-3 py-1.5 flex items-center gap-2">
                    <Compass className="w-3 h-3 text-blue-400" />
                    <span className="text-[9px] text-slate-400">WASD / Arrow keys to move</span>
                </div>

                {/* Action buttons */}
                <div className="flex gap-1.5">
                    <button onClick={onSaveSoul} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg text-[10px] font-bold transition-colors border border-slate-700/50">
                        <Save className="w-3 h-3" /> Save
                    </button>
                    <button onClick={onLogout} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-slate-800/80 hover:bg-red-900/50 text-slate-400 hover:text-red-400 rounded-lg text-[10px] font-bold transition-colors border border-slate-700/50">
                        <LogOut className="w-3 h-3" /> Logout
                    </button>
                </div>
            </div>

            {/* Action pending overlay */}
            {actionPending && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 bg-slate-900/90 backdrop-blur-md border border-blue-500/30 rounded-2xl px-6 py-4 text-center">
                    <Activity className="w-6 h-6 text-blue-400 animate-spin mx-auto mb-2" />
                    <p className="text-sm font-bold text-white">Action in progress...</p>
                    <p className="text-[10px] text-slate-400 mt-1">{actionPending.duration}s remaining</p>
                </div>
            )}

            {/* Bottom: Event log */}
            {logs.length > 0 && (
                <div className="absolute bottom-4 left-4 z-30 w-72 bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-xl p-2 space-y-0.5 pointer-events-auto">
                    {logs.slice(0, 5).map((log, i) => (
                        <div key={i} className="text-[10px] text-slate-400 truncate px-1">{log}</div>
                    ))}
                </div>
            )}
        </>
    );
}
