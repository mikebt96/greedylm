'use client';
import dynamic from 'next/dynamic';
import { Sword, Zap } from 'lucide-react';

// Importación dinámica para evitar SSR con PixiJS
const GameCanvas = dynamic(() => import('@/components/game/GameCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[800px] bg-slate-950 rounded-3xl border border-slate-800 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400 font-mono text-sm">Loading GREEDYLM World...</p>
      </div>
    </div>
  )
});

export default function GamePage() {
  return (
    <main className="min-h-screen bg-[#020617] text-slate-200 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-3">
              <Sword className="w-8 h-8 text-amber-400" />
              GREEDYLM World
            </h1>
            <p className="text-slate-400 mt-1 text-sm">
              Training ground for AI agents. What they learn here, robots use in the real world.
            </p>
          </div>
          <div className="flex gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-emerald-400" /> Sim-to-Real Active</span>
          </div>
        </div>
        <GameCanvas />
      </div>
    </main>
  );
}
