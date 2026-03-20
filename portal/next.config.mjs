import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  

  
  // TRANSPILE 3D LIBRARIES
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
  
  // Security Headers
  async headers() {
    return [
      {
        source: "/metaverse/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
    ];
  },

  // CRÍTICO: habilitar output standalone para Docker
  output: "standalone",

  typescript: {
    // Advertencia: esto permite que el build pase aunque haya errores de TypeScript
    ignoreBuildErrors: true,
  },

  // API Rewrites to Render Backend
  async rewrites() {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${API_URL}/health`,
      },
      {
        source: "/metrics",
        destination: `${API_URL}/metrics`,
      },
    ];
  },
};

export default nextConfig;
