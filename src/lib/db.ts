import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getDbUrl(): string {
  // In production on Vercel, copy the SQLite DB to /tmp (writable)
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    const tmpDb = '/tmp/dev.db'
    
    if (!fs.existsSync(tmpDb)) {
      // Try to find the source DB bundled with the build
      const candidates = [
        path.join(process.cwd(), 'prisma', 'dev.db'),
        path.join(__dirname, '..', '..', 'prisma', 'dev.db'),
        path.join(__dirname, '..', '..', '..', 'prisma', 'dev.db'),
      ]
      
      for (const src of candidates) {
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, tmpDb)
          console.log(`[db] Copied SQLite DB from ${src} to ${tmpDb}`)
          break
        }
      }
    }
    
    return `file:${tmpDb}`
  }
  
  return process.env.DATABASE_URL || 'file:./dev.db'
}

const dbUrl = getDbUrl()

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? [] : ['query'],
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
