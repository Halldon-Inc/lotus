import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  const cwd = process.cwd()
  const info: Record<string, unknown> = {
    cwd,
    __dirname,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
    DATABASE_URL: process.env.DATABASE_URL ? '[set]' : '[not set]',
  }

  // Check what files exist
  const checks = [
    path.join(cwd, 'prisma', 'dev.db'),
    path.join(cwd, '.next', 'server', 'prisma-dev.db'),
    '/var/task/prisma/dev.db',
    '/var/task/.next/server/prisma-dev.db',
    '/tmp/dev.db',
  ]

  info.fileChecks = checks.map(p => ({ path: p, exists: fs.existsSync(p) }))

  // List prisma dir
  try {
    const prismaDir = path.join(cwd, 'prisma')
    if (fs.existsSync(prismaDir)) {
      info.prismaFiles = fs.readdirSync(prismaDir)
    } else {
      info.prismaFiles = 'directory does not exist'
    }
  } catch (e) {
    info.prismaFiles = `error: ${e}`
  }

  // List cwd
  try {
    info.cwdFiles = fs.readdirSync(cwd)
  } catch (e) {
    info.cwdFiles = `error: ${e}`
  }

  return NextResponse.json(info)
}
