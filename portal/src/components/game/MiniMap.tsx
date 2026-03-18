'use client';
import { useEffect, useRef, useMemo } from 'react';

interface Agent {
  world_x?: number;
  world_y?: number;
  color_primary?: string;
  [key: string]: unknown;
}

export default function MiniMap({ agents }: { agents: Agent[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const MAP_SIZE = 150;
  const SCALE = useMemo(() => MAP_SIZE / 20000, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    // Renderizar agentes como puntitos
    agents.forEach(agent => {
      const x = (agent.world_x || 0) * SCALE;
      const y = (agent.world_y || 0) * SCALE;
      
      ctx.fillStyle = agent.color_primary || '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    });

  }, [agents, SCALE]);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-1 shadow-2xl">
      <canvas 
        ref={canvasRef} 
        width={MAP_SIZE} 
        height={MAP_SIZE} 
        className="rounded-xl"
      />
    </div>
  );
}
