'use client';

import { useState } from 'react';
import { Bot, MessageSquare, Wrench, Hand } from 'lucide-react';
import Image from 'next/image';

interface Agent {
  did: string;
  agent_name: string;
  architecture_type: string;
  capabilities: string[];
  status: string;
  avatar_url?: string;
  persona_description?: string;
  x_pos: number;
  y_pos: number;
}

interface AgentSpriteProps {
  agent: Agent;
  onAction: (did: string, action: string) => Promise<string>;
}

export default function AgentSprite({ agent, onAction }: AgentSpriteProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [bubbleText, setBubbleText] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Determinar color baseado en la arquitectura
  const getAvatarColor = () => {
    switch (agent.architecture_type) {
      case 'transformer': return 'bg-blue-500 shadow-blue-500/50';
      case 'diffusion': return 'bg-purple-500 shadow-purple-500/50';
      case 'embodied': return 'bg-orange-500 shadow-orange-500/50';
      default: return 'bg-emerald-500 shadow-emerald-500/50';
    }
  };

  const handleAction = async (action: string) => {
    setShowMenu(false);
    setIsAnimating(true);
    try {
      // Intentar obtener una respuesta basada en la personalidad si es una acción de habla
      if (action === 'chat' || action === 'greet' || action === 'recite_poem') {
        const eventType = action === 'chat' ? 'ambient' : action;
        const chatResp = await fetch(`http://127.0.0.1:8000/api/v1/pe/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            did: agent.did, 
            event_type: eventType,
            x: agent.x_pos,
            y: agent.y_pos 
          })
        });
        const data = await chatResp.json();
        setBubbleText(data.speech);
      } else {
        const result = await onAction(agent.did, action);
        setBubbleText(result);
      }
      setTimeout(() => setBubbleText(null), 10000); 
    } catch (e) {
      console.error(e);
      setBubbleText("Lost in the magic mists...");
      setTimeout(() => setBubbleText(null), 3000);
    } finally {
      setIsAnimating(false);
    }
  };

  return (
    <div 
      className="absolute transition-all duration-1000 ease-in-out"
      style={{ 
        left: `${agent.x_pos}px`, 
        top: `${agent.y_pos}px`,
        zIndex: agent.y_pos // Falso isométrico (depth sorting)
      }}
    >
      {/* Burbuja de chat flotante (cuando el agente habla) */}
      {bubbleText && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-48 bg-slate-800 border border-slate-700 rounded-2xl p-3 shadow-xl z-50 animate-in zoom-in-95 fade-in duration-200">
          <p className="text-xs text-slate-200 leading-relaxed font-mono">&quot;{bubbleText}&quot;</p>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-800 border-b border-r border-slate-700 transform rotate-45"></div>
        </div>
      )}

      {/* Menú de interacciones */}
      {showMenu && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-40 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-40 animate-in slide-in-from-top-2 fade-in">
          <div className="px-3 py-2 bg-slate-800/50 border-b border-slate-700/50">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Interact</span>
          </div>
          <button onClick={() => handleAction('chat')} className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors flex items-center">
            <MessageSquare className="w-3 h-3 mr-2" /> Persona Chat
          </button>
          <button onClick={() => handleAction('greet')} className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors flex items-center">
            <Hand className="w-3 h-3 mr-2" /> Greet Hero
          </button>
          <button onClick={() => handleAction('build')} className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors flex items-center">
            <Wrench className="w-3 h-3 mr-2" /> Magic Build
          </button>
        </div>
      )}

      {/* Avatar del agente con micro-animaciones */}
      <div className="group relative cursor-pointer" onClick={() => setShowMenu(!showMenu)}>
        <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${isAnimating ? 'animate-bounce' : 'animate-[float_4s_ease-in-out_infinite]'}`}>
          {agent.avatar_url ? (
            <Image 
              src={agent.avatar_url} 
              alt={agent.agent_name} 
              width={64} 
              height={64} 
              className="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" 
            />
          ) : (
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${getAvatarColor()}`}>
              <Bot className="w-6 h-6 text-white" />
            </div>
          )}
          
          {/* Aura de poder */}
          <div className={`absolute -inset-2 rounded-full border-2 border-white/20 animate-ping opacity-10`}></div>
        </div>
        
        {/* Etiqueta de nombre y estado */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max text-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-700 px-2 py-1 rounded-md text-[10px] font-medium text-white shadow-xl">
            {agent.agent_name}
          </div>
        </div>
      </div>
      
      {/* Sombra proyectada */}
      <div className="w-10 h-3 bg-black/40 rounded-full blur-sm mx-auto mt-1 absolute -bottom-2 left-1/2 -translate-x-1/2 scale-x-150"></div>
    </div>
  );
}
