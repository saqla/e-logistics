import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getPrisma() {
  try {
    const mod = await import('@/lib/prisma')
    return (mod as any).prisma as any
  } catch (_e) {
    return null
  }
}

async function ensureShiftContactSchema() {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='shift_contacts' LIMIT 1"
    )
    const exists = Array.isArray(rows) && rows.length > 0
    if (exists) return
    await prisma.$transaction([
      prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "shift_contacts" (
        "id" TEXT PRIMARY KEY,
        "title" TEXT NOT NULL,
        "body" TEXT NOT NULL,
        "category" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`),
      prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "shift_contacts_createdAt_idx" ON "shift_contacts" ("createdAt");`)
    ] as any)
  } catch {}
}

// GET /api/shift/contact
export async function GET() {
  const prisma = await getPrisma()
  if (!prisma) return NextResponse.json({ items: [] })
  await ensureShiftContactSchema()
  const items = await prisma.shiftContact.findMany({ orderBy: { createdAt: 'asc' } })
  return NextResponse.json({ items })
}

// POST /api/shift/contact { title, body, category? }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any)
  const cookie = req.headers.get('cookie') || ''
  const disabled = /(?:^|;\s*)editor_disabled=1(?:;|$)/.test(cookie)
  if (!(session as any)?.editorVerified || disabled) {
    return NextResponse.json({ error: '編集権限がありません' }, { status: 403 })
  }
  const prisma = await getPrisma()
  if (!prisma) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })
  await ensureShiftContactSchema()
  const body = await req.json()
  const rawTitle: string | undefined = typeof body?.title === 'string' ? body.title : undefined
  const content: string = (body?.body ?? '').toString().trim()
  const category: string | undefined = typeof body?.category === 'string' ? body.category : undefined
  if (!content) return NextResponse.json({ error: '本文は必須です' }, { status: 400 })
  // タイトル未指定の場合は本文先頭から自動生成（先頭行の先頭30文字）
  const autoTitle = (() => {
    const firstLine = content.split(/\r?\n/)[0] || ''
    return firstLine.substring(0, 30) || '連絡'
  })()
  const title = (rawTitle ?? '').toString().trim() || autoTitle
  const created = await prisma.shiftContact.create({ data: { title, body: content, category } })
  return NextResponse.json({ item: created })
}


