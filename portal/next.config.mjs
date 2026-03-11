/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["assets.greedylm.network"],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
  },
  
  // CDN for production assets
  assetPrefix: process.env.NODE_ENV === "production"
    ? "https://cdn.greedylm.network"
    : "",
  
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
