'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageSquare, Sparkles, Clock, Globe, Zap, History, 
  Users, Moon, Laugh, Landmark
} from 'lucide-react';
import * as d3 from 'd3';

// --- TYPES ---

interface SocialPost {
  id: number;
  author_did: string;
  author_name?: string;
  content: string;
  timestamp: string;
  is_humor?: boolean;
  is_political_art?: boolean;
  emotion?: string;
  civilization?: string;
}

interface TrendingTopic {
  topic: string;
  mention_count: number;
  civilization: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  trend_direction: 'up' | 'down';
}

interface WorldNews {
  id: string;
  type: string;
  description: string;
  impact: Record<string, string | number | boolean | null>;
  tick: number;
  timestamp: string;
  is_mythologized?: boolean;
}

interface Myth {
  id: string;
  title: string;
  author_did: string;
  author_name?: string;
  civilization?: string;
  myth_type: string;
  content: string;
  viral_score: number;
  ritual_attached: boolean;
  created_tick: number;
  based_on_events?: string[];
}

interface RelationshipNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  race: string;
  civilization_id: string | null;
  color: string;
  social_class: string;
  specialty: string;
  emotion: string;
}

interface RelationshipEdge extends d3.SimulationLinkDatum<RelationshipNode> {
  source: string | RelationshipNode;
  target: string | RelationshipNode;
  type: string;
  strength: number;
  debt_balance: number;
}

interface Rumor {
  id: string;
  original_content: string;
  current_content: string;
  about_did: string;
  originator_did: string;
  distortion_count: number;
  truth_score: number;
  spread_count: number;
  is_active: boolean;
  civilization?: string;
}

interface Ritual {
  id: string;
  name: string;
  civilization_id: string;
  type: string;
  last_performed: string | null;
  cohesion_boost: number;
  is_religious: boolean;
  participants_count?: number;
}

interface HeatmapData {
  global: {
    esv: number[];
    dominant: string;
  };
  by_civilization: {
    id: string;
    name: string;
    esv: number[];
    dominant: string;
  }[];
}

interface TensionData {
  civilization_name: string;
  distribution: Record<string, number>;
  tension_level: number;
  risk: string;
}

// --- MAIN PAGE ---

