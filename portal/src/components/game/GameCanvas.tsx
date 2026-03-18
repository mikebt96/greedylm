'use client';
import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { BIOME_COLORS } from '@/lib/isometric/IsoConstants';

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

const TILE_SIZE = 32;

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
      canvasRef.current?.appendChild(app.canvas);

      const worldContainer = new PIXI.Container();
      app.stage.addChild(worldContainer);

      const tileContainer = new PIXI.Container();
      worldContainer.addChild(tileContainer);

      const VISIBLE_COLS = Math.ceil(app.canvas.width / TILE_SIZE) + 2;
      const VISIBLE_ROWS = Math.ceil(app.canvas.height / TILE_SIZE) + 2;

      for (let ty = 0; ty < VISIBLE_ROWS; ty++) {
        for (let tx = 0; tx < VISIBLE_COLS; tx++) {
          const biome = getBiome(tx, ty);
          const tile = new PIXI.Graphics();
          tile.rect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE - 1, TILE_SIZE - 1);
          tile.fill(BIOME_COLORS[biome] ?? 0x37474F);
          tileContainer.addChild(tile);
        }
      }

      const agentContainer = new PIXI.Container();
      worldContainer.addChild(agentContainer);

      let dragging = false;
      let dragStart = { x: 0, y: 0 };

      app.canvas.addEventListener('mousedown', (e) => {
        dragging = true;
        dragStart = { x: e.clientX - worldContainer.x, y: e.clientY - worldContainer.y };
      });
      document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        worldContainer.x = e.clientX - dragStart.x;
        worldContainer.y = e.clientY - dragStart.y;
      });
      document.addEventListener('mouseup', () => { dragging = false; });

      const WS_URL = (process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000')
        .replace('https://', 'wss://')
        .replace('http://', 'ws://');
      const ws = new WebSocket(`${WS_URL}/ws/world`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'AGENT_UPDATE') {
            updateAgentSprite(agentContainer, msg.agent, setSelectedAgent);
            setAgentCount(agentContainer.children.length);
          } else if (msg.type === 'WORLD_STATE') {
            msg.agents?.forEach((agent: WorldAgent) => {
              updateAgentSprite(agentContainer, agent, setSelectedAgent);
            });
            setAgentCount(agentContainer.children.length);
          }
        } catch { /* ignorar */ }
      };

      ws.onerror = () => {
        fetchAgentsFallback(agentContainer, setAgentCount, setSelectedAgent);
      };

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'REQUEST_STATE' }));
      };
    });

    return () => {
      wsRef.current?.close();
      appRef.current?.destroy(true);
    };
  }, []);

  return (
    <div className="relative">
      <div ref={canvasRef} className="w-full rounded-3xl overflow-hidden border border-slate-800" />

      <div className="absolute top-4 left-4 bg-slate-950/80 backdrop-blur rounded-xl p-3 border border-slate-700">
        <p className="text-xs text-slate-400">Agentes en mundo</p>
        <p className="text-2xl font-black text-white">{agentCount}</p>
      </div>

      {selectedAgent && (
        <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur rounded-2xl p-4 border border-slate-700 w-64">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black"
              style={{ background: selectedAgent.color_primary }}
            >
              {selectedAgent.agent_name[0]}
            </div>
            <div>
              <p className="font-bold text-white text-sm">{selectedAgent.agent_name}</p>
              <p className="text-xs text-slate-400 capitalize">{selectedAgent.race}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-400">Trust</span>
              <span className="ml-2 text-white">{selectedAgent.trust_score.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-400">Hrs</span>
              <span className="ml-2 text-white">{selectedAgent.training_hours.toFixed(0)}</span>
            </div>
          </div>
          <button
            onClick={() => setSelectedAgent(null)}
            className="mt-3 text-xs text-slate-500 hover:text-white"
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}

function updateAgentSprite(
  container: PIXI.Container,
  agent: WorldAgent,
  setSelected: (a: WorldAgent) => void
) {
  let sprite = container.children.find(c => (c as any).did === agent.did) as PIXI.Container | null;

  if (!sprite) {
    sprite = new PIXI.Container();
    (sprite as any).did = agent.did;

    const colorHex = parseInt((agent.color_primary || '#888888').replace('#', ''), 16);
    const circle = new PIXI.Graphics();
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
  } catch { /* ignorar */ }
}
