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
};

export default nextConfig;
