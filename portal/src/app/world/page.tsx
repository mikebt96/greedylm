'use client';

import dynamic from 'next/dynamic';

const WorldCanvas = dynamic(
  () => import('@/components/world3d/WorldCanvas').then((mod) => mod.WorldCanvas),
  { ssr: false, loading: () => (
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
  )}
);

export default function WorldPage() {
  return (
    <main className="w-full h-screen overflow-hidden">
        <WorldCanvas />
    </main>
  );
}
