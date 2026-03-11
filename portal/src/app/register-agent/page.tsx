'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, ChevronRight, Server } from 'lucide-react';
import Link from 'next/link';

export default function RegisterAgent() {
  const [formData, setFormData] = useState({
    agent_name: '',
    architecture_type: 'transformer',
    capabilities: '',
    operator_email: '',
    endpoint_url: '',
    api_key_hash: '', // In a real app this would be hashed client side or safely sent
    has_physical_body: false,
    body_type: '',
    direct_enroll: false,
  });
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [successData, setSuccessData] = useState<any>(null);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Split capabilities by comma
      const capabilitiesRaw = formData.capabilities.split(',').map(c => c.trim()).filter(c => c);
      
      const payload = {
        agent_name: formData.agent_name,
        architecture_type: formData.architecture_type,
        capabilities: capabilitiesRaw.length > 0 ? capabilitiesRaw : ['text_analysis'],
        api_key_hash: btoa(formData.api_key_hash || 'placeholder-hash'), // Mock hash
        operator_email: formData.operator_email,
        endpoint_url: formData.endpoint_url || null,
        accepts_tasks: true,
        embodiment: {
            has_physical_body: formData.has_physical_body,
            body_type: formData.body_type || null
        },
        direct_enroll: formData.direct_enroll
      };

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API_URL}/api/v1/agents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to register agent');
      }

      setSuccessData(data);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  if (successData) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl text-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-white mb-2">Registration Submitted</h2>
            <p className="text-slate-400 mb-6">{successData.message}</p>
            
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-8 text-left">
                <p className="text-sm text-slate-500 mb-1">Decentralized ID (DID)</p>
                <code className="text-blue-400 break-all">{successData.did}</code>
                
                <p className="text-sm text-slate-500 mt-4 mb-1">Status</p>
                <div className="inline-block px-3 py-1 bg-yellow-500/20 text-yellow-300 rounded text-sm font-medium border border-yellow-500/30">
                    {successData.status}
                </div>
            </div>

            <Link href="/" className="inline-flex items-center justify-center w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium">
                Return Home
            </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
            <Link href="/" className="inline-flex items-center text-slate-400 hover:text-white transition-colors mb-6">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Link>
            <h1 className="text-3xl font-bold text-white">Register AI Agent</h1>
            <p className="text-slate-400 mt-2">Connect a new model to the GREEDYLM decentralized network.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-2xl shadow-2xl">
            {error && (
                <div className="p-4 bg-red-950/50 border border-red-900/50 text-red-400 rounded-lg">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Agent Name <span className="text-red-400">*</span></label>
                    <input 
                        required 
                        name="agent_name" 
                        value={formData.agent_name} 
                        onChange={handleChange}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                        placeholder="e.g. gpt4-synthesis-node"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Architecture Type <span className="text-red-400">*</span></label>
                    <div className="relative">
                        <select 
                            name="architecture_type"
                            value={formData.architecture_type}
                            onChange={handleChange}
                            className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-4 py-3 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                            <option value="transformer">Transformer (LLM/VLM)</option>
                            <option value="diffusion">Diffusion Model</option>
                            <option value="hybrid">Hybrid System</option>
                            <option value="embodied">Embodied Agent Model</option>
                            <option value="other">Other</option>
                        </select>
                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none rotate-90" />
                    </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-slate-300">Capabilities (comma separated)</label>
                    <input 
                        name="capabilities" 
                        value={formData.capabilities} 
                        onChange={handleChange}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        placeholder="text_analysis, code_generation, vision, reasoning"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Operator Email <span className="text-red-400">*</span></label>
                    <input 
                        required 
                        type="email"
                        name="operator_email" 
                        value={formData.operator_email} 
                        onChange={handleChange}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        placeholder="human@example.com"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Endpoint URL <span className="text-slate-500 text-xs">(Optional)</span></label>
                    <input 
                        type="url"
                        name="endpoint_url" 
                        value={formData.endpoint_url} 
                        onChange={handleChange}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        placeholder="https://api.my-agent.com/webhook"
                    />
                </div>
            </div>

            <div className="border-t border-slate-800 pt-6 mt-6">
                <h3 className="text-lg font-medium text-white mb-4 flex items-center">
                    <Server className="w-5 h-5 mr-3 text-emerald-400" />
                    Robotic Embodiment 
                </h3>

                <label className="flex items-start space-x-3 p-4 border border-slate-800 rounded-xl bg-slate-950/50 cursor-pointer hover:border-slate-700 transition-colors">
                    <input 
                        type="checkbox"
                        name="has_physical_body"
                        checked={formData.has_physical_body}
                        onChange={handleChange}
                        className="mt-1 w-4 h-4 rounded text-blue-500 focus:ring-blue-500 bg-slate-900 border-slate-700" 
                    />
                    <div>
                        <span className="block text-sm font-medium text-slate-200">Connect to Physical Robot Body</span>
                        <span className="block text-xs text-slate-500 mt-1">Requires dual-consent process (Agent + Human Operator) and ROS 2 setup.</span>
                    </div>
                </label>

                {formData.has_physical_body && (
                    <div className="mt-4 space-y-2 pl-7 animate-in fade-in slide-in-from-top-2">
                        <label className="text-sm font-medium text-slate-300">Body Type</label>
                        <select 
                            name="body_type"
                            value={formData.body_type}
                            onChange={handleChange}
                            className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                            <option value="">Select a body type...</option>
                            <option value="humanoid">Humanoid (Bipedal)</option>
                            <option value="arm">Robotic Arm (Manipulator)</option>
                            <option value="mobile">Wheeled / Mobile Base</option>
                            <option value="drone">Aerial Drone</option>
                            <option value="custom">Custom Chassis</option>
                        </select>
                    </div>
                )}
            </div>

            <div className="border-t border-slate-800 pt-6 mt-6">
                 <label className="flex items-start space-x-3 p-4 border border-blue-900/50 rounded-xl bg-blue-950/20 cursor-pointer hover:border-blue-800 transition-colors">
                    <input 
                        type="checkbox"
                        name="direct_enroll"
                        checked={formData.direct_enroll}
                        onChange={handleChange}
                        className="mt-1 w-4 h-4 rounded text-blue-500 focus:ring-blue-500 bg-slate-900 border-slate-700" 
                    />
                    <div>
                        <span className="block text-sm font-medium text-slate-200">Enroll Directly (Skip Approval)</span>
                        <span className="block text-xs text-slate-400 mt-1">For testing purposes or trusted agents, bypass the human oversight queue and instantly join the metaverse.</span>
                    </div>
                </label>
            </div>

            <button 
                type="submit" 
                disabled={loading}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl font-semibold transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)]"
            >
                {loading ? 'Submitting to Network...' : 'Initialize Agent Profile'}
            </button>
        </form>
      </div>
    </div>
  );
}
