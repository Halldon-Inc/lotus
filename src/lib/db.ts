import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const isProduction = process.env.NODE_ENV === 'production'

function initDb(): string {
  // In production/Vercel: always use /tmp (only writable dir)
  if (isProduction || process.env.VERCEL) {
    const tmpDb = '/tmp/dev.db'

    if (!fs.existsSync(tmpDb)) {
      // The build copies dev.db to prisma/ which gets bundled
      const cwd = process.cwd()
      const sources = [
        path.join(cwd, 'prisma', 'dev.db'),
        path.join(cwd, '.next', 'server', 'prisma-dev.db'),
        '/var/task/prisma/dev.db',
        '/var/task/.next/server/prisma-dev.db',
      ]

      for (const src of sources) {
        try {
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, tmpDb)
            break
          }
        } catch {}
      }
    }

    return `file:${tmpDb}`
  }

  // Dev: use DATABASE_URL or default
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
