import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['web-push'],
  // UIX-01: official FPL asset hosts (player photos/badges + kit shirts) via next/image
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'resources.premierleague.com' },
      { protocol: 'https', hostname: 'fantasy.premierleague.com' },
    ],
  },
};

export default nextConfig;
