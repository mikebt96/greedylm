'use client';

import { useState } from 'react';
import { Shield, Eye, EyeOff, ArrowLeft, Lock } from 'lucide-react';
import Link from 'next/link';

export default function AdminLoginPage() {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmed = token.trim();
    if (!trimmed) {
      setError('El token JWT no puede estar vacío.');
      return;
    }

    // Basic JWT structure validation (three dot-separated base64 segments)
    const parts = trimmed.split('.');
    if (parts.length !== 3) {
      setError('Formato inválido. Un JWT tiene 3 segmentos separados por puntos.');
      return;
    }

    // Store the token
    localStorage.setItem('greedylm_jwt', trimmed);
    setSuccess(true);

    // Redirect to oversight after a brief delay
    setTimeout(() => {
      window.location.href = '/oversight';
    }, 1500);
  };

  if (success) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center space-y-4 animate-pulse">
          <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 w-fit mx-auto">
            <Shield className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Token válido — accediendo...</h1>
          <p className="text-slate-400 text-sm">Redirigiendo a la consola de Oversight.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Back link */}
        <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio
        </Link>

        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 w-fit mx-auto mb-4">
              <Lock className="w-8 h-8 text-blue-400" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Acceso Administrativo</h1>
            <p className="text-slate-400 text-sm mt-2">
              Ingresa tu token JWT de administrador para acceder a la consola de Oversight.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="jwt-token" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                Token JWT
              </label>
              <div className="relative">
                <input
                  id="jwt-token"
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={e => { setToken(e.target.value); setError(''); }}
                  placeholder="eyJhbGciOiJIUzI1NiIs..."
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 pr-12 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(v => !v)}
                  aria-label={showToken ? 'Ocultar token' : 'Mostrar token'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {error && (
                <p className="mt-2 text-red-400 text-xs font-bold">{error}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Shield className="w-4 h-4" />
              Acceder a Oversight
            </button>
          </form>

        </div>
      </div>
    </main>
  );
}
