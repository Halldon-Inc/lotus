/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Add any experimental features you need
  },
  images: {
    domains: [],
  },
  // Include the SQLite DB in serverless function bundles
  outputFileTracingIncludes: {
    '/api/**': ['./prisma/dev.db'],
    '/**': ['./prisma/dev.db'],
  },
}

module.exports = nextConfig
