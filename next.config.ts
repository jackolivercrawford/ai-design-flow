/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {}
  },
  serverExternalPackages: ['pdf-parse']
}

module.exports = nextConfig
