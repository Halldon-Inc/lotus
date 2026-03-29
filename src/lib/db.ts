import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getDbUrl(): string {
  // Development: use local file
  if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
    return process.env.DATABASE_URL || 'file:./prisma/dev.db'
  }

  // Production / Vercel: SQLite must live in /tmp (writable)
  // Always copy from bundle to ensure fresh data after each deploy
  const tmpDb = '/tmp/dev.db'
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
        return `file:${tmpDb}`
      }
    } catch (err) {
      console.warn(`[db] Copy failed from ${src}:`, err)
    }
  }

  // Fallback: read base64 file at runtime (avoids webpack bundling 400KB string)
  const b64Paths = [
    path.join(cwd, 'prisma', 'dev.db.b64'),
    '/var/task/prisma/dev.db.b64',
  ]
  for (const b64 of b64Paths) {
    try {
      if (fs.existsSync(b64)) {
        const buf = Buffer.from(fs.readFileSync(b64, 'utf-8').trim(), 'base64')
        fs.writeFileSync(tmpDb, buf)
        console.log(`[db] Restored from base64 file (${buf.length} bytes)`)
        return `file:${tmpDb}`
      }
    } catch (err) {
      console.warn(`[db] Base64 fallback failed from ${b64}:`, err)
    }
  }

  console.error('[db] All DB init methods failed')
  return `file:${tmpDb}`
}

const dbUrl = getDbUrl()

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? [] : ['query'],
    datasources: {
      db: { url: dbUrl },
    },
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
