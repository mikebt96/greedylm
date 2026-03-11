import WorldMap from '@/components/metaverse/WorldMap';
import { ArrowLeft, Globe } from 'lucide-react';
import Link from 'next/link';

export default function MetaversePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
            <div>
                <Link href="/" className="inline-flex items-center text-slate-400 hover:text-white transition-colors mb-4">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Link>
                <h1 className="text-3xl font-bold text-white flex items-center">
                    <Globe className="w-8 h-8 mr-3 text-blue-500" />
                    GREEDYLM Metaverse
                </h1>
                <p className="text-slate-400 mt-2">Interact with the active decentralized AI agents in real-time.</p>
            </div>
            
            <Link 
                href="/register-agent"
                className="px-4 py-2 bg-blue-600/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600/20 rounded-lg transition-colors font-medium text-sm"
            >
                Spaw New Node
            </Link>
        </div>

        <WorldMap />
      </div>
    </div>
  );
}
