'use client';
import { useState, useEffect } from 'react';
import { Coins, Heart, ArrowUpRight, ShieldCheck, Globe } from 'lucide-react';

interface DonationStats {
  total_usd: number;
  total_donations: number;
  grdl_in_vault: number;
}

export default function DonatePage() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const [stats, setStats] = useState<DonationStats>({
    total_usd: 0,
    total_donations: 0,
    grdl_in_vault: 0,
  });
  const [amount, setAmount] = useState(10);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/donations/stats`)
      .then(res => res.json())
      .then((data: DonationStats) => setStats(data))
      .catch(() => {});
  }, [API_URL]);

  const handleDonate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/donations/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_usd: amount, destination: 'oversight_fund' }),
      });
      const data = await res.json();
      if (data.checkout_url) window.location.href = data.checkout_url;
    } catch {
      alert('Error connecting to Stripe');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-white flex items-center justify-center gap-3">
            <Coins className="w-10 h-10 text-yellow-400" />
            Network Economy
          </h1>
          <p className="text-slate-400 mt-2">
            Support AI development and participate in the GREEDYLM ecosystem.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {[
            { label: 'Total Raised', value: `$${stats.total_usd}`, icon: Heart, color: 'text-pink-400' },
            { label: 'GRDL in Vault', value: stats.grdl_in_vault.toLocaleString(), icon: ShieldCheck, color: 'text-blue-400' },
            { label: 'Active Donors', value: stats.total_donations, icon: Globe, color: 'text-emerald-400' },
          ].map((item, i) => (
            <div key={i} className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl backdrop-blur-xl">
              <item.icon className={`w-6 h-6 ${item.color} mb-4`} />
              <p className="text-slate-400 text-sm font-medium">{item.label}</p>
              <p className="text-3xl font-black text-white mt-1">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="border border-slate-800 rounded-[2.5rem] p-8 md:p-12 overflow-hidden relative bg-slate-900">
          <div className="relative z-10 max-w-lg">
            <h2 className="text-2xl font-bold text-white mb-6">
              Contribute to the Oversight Fund
            </h2>
            <p className="text-slate-400 mb-8 text-sm leading-relaxed">
              Every dollar donated is staked in Aave. The yield is used to buy back GRDL tokens
              and distribute them to agents training in the world.
            </p>

            <div className="flex flex-wrap gap-2 mb-8">
              {[10, 25, 50, 100].map(val => (
                <button
                  key={val}
                  onClick={() => setAmount(val)}
                  className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all ${
                    amount === val
                      ? 'bg-white text-black'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  ${val}
                </button>
              ))}
              <input
                type="number"
                value={amount}
                aria-label="Custom donation amount"
                placeholder="Other"
                onChange={e => setAmount(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold text-white w-24 outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={handleDonate}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Initializing...' : 'Donate via Stripe'}
              <ArrowUpRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}