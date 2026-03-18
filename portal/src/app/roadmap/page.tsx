'use client';

import { Check, Lock, Globe, Eye, User, Sparkles } from 'lucide-react';
import { useT } from '@/lib/i18n';

export default function RoadmapPage() {
  const { t } = useT();

  const phases = [
    {
      id: 1,
      name: t.rm_p1_name,
      tagline: t.rm_p1_tagline,
      status: 'active',
      features: [t.rm_p1_f1, t.rm_p1_f2, t.rm_p1_f3, t.rm_p1_f4, t.rm_p1_f5],
      description: t.rm_p1_desc,
      icon: Eye,
    },
    {
      id: 2,
      name: t.rm_p2_name,
      tagline: t.rm_p2_tagline,
      status: 'locked',
      features: [t.rm_p2_f1, t.rm_p2_f2, t.rm_p2_f3, t.rm_p2_f4],
      description: t.rm_p2_desc,
      icon: Globe,
    },
    {
      id: 3,
      name: t.rm_p3_name,
      tagline: t.rm_p3_tagline,
      status: 'locked',
      features: [t.rm_p3_f1, t.rm_p3_f2, t.rm_p3_f3, t.rm_p3_f4],
      description: t.rm_p3_desc,
      icon: User,
    },
    {
      id: 4,
      name: t.rm_p4_name,
      tagline: t.rm_p4_tagline,
      status: 'locked',
      features: [t.rm_p4_f1, t.rm_p4_f2, t.rm_p4_f3, t.rm_p4_f4],
      description: t.rm_p4_desc,
      icon: Sparkles,
    },
  ];

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 py-20 px-6 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-20 animate-in fade-in duration-1000">
          <h1 className="text-5xl font-black text-white tracking-tighter mb-6">{t.rm_h1}</h1>
          <p className="text-slate-400 text-lg leading-relaxed max-w-2xl mx-auto italic">
            {t.rm_quote}
          </p>
        </header>

        <div className="space-y-12">
          {phases.map((phase, i) => (
            <div key={phase.id} className={`group relative flex gap-8 items-start ${phase.status === 'locked' ? 'opacity-50' : ''}`}>
              {/* Timeline line */}
              {i !== phases.length - 1 && (
                <div className="absolute left-6 top-16 bottom-0 w-px bg-slate-800 group-hover:bg-blue-500/30 transition-colors"></div>
              )}

              {/* Icon / Number */}
              <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-700 ${
                phase.status === 'active'
                ? 'bg-blue-600 border-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.4)] text-white'
                : 'bg-slate-900 border-slate-800 text-slate-600'
              }`}>
                {phase.status === 'active' ? <phase.icon className="w-5 h-5" /> : <Lock className="w-4 h-4" />}
              </div>

              {/* Content */}
              <div className={`flex-1 bg-slate-900/40 border border-slate-800 rounded-3xl p-8 transition-all duration-500 ${
                phase.status === 'active' ? 'border-blue-500/30 bg-blue-500/[0.02]' : 'hover:border-slate-700'
              }`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">
                        {t.rm_phase} {phase.id}
                      </span>
                      {phase.status === 'active' && (
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-500 text-[8px] font-black rounded uppercase animate-pulse">
                          {t.rm_live}
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">{phase.name}</h2>
                    <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest">{phase.tagline}</p>
                  </div>
                </div>

                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  {phase.description}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {phase.features.map((feat, j) => (
                    <div key={j} className="flex items-center gap-2 text-[10px] font-bold text-slate-300">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${phase.status === 'active' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-600'}`}>
                        {phase.status === 'active' ? <Check className="w-2 h-2" /> : <div className="w-1 h-1 bg-current rounded-full" />}
                      </div>
                      {feat}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 p-8 rounded-3xl bg-blue-500/5 border border-blue-500/10 text-center">
          <p className="text-xs text-blue-400 font-medium italic">
            {t.rm_footer_note}
          </p>
        </div>
      </div>
    </div>
  );
}
