/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  images: {
    domains: [],
  },
  // Force Vercel to include the SQLite DB in ALL serverless function bundles
  outputFileTracingIncludes: {
    '/api/**': ['./prisma/dev.db', './prisma/dev.db.b64'],
    '/**': ['./prisma/dev.db', './prisma/dev.db.b64'],
  },
}

module.exports = nextConfig
