import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function ensureSchema() {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='route_definitions' LIMIT 1"
    )
    const exists = Array.isArray(rows) && rows.length > 0
    if (exists) return
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "route_definitions" (
      "id" TEXT PRIMARY KEY,
      "key" TEXT UNIQUE NOT NULL,
      "name" TEXT NOT NULL,
      "order" INTEGER NOT NULL DEFAULT 0,
      "bgClass" TEXT NOT NULL DEFAULT '',
      "textClass" TEXT NOT NULL DEFAULT '',
      "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`)
  } catch {}
}

export async function GET() {
  await ensureSchema()
  const items = await prisma.routeDefinition.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] })
  return NextResponse.json({ items })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any)
  const cookie = req.headers.get('cookie') || ''
  const disabled = /(?:^|;\s*)editor_disabled=1(?:;|$)/.test(cookie)
  if (!(session as any)?.editorVerified || disabled) {
    return NextResponse.json({ error: '編集権限がありません' }, { status: 403 })
  }
  await ensureSchema()
  const body = await req.json().catch(() => ({}))
  const key = (body?.key||'').toString().trim()
  const name = (body?.name||'').toString().trim()
  const order = Number(body?.order ?? 0)
  const bgClass = (body?.bgClass||'').toString()
  const textClass = (body?.textClass||'').toString()
  const enabled = !!body?.enabled
  if (!key || !name) return NextResponse.json({ error: 'keyとnameは必須です' }, { status: 400 })
  const created = await prisma.routeDefinition.create({ data: { key, name, order, bgClass, textClass, enabled } })
  return NextResponse.json({ item: created })
}


