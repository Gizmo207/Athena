import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: [],
  },
  webpack: (config) => {
    // Disable LightningCSS to avoid native binding issues
    config.experiments = {
      ...config.experiments,
      css: false,
    };
    return config;
  },
};

export default nextConfig;
