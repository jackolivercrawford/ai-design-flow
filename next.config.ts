import type { NextConfig } from "next";

const nextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'pdfjs-dist': false,
    };
    return config;
  },
} satisfies NextConfig;

export default nextConfig;
