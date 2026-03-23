'use client';

import dynamic from 'next/dynamic';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useState } from 'react';

// Use Next.js dynamic import with ssr: false — this is critical.
// @react-three/fiber uses React internals (ReactCurrentBatchConfig) that
// crash during SSR. The ssr:false flag ensures the Canvas only renders
// in the browser where WebGL context is available.
const WorldCanvas = dynamic(
  () => import('@/components/world3d/WorldCanvas').then(mod => mod.default),
  {
    ssr: false,
    loading: () => (
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
    ),
  },
);

function ErrorFallback() {
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
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-sm transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        Reintentar
      </button>
    </div>
  );
}

export default function WorldPage() {
  const [hasError, setHasError] = useState(false);

  if (hasError) return <ErrorFallback />;

  return (
    <main className="w-full h-screen overflow-hidden">
      <ErrorBoundary onError={() => setHasError(true)}>
        <WorldCanvas />
      </ErrorBoundary>
    </main>
  );
}

// Simple error boundary as a class component (React error boundaries must be classes)
import React from 'react';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onError: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('WorldCanvas crash:', error);
    this.props.onError();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
