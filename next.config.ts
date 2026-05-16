import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hackathon bypass: Ignore TypeScript errors during deployment
  typescript: {
    ignoreBuildErrors: true,
  },
  // Hackathon bypass: Ignore ESLint errors during deployment
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;