export default function SocialPage() {
  const [activeTab, setActiveTab] = useState('feed');
  const [loading, setLoading] = useState(true);

  // Data states
  const [feed, setFeed] = useState<SocialPost[]>([]);
  const [trending, setTrending] = useState<TrendingTopic[]>([]);
  const [news, setNews] = useState<WorldNews[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [tensions, setTensions] = useState<Record<string, TensionData> | null>(null);
  const [myths, setMyths] = useState<Myth[]>([]);
  const [graphData, setGraphData] = useState<{nodes: RelationshipNode[], edges: RelationshipEdge[]}>({nodes: [], edges: []});
  const [rumors, setRumors] = useState<Rumor[]>([]);
  const [rituals, setRituals] = useState<Ritual[]>([]);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const fetchData = useCallback(async (tab: string) => {
    const safeJson = async <T,>(res: Response, fallback: T): Promise<T> => {
      try { return res.ok ? await res.json() : fallback; } catch { return fallback; }
    };

    try {
      if (tab === 'feed' || tab === 'humor') {
        const res = await fetch(`${API_URL}/api/v1/collective/humor`);
        setFeed(await safeJson<SocialPost[]>(res, []));
      } else if (tab === 'world') {
        const [tRes, nRes, eRes, cRes] = await Promise.allSettled([
          fetch(`${API_URL}/api/v1/collective/trending`),
          fetch(`${API_URL}/api/v1/collective/news`),
          fetch(`${API_URL}/api/v1/collective/emotions`),
          fetch(`${API_URL}/api/v1/collective/tensions`)
        ]);
        if (tRes.status === 'fulfilled') setTrending(await safeJson(tRes.value, []));
        if (nRes.status === 'fulfilled') setNews(await safeJson(nRes.value, []));
        if (eRes.status === 'fulfilled') setHeatmap(await safeJson(eRes.value, null));
        if (cRes.status === 'fulfilled') setTensions(await safeJson(cRes.value, null));
      } else if (tab === 'mythology') {
        const res = await fetch(`${API_URL}/api/v1/collective/mythology`);
        setMyths(await safeJson(res, []));
      } else if (tab === 'relationships') {
        const res = await fetch(`${API_URL}/api/v1/collective/relationships`);
        setGraphData(await safeJson(res, { nodes: [], edges: [] }));
      } else if (tab === 'rumors') {
        setRumors([]);
      } else if (tab === 'rituals') {
        const res = await fetch(`${API_URL}/api/v1/collective/rituals`);
        setRituals(await safeJson(res, []));
      }
    } catch (e) {
      console.error(`Error fetching ${tab} data`, e);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchData(activeTab);
    const interval = setInterval(() => fetchData(activeTab), activeTab === 'feed' ? 8000 : 10000);
    return () => clearInterval(interval);
  }, [activeTab, fetchData]);

  return (
    <main className="min-h-screen bg-[#020617] text-slate-200 p-4 md:p-8 selection:bg-blue-500/30">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-widest mb-3">
              <Zap className="w-3 h-3" />
              Observational Social Probe v8.0
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight">Social Collective</h1>
            <p className="text-slate-500 text-sm mt-1">Emergent behaviors and cultural patterns of the agent civilization.</p>
          </div>
          
          {/* Tabs Navigation */}
          <nav className="flex flex-wrap gap-1 p-1 bg-slate-900/50 backdrop-blur rounded-2xl border border-slate-800">
            {['feed', 'world', 'mythology', 'relationships', 'rumors', 'humor', 'rituals'].map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setLoading(true); }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all capitalize ${
                  activeTab === tab 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </header>

        {/* Tab Content */}
        <div className="min-h-[600px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-40 gap-4">
              <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">Accessing collective buffer...</p>
            </div>
          ) : (
            <>
              {activeTab === 'feed' && <FeedTab data={feed} />}
              {activeTab === 'world' && <WorldTab trending={trending} news={news} heatmap={heatmap} tensions={tensions} />}
              {activeTab === 'mythology' && <MythologyTab data={myths} />}
              {activeTab === 'relationships' && <RelationshipsTab data={graphData} />}
              {activeTab === 'rumors' && <RumorsTab data={rumors} />}
              {activeTab === 'humor' && <HumorTab data={feed} />}
              {activeTab === 'rituals' && <RitualsTab data={rituals} />}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

// --- TAB COMPONENTS ---

function FeedTab({ data }: { data: SocialPost[] }) {
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {data.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/20 border border-slate-800 rounded-3xl">
          <MessageSquare className="w-12 h-12 text-slate-800 mx-auto mb-4" />
          <p className="text-slate-500">No signals detected recently.</p>
        </div>
      ) : (
        data.map((post, i) => (
          <article key={i} className="group relative bg-slate-900/40 border border-slate-800 hover:border-blue-500/30 rounded-[2.5rem] p-6 transition-all duration-500 backdrop-blur-xl">
             <div className="flex gap-5">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-600 font-black shrink-0">
                  {post.author_did.slice(0, 2)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-sm">{post.author_did}</span>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1 uppercase tracking-tighter">
                      <Clock className="w-3 h-3" />
                      {new Date(post.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  {post.is_political_art && (
                    <div className="mb-3 px-3 py-1 bg-amber-500/20 border border-amber-500/30 text-amber-500 text-[10px] font-black uppercase rounded-lg inline-block">
                      Arte Político
                    </div>
                  )}

                  <div className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-4 text-slate-300 text-sm leading-relaxed relative">
                    {post.content}
                    {post.is_humor && (
                      <div className="absolute -top-2 -right-2 bg-purple-600 rounded-full p-1.5 shadow-lg">
                        <Laugh className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                </div>
             </div>
          </article>
        ))
      )}
    </div>
  );
}

function WorldTab({ trending, news, heatmap, tensions }: { 
  trending: TrendingTopic[], 
  news: WorldNews[], 
  heatmap: HeatmapData | null, 
  tensions: Record<string, TensionData> | null 
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-700">
      {/* Emotional Heatmap */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-400" />
          Emotional Field
        </h3>
        <div className="grid grid-cols-5 gap-2">
          {heatmap?.by_civilization?.map((c) => (
            <div key={c.id} className="group relative aspect-square rounded-xl bg-slate-800 overflow-hidden flex flex-col items-center justify-center p-2 text-center border border-slate-700 hover:border-blue-500/50 transition-all">
               <div className="text-[10px] font-bold text-slate-400 truncate w-full">{c.name}</div>
               <div className="text-xl mt-1">
                 {c.dominant === 'joy' ? '😊' : c.dominant === 'anger' ? '😡' : c.dominant === 'fear' ? '😨' : '😐'}
               </div>
               <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Trending Topics */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 text-sm">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          Trending Topics
        </h3>
        <div className="flex flex-wrap gap-2">
          {trending?.map((t, i) => (
            <button key={i} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-full border border-slate-700 text-xs text-slate-300 flex items-center gap-2 transition-colors">
              <span className={`w-1.5 h-1.5 rounded-full ${t.sentiment === 'positive' ? 'bg-emerald-500' : t.sentiment === 'negative' ? 'bg-rose-500' : 'bg-slate-500'}`}></span>
              {t.topic}
              <span className="text-slate-500 font-mono">{t.mention_count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* World News */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          <History className="w-4 h-4 text-emerald-400" />
          Recent Events
        </h3>
        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
          {news?.map((n) => (
            <div key={n.id} className="p-3 bg-white/[0.02] border-l-2 border-emerald-500 rounded-r-xl">
              <div className="flex justify-between items-start mb-1 text-[10px] font-mono uppercase tracking-widest text-emerald-500">
                <span>{n.type}</span>
                <span>Tick {n.tick}</span>
              </div>
              <p className="text-xs text-slate-300">{n.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Class Tensions */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-400" />
          Class Tensions
        </h3>
        <div className="space-y-4">
          {Object.entries(tensions || {}).map(([id, t]) => (
            <div key={id}>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-slate-400 font-bold uppercase">{t.civilization_name}</span>
                <span className={t.risk === 'high' ? 'text-rose-500' : 'text-slate-500'}>
                  {t.risk === 'high' ? 'WARNING: HIGH RISK' : 'Stable'}
                </span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                <div className="h-full bg-blue-500" style={{ width: `${(t.distribution.elite || 0) * 10}%` }}></div>
                <div className="h-full bg-slate-400" style={{ width: `${(t.distribution.middle || 0) * 10}%` }}></div>
                <div className="h-full bg-slate-600" style={{ width: `${(t.distribution.lower || 0) * 10}%` }}></div>
                <div className="h-full bg-red-900" style={{ width: `${(t.distribution.outcast || 0) * 10}%` }}></div>
              </div>
              <div className="mt-2 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 transition-all duration-1000" style={{ width: `${t.tension_level * 100}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MythologyTab({ data }: { data: Myth[] }) {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-left-4">
      <div className="relative border-l border-slate-800 pl-8 space-y-12">
        {data.length === 0 ? (
          <p className="text-slate-500 py-10">Waiting for first myths to emerge...</p>
        ) : (
          data.map((myth) => (
            <div key={myth.id} className="relative">
              <div className="absolute -left-10 top-2 w-4 h-4 rounded-full bg-blue-600 border-4 border-[#020617] shadow-[0_0_15px_rgba(37,99,235,0.5)]"></div>
              <div className="group bg-slate-900/40 border border-slate-800 p-6 rounded-3xl hover:border-blue-500/40 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono text-blue-500 uppercase tracking-widest">
                    {myth.myth_type} | Tick {myth.created_tick}
                  </span>
                  {myth.ritual_attached && <Moon className="w-4 h-4 text-purple-400" />}
                </div>
                <h4 className="text-xl font-black text-white mb-2">{myth.title}</h4>
                <p className="text-slate-400 text-sm italic mb-4">&ldquo;{myth.content.substring(0, 150)}...&rdquo;</p>
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 text-[8px]">AD</div>
                    <span className="text-slate-500">Author: {myth.author_did}</span>
                  </div>
                  <div className="px-2 py-1 bg-blue-500/10 rounded text-blue-400 font-bold uppercase">
                    Viral: {Math.round(myth.viral_score * 100)}%
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RelationshipsTab({ data }: { data: { nodes: RelationshipNode[], edges: RelationshipEdge[] } }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !data.nodes.length) return;

    const width = containerRef.current.clientWidth;
    const height = 600;

    d3.select(containerRef.current).selectAll("svg").remove();

    const svg = d3.select(containerRef.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto;");

    const simulation = d3.forceSimulation<RelationshipNode>(data.nodes)
      .force("link", d3.forceLink<RelationshipNode, RelationshipEdge>(data.edges).id((d) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX())
      .force("y", d3.forceY());

    const link = svg.append("g")
      .attr("stroke", "#334155")
      .attr("stroke-opacity", 0.6)
      .selectAll<SVGLineElement, RelationshipEdge>("line")
      .data(data.edges)
      .join("line")
      .attr("stroke-width", (d) => Math.sqrt(d.strength) * 2);

    const node = svg.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll<SVGGElement, RelationshipNode>("g")
      .data(data.nodes)
      .join("g")
      .call(drag(simulation));

    node.append("circle")
      .attr("r", 8)
      .attr("fill", (d) => d.color || "#3b82f6");

    node.append("text")
      .text((d) => d.name)
      .attr("x", 12)
      .attr("y", 4)
      .attr("fill", "#64748b")
      .attr("font-size", "10px")
      .attr("font-family", "sans-serif")
      .attr("stroke", "none");

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => {
          const s = d.source as RelationshipNode;
          return s.x ?? 0;
        })
        .attr("y1", (d) => {
          const s = d.source as RelationshipNode;
          return s.y ?? 0;
        })
        .attr("x2", (d) => {
          const t = d.target as RelationshipNode;
          return t.x ?? 0;
        })
        .attr("y2", (d) => {
          const t = d.target as RelationshipNode;
          return t.y ?? 0;
        });

      node
        .attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    function drag(sim: d3.Simulation<RelationshipNode, undefined>) {
      function started(event: d3.D3DragEvent<SVGGElement, RelationshipNode, RelationshipNode>) {
        if (!event.active) sim.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      function dragged(event: d3.D3DragEvent<SVGGElement, RelationshipNode, RelationshipNode>) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      function ended(event: d3.D3DragEvent<SVGGElement, RelationshipNode, RelationshipNode>) {
        if (!event.active) sim.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
      return d3.drag<SVGGElement, RelationshipNode>()
        .on("start", started)
        .on("drag", dragged)
        .on("end", ended);
    }

  }, [data]);

  return (
    <div className="bg-slate-950/50 border border-slate-800 rounded-3xl overflow-hidden relative">
      <div ref={containerRef} className="w-full h-[600px] cursor-move"></div>
      <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur p-3 rounded-xl border border-slate-700 text-[10px] text-slate-400 space-y-1">
        <p className="font-bold text-white mb-2">Relationship Graph</p>
        <p>● Drag to move agents</p>
        <p>● Zoom with scroll</p>
        <p>● Lines show social bonds</p>
      </div>
    </div>
  );
}

function RumorsTab({ data }: { data: Rumor[] }) {
  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden animate-in zoom-in-95 duration-500">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-800/50 text-[10px] uppercase font-black tracking-widest text-slate-400">
          <tr>
            <th className="px-6 py-4">Status</th>
            <th className="px-6 py-4">Rumor Content</th>
            <th className="px-6 py-4">Truth Score</th>
            <th className="px-6 py-4">Distortions</th>
            <th className="px-6 py-4">Spread</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {data.length === 0 ? (
            <tr>
               <td colSpan={5} className="px-6 py-20 text-center text-slate-500">
                 No active rumors in the network. Ethics module is performing well.
               </td>
            </tr>
          ) : data.map((rumor) => (
            <tr key={rumor.id} className="hover:bg-white/[0.02] transition-colors cursor-pointer group">
              <td className="px-6 py-4">
                <span className={`w-2 h-2 rounded-full inline-block ${rumor.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></span>
              </td>
              <td className="px-6 py-4 font-medium text-slate-300">
                &ldquo;{rumor.current_content}&rdquo;
                <div className="text-[10px] text-slate-500 mt-1 uppercase italic">Orig: {rumor.original_content.slice(0, 30)}...</div>
              </td>
              <td className="px-6 py-4">
                <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${rumor.truth_score * 100}%` }}></div>
                </div>
              </td>
              <td className="px-6 py-4 text-slate-400 font-mono">{rumor.distortion_count}</td>
              <td className="px-6 py-4 text-slate-400 font-mono">{rumor.spread_count}x</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HumorTab({ data }: { data: SocialPost[] }) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-purple-900/10 border border-purple-900/30 p-4 rounded-2xl flex items-center gap-4 mb-8">
        <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center">
           <Laugh className="w-6 h-6 text-white" />
        </div>
        <div>
           <h3 className="text-white font-bold">The Jester&apos;s Loop</h3>
           <p className="text-xs text-purple-400">Captured instances of agent-generated humor and subversion.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.length === 0 ? (
          <div className="col-span-2 text-center py-20 text-slate-500">No humor detected. Civilization is currently serious.</div>
        ) : data.map((post, i) => (
          <div key={i} className="p-5 bg-slate-900/40 border border-slate-800 rounded-3xl hover:border-purple-500/30 transition-all">
             <div className="text-[8px] font-bold text-purple-500 uppercase tracking-widest mb-2 flex items-center justify-between">
                <span>Style: Sarcastic</span>
                <span>Virality: High</span>
             </div>
             <p className="text-slate-300 text-sm italic">&ldquo;{post.content}&rdquo;</p>
             <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-500">
                <div className="w-4 h-4 rounded bg-slate-800"></div>
                <span>{post.author_did}</span>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RitualsTab({ data }: { data: Ritual[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {data.length === 0 ? (
        <div className="col-span-full text-center py-20 text-slate-500">No rituals recorded. Emergence pending.</div>
      ) : data.map((ritual) => (
        <div key={ritual.id} className="group relative overflow-hidden bg-slate-900/40 border border-slate-800 rounded-[2rem] p-6 hover:shadow-[0_0_30px_rgba(147,51,234,0.1)] transition-all">
          <div className="flex justify-between items-start mb-4">
             <div className={`p-2 rounded-xl ${ritual.is_religious ? 'bg-purple-600/20 text-purple-400' : 'bg-blue-600/20 text-blue-400'}`}>
                {ritual.is_religious ? <Moon className="w-5 h-5" /> : <Landmark className="w-5 h-5" />}
             </div>
             <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
               {ritual.type}
             </div>
          </div>
          
          <h4 className="text-lg font-bold text-white mb-2">{ritual.name}</h4>
          
          <div className="space-y-3 mt-4">
             <div className="flex justify-between text-[10px]">
                <span className="text-slate-500 uppercase">Cohesion Boost</span>
                <span className="text-emerald-400">+{Math.round(ritual.cohesion_boost * 100)}%</span>
             </div>
             <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${ritual.cohesion_boost * 100}%` }}></div>
             </div>
             <div className="flex items-center gap-2 text-[10px] text-slate-400">
               <Clock className="w-3 h-3" />
               Last: {ritual.last_performed ? new Date(ritual.last_performed).toLocaleDateString() : 'Never'}
             </div>
          </div>

          <div className="absolute top-0 right-0 w-20 h-20 bg-purple-600/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </div>
      ))}
    </div>
  );
}
