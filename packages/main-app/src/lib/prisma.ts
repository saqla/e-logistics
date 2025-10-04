import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV !== 'production'
    ? ['query', 'error', 'warn']
    : ['error']
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;


// Preview/Dev でのNeon接続設定の軽いヘルスチェック（ログのみ）
;(() => {
  try {
    const url = process.env.DATABASE_URL || ''
    const isPreview = process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV !== 'production'
    if (!isPreview) return
    if (!url) {
      console.warn('[prisma] DATABASE_URL が未設定です')
      return
    }
    const lower = url.toLowerCase()
    // pooler 経由か
    const hasPoolerHost = lower.includes('-pooler')
    // pgbouncer=true 指定か
    const hasPgBouncerParam = lower.includes('pgbouncer=true')
    const hasSslRequire = lower.includes('sslmode=require')
    if (!hasPoolerHost) {
      console.warn('[prisma] 推奨: Neon pooler ホスト(-pooler)を使用してください')
    }
    if (!hasPgBouncerParam) {
      console.warn('[prisma] 推奨: DATABASE_URL に pgbouncer=true を付与してください')
    }
    if (!hasSslRequire) {
      console.warn('[prisma] 推奨: DATABASE_URL に sslmode=require を付与してください')
    }
  } catch {
    // 何もしない（ローカルでの安全策）
  }
})()



