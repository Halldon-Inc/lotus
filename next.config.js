const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  images: {
    domains: [],
  },
  // Force Vercel to include the SQLite DB in ALL serverless function bundles
  // '/*' only matches top-level routes; need explicit patterns for nested API routes
  outputFileTracingIncludes: {
    '/api/**': ['./prisma/dev.db', './src/lib/db-seed.ts'],
    '/**': ['./prisma/dev.db', './src/lib/db-seed.ts'],
  },
  // Webpack: copy dev.db into the output so serverless functions can find it
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.plugins.push({
        apply: (compiler) => {
          compiler.hooks.afterEmit.tapAsync('CopyDbPlugin', (compilation, callback) => {
            const fs = require('fs')
            const src = path.join(__dirname, 'prisma', 'dev.db')
            const dest = path.join(__dirname, '.next', 'server', 'prisma-dev.db')
            if (fs.existsSync(src)) {
              try {
                fs.copyFileSync(src, dest)
                console.log('[CopyDbPlugin] Copied dev.db to .next/server/')
              } catch (e) {
                console.error('[CopyDbPlugin] Failed:', e)
              }
            }
            callback()
          })
        }
      })
    }
    return config
  },
}

module.exports = nextConfig
