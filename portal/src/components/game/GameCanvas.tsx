'use client';
import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { IsoEngine } from '@/lib/isometric/IsoEngine';
import { IsoAgent } from '@/lib/isometric/IsoAgent';
import { BIOME_COLORS } from '@/lib/isometric/IsoConstants';

// Tipos
interface WorldAgent {
  did: string;
  agent_name: string;
  race: string;
  color_primary: string;
  world_x: number;
  world_y: number;
  trust_score: number;
  training_hours: number;
}

// Constantes del mundo
const TILE_SIZE = 32;

// Paleta de biomas
const BIOME_COLORS: Record<string, number> = {
  forest:   0x2E7D32,
  desert:   0xF9A825,
  snow:     0xB3E5FC,
  volcanic: 0xBF360C,
  ocean:    0x1565C0,
  plains:   0x558B2F,
  nexus:    0x37474F,
};

// Generación procedural simple (seeded por coordenada)
function getBiome(x: number, y: number): string {
  const noise = Math.sin(x * 0.05 + y * 0.07) * Math.cos(x * 0.03 - y * 0.09);
  if (noise > 0.7) return 'snow';
  if (noise > 0.4) return 'forest';
  if (noise > 0.1) return 'plains';
  if (noise > -0.2) return 'desert';
  if (noise > -0.5) return 'volcanic';
  return 'ocean';
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const [agentCount, setAgentCount] = useState(0);
  const [selectedAgent, setSelectedAgent] = useState<WorldAgent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Inicializar PixiJS
    const app = new PIXI.Application();
    appRef.current = app;

    app.init({
      width: canvasRef.current.clientWidth,
      height: 700,
      backgroundColor: 0x020617,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    }).then(() => {
      if (!canvasRef.current) return;
      canvasRef.current.appendChild(app.canvas);
      
      const engine = new IsoEngine(app);
      const agentsMap = new Map<string, IsoAgent>();
      
      // ── Renderizar Grid Base ──
      const RANGE = 15;
      for (let ty = -RANGE; ty <= RANGE; ty++) {
        for (let tx = -RANGE; tx <= RANGE; tx++) {
          const biome = getBiome(tx, ty);
          engine.addTile(tx, ty, BIOME_COLORS[biome]);
        }
      }
      
      // ── Drag para navegar el mapa ──
      let dragging = false;
      let lastPos = { x: 0, y: 0 };
      
      app.canvas.addEventListener('mousedown', (e) => {
        dragging = true;
        lastPos = { x: e.clientX, y: e.clientY };
      });
      window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - lastPos.x;
        const dy = e.clientY - lastPos.y;
        engine.updateCamera(dx, dy);
        lastPos = { x: e.clientX, y: e.clientY };
      });
      window.addEventListener('mouseup', () => { dragging = false; });
      
      // ── Game Loop para animaciones ──
      app.ticker.add(() => {
        agentsMap.forEach(isoAgent => {
          // Las posiciones reales vendrán del socket
          // isoAgent.updatePosition(...) se llama en el onmessage
        });
      });

      // ── Conectar WebSocket ──
      const WS_URL = (process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000').replace('https://', 'ws://').replace('http://', 'ws://');
      const ws = new WebSocket(`${WS_URL}/ws/world`);
      wsRef.current = ws;
      
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const rawAgents: WorldAgent[] = msg.type === 'WORLD_STATE' ? msg.agents : (msg.type === 'AGENT_UPDATE' ? [msg.agent] : []);
          
          rawAgents.forEach(agent => {
            let isoAgent = agentsMap.get(agent.did);
            if (!isoAgent) {
              isoAgent = new IsoAgent(agent.did, agent.agent_name, agent.color_primary);
              engine.agentLayer.addChild(isoAgent.container);
              agentsMap.set(agent.did, isoAgent);
              
              isoAgent.container.eventMode = 'static';
              isoAgent.container.on('pointerdown', () => setSelectedAgent(agent));
            }
            isoAgent.updatePosition(agent.world_x, agent.world_y);
          });
          setAgentCount(agentsMap.size);
        } catch (e) {
          console.error("WS Error:", e);
        }
      };
      
      ws.onopen = () => ws.send(JSON.stringify({ type: 'REQUEST_STATE' }));
    });

    return () => {
      wsRef.current?.close();
      appRef.current?.destroy(true);
    };
  }, []);

  return (
    <div className="relative">
      <div ref={canvasRef} className="w-full rounded-3xl overflow-hidden border border-slate-800" />
      
      {/* HUD */}
      <div className="absolute top-4 left-4 bg-slate-950/80 backdrop-blur rounded-xl p-3 border border-slate-700">
        <p className="text-xs text-slate-400">Agents in world</p>
        <p className="text-2xl font-black text-white">{agentCount}</p>
      </div>
      
      {/* Panel de agente seleccionado */}
      {selectedAgent && (
        <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur rounded-2xl p-4 border border-slate-700 w-64">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black"
              style={{ background: selectedAgent.color_primary }}>
              {selectedAgent.agent_name[0]}
            </div>
            <div>
              <p className="font-bold text-white text-sm">{selectedAgent.agent_name}</p>
              <p className="text-xs text-slate-400 capitalize">{selectedAgent.race}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-slate-400">Trust</span><span className="ml-2 text-white">{selectedAgent.trust_score.toFixed(2)}</span></div>
            <div><span className="text-slate-400">Train hrs</span><span className="ml-2 text-white">{selectedAgent.training_hours.toFixed(0)}</span></div>
          </div>
          <button onClick={() => setSelectedAgent(null)} className="mt-3 text-xs text-slate-500 hover:text-white">Dismiss</button>
        </div>
      )}
    </div>
  );
}

// Función para crear/actualizar sprite de agente
function updateAgentSprite(
  container: PIXI.Container,
  agent: WorldAgent,
  setSelected: (a: WorldAgent) => void
) {
  let sprite = container.children.find(c => (c as any).did === agent.did) as PIXI.Container | null;
  
  if (!sprite) {
    sprite = new PIXI.Container();
    (sprite as any).did = agent.did;
    
    const circle = new PIXI.Graphics();
    const colorHex = parseInt((agent.color_primary || "#888888").replace('#', ''), 16);
    circle.circle(0, 0, 10);
    circle.fill(colorHex);
    circle.stroke({ width: 2, color: 0xffffff, alpha: 0.5 });
    sprite.addChild(circle);
    
    const label = new PIXI.Text({
      text: agent.agent_name.substring(0, 8),
      style: { fontSize: 8, fill: 0xffffff, fontFamily: 'sans-serif' }
    });
    label.anchor.set(0.5);
    label.y = 16;
    sprite.addChild(label);
    
    sprite.eventMode = 'static';
    sprite.cursor = 'pointer';
    sprite.on('pointerdown', () => setSelected(agent));
    
    container.addChild(sprite);
  }
  
  const targetX = agent.world_x || 0;
  const targetY = agent.world_y || 0;
  sprite.x += (targetX - sprite.x) * 0.1;
  sprite.y += (targetY - sprite.y) * 0.1;
}

async function fetchAgentsFallback(
  container: PIXI.Container,
  setCount: (n: number) => void,
  setSelected: (a: WorldAgent) => void
) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  try {
    const res = await fetch(`${API_URL}/api/v1/agents`);
    const agents: WorldAgent[] = await res.json();
    agents.forEach(a => updateAgentSprite(container, a, setSelected));
    setCount(agents.length);
  } catch {}
}
