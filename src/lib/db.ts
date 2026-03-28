import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const isProduction = process.env.NODE_ENV === 'production'

function getDbUrl(): string {
  const isVercel = !!process.env.VERCEL
  
  if (isVercel || isProduction) {
    const tmpDb = '/tmp/dev.db'
    
    if (!fs.existsSync(tmpDb)) {
      const cwd = process.cwd()
      const candidates = [
        path.join(cwd, 'prisma', 'dev.db'),
        path.join(cwd, '.next', 'server', 'prisma-dev.db'),
        path.join(__dirname, '..', '..', 'prisma', 'dev.db'),
        path.join(__dirname, '..', '..', '..', 'prisma', 'dev.db'),
        path.join(__dirname, 'prisma-dev.db'),
        '/var/task/prisma/dev.db',
        '/var/task/.next/server/prisma-dev.db',
      ]
      
      let found = false
      for (const src of candidates) {
        try {
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, tmpDb)
            console.log(`[db] Copied SQLite DB from ${src} to ${tmpDb}`)
            found = true
            break
          }
        } catch (e) {
          console.log(`[db] Failed to check/copy ${src}: ${e}`)
        }
      }
      
      if (!found) {
        console.error(`[db] Could not find SQLite DB. cwd=${cwd}, __dirname=${__dirname}`)
        try {
          const cwdFiles = fs.readdirSync(cwd)
          console.error(`[db] Files in cwd: ${cwdFiles.join(', ')}`)
          if (fs.existsSync(path.join(cwd, 'prisma'))) {
            const prismaFiles = fs.readdirSync(path.join(cwd, 'prisma'))
            console.error(`[db] Files in prisma/: ${prismaFiles.join(', ')}`)
          }
        } catch (e) {
          console.error(`[db] Could not list files: ${e}`)
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
    log: isProduction ? [] : ['query'],
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  })

if (!isProduction) globalForPrisma.prisma = prisma
