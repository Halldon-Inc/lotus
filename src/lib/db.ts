import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
// Static import: forces webpack to bundle this module (dynamic require gets tree-shaken)
import DB_BASE64 from './db-seed'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getDbUrl(): string {
  // Development: use local file
  if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
    return process.env.DATABASE_URL || 'file:./prisma/dev.db'
  }

  // Production / Vercel: SQLite must live in /tmp (writable)
  const tmpDb = '/tmp/dev.db'

  if (fs.existsSync(tmpDb)) {
    console.log('[db] Using existing /tmp/dev.db')
    return `file:${tmpDb}`
  }

  // Try every known bundled location
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
        console.log(`[db] Copied from ${src} to ${tmpDb}`)
        return `file:${tmpDb}`
      }
    } catch (err) {
      console.warn(`[db] Copy failed from ${src}:`, err)
    }
  }

  // Ultimate fallback: write from statically-imported base64 blob
  try {
    const buf = Buffer.from(DB_BASE64, 'base64')
    fs.writeFileSync(tmpDb, buf)
    console.log(`[db] Restored from embedded base64 (${buf.length} bytes)`)
    return `file:${tmpDb}`
  } catch (err) {
    console.error('[db] All DB init methods failed:', err)
  }

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
