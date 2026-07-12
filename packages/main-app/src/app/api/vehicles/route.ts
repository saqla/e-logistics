import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function ensureSchema() {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='vehicles' LIMIT 1"
    )
    const exists = Array.isArray(rows) && rows.length > 0
    if (exists) return
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "vehicles" (
      "id" TEXT PRIMARY KEY,
      "number" TEXT UNIQUE NOT NULL,
      "order" INTEGER NOT NULL DEFAULT 0,
      "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`)
  } catch {}
}

export async function GET() {
  await ensureSchema()
  const items = await prisma.vehicle.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] })
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
  const number = (body?.number || '').toString().trim()
  const order = Number(body?.order ?? 0)
  const enabled = body?.enabled == null ? true : !!body.enabled
  if (!number) return NextResponse.json({ error: '車番は必須です' }, { status: 400 })
  try {
    const created = await prisma.vehicle.create({ data: { number, order, enabled } })
    return NextResponse.json({ item: created })
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: '同じ車番が既に存在します' }, { status: 409 })
    return NextResponse.json({ error: e?.message || '作成に失敗しました' }, { status: 500 })
  }
}
