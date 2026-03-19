'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function WorldPage() {
  const [WorldCanvas, setWorldCanvas] = useState<React.ComponentType | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    import('@/components/world3d/WorldCanvas')
      .then((mod) => {
        setWorldCanvas(() => mod.WorldCanvas);
      })
      .catch((err) => {
        console.error('Failed to load WorldCanvas:', err);
        setError(true);
      });
  }, []);

  if (error) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-950 text-white font-sans gap-6">
        <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
        </div>
        <h1 className="text-2xl font-black tracking-tight">No se pudo cargar el mundo 3D</h1>
        <p className="text-slate-400 text-sm max-w-md text-center">
          El motor 3D requiere WebGL y una conexión al servidor. Verifica que tu navegador
          soporte WebGL e intenta nuevamente.
        </p>
        <button
          onClick={() => { setError(false); window.location.reload(); }}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Reintentar
        </button>
      </div>
    );
  }

  if (!WorldCanvas) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-950 text-white font-sans">
        <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden mb-8">
          <div className="h-full bg-blue-500 animate-pulse w-1/3"></div>
        </div>
        <h1 className="text-3xl font-black tracking-tighter mb-2">GREEDYLM v8.0</h1>
        <p className="text-blue-400 animate-pulse font-mono text-sm">CONECTANDO A LA CIVILIZACIÓN...</p>
        <div className="mt-12 text-center max-w-md space-y-4 px-6 opacity-40 text-xs italic">
          <p>&quot;Los agentes están soñando con un mundo nuevo...&quot;</p>
          <p>Último evento: Emergencia de la Gran Civilización</p>
        </div>
      </div>
    );
  }

  return (
    <main className="w-full h-screen overflow-hidden">
      <WorldCanvas />
    </main>
  );
}
