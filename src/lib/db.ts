import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const isProduction = process.env.NODE_ENV === 'production'

function initDb(): string {
  if (isProduction || process.env.VERCEL) {
    const tmpDb = '/tmp/dev.db'

    if (!fs.existsSync(tmpDb)) {
      // Try filesystem copies first
      const cwd = process.cwd()
      const sources = [
        path.join(cwd, 'prisma', 'dev.db'),
        path.join(cwd, '.next', 'server', 'prisma-dev.db'),
        '/var/task/prisma/dev.db',
        '/var/task/.next/server/prisma-dev.db',
      ]

      let found = false
      for (const src of sources) {
        try {
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, tmpDb)
            console.log(`[db] Copied from ${src}`)
            found = true
            break
          }
        } catch {}
      }

      // Ultimate fallback: decode embedded base64 DB
      if (!found) {
        try {
          const dbBase64 = require('./db-seed').default
          const buf = Buffer.from(dbBase64, 'base64')
          fs.writeFileSync(tmpDb, buf)
          console.log(`[db] Created from embedded seed (${buf.length} bytes)`)
        } catch (e) {
          console.error(`[db] All DB sources failed:`, e)
        }
      }
    }

    return `file:${tmpDb}`
  }

  return process.env.DATABASE_URL || 'file:./dev.db'
}

const dbUrl = initDb()

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? [] : ['query'],
    datasources: {
      db: { url: dbUrl },
    },
  })

if (!isProduction) globalForPrisma.prisma = prisma
