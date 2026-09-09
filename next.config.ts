/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: process.cwd(),
  experimental: {
    serverActions: {}
  },
  serverExternalPackages: ['pdf-parse']
}

module.exports = nextConfig
