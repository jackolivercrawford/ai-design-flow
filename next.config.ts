/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true
  },
  serverExternalPackages: ['pdf-parse']
}

module.exports = nextConfig
