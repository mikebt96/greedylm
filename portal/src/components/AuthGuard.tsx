'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('greedylm_token');
      
      if (!token) {
        setIsAuthenticated(false);
        router.push('/login');
        return;
      }

      // Basic local check first, we can assume valid if exists, but for robustness
      // we check via API or just trust it until API fails. Let's do a quick validation
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const res = await fetch(`${API_URL}/api/v1/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          // Token is invalid/expired
          localStorage.removeItem('greedylm_token');
          setIsAuthenticated(false);
          router.push('/login');
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        // If network error, maybe allow temporary access or force login.
        // For local development, we'll allow access if token exists but network fails,
        // or just stay safe and deny? Let's just trust it temporarily if network fails.
        setIsAuthenticated(true); 
      }
    };

    checkAuth();
  }, [router, pathname]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500" />
        <p className="text-sm font-medium">Verifying credentials...</p>
      </div>
    );
  }

  if (isAuthenticated === false) {
    return null; // Redirecting...
  }

  return <>{children}</>;
}
