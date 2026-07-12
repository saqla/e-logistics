import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function ensureSchema() {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='shift_rest_days' LIMIT 1"
    )
    const exists = Array.isArray(rows) && rows.length > 0
    if (exists) return
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "shift_rest_days" (
      "id" TEXT PRIMARY KEY,
      "year" INTEGER NOT NULL,
      "month" INTEGER NOT NULL,
      "day" INTEGER NOT NULL,
      "staffId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "shift_rest_days_year_month_day_staffId_key"
      ON "shift_rest_days" ("year","month","day","staffId");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "shift_rest_days_year_month_day_idx"
      ON "shift_rest_days" ("year","month","day");`)
    await prisma.$executeRawUnsafe(`DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'shift_rest_days_staffId_fkey'
      ) THEN
        ALTER TABLE "shift_rest_days"
        ADD CONSTRAINT "shift_rest_days_staffId_fkey"
        FOREIGN KEY ("staffId") REFERENCES "staffs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;`)
  } catch {}
}

// GET /api/shift/rest?year=2026&month=7
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const year = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month'))
  if (!year || !month) return NextResponse.json({ error: 'year, month は必須' }, { status: 400 })
  try {
    const items = await prisma.shiftRestDay.findMany({
      where: { year, month },
      orderBy: [{ day: 'asc' }],
      select: { id: true, day: true, staffId: true },
    })
    return NextResponse.json({ items })
  } catch {
    return NextResponse.json({ items: [] })
  }
}

// POST /api/shift/rest  { year, month, day, staffId }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any)
  const cookie = req.headers.get('cookie') || ''
  const disabled = /(?:^|;\s*)editor_disabled=1(?:;|$)/.test(cookie)
  if (!(session as any)?.editorVerified || disabled) {
    return NextResponse.json({ error: '編集権限がありません' }, { status: 403 })
  }
  await ensureSchema()
  const body = await req.json().catch(() => ({}))
  const year = Number(body?.year)
  const month = Number(body?.month)
  const day = Number(body?.day)
  const staffId = (body?.staffId || '').toString()
  if (!year || !month || !day || !staffId) {
    return NextResponse.json({ error: 'year, month, day, staffId は必須' }, { status: 400 })
  }
  try {
    const item = await prisma.shiftRestDay.upsert({
      where: { year_month_day_staffId: { year, month, day, staffId } },
      update: {},
      create: { year, month, day, staffId },
    })
    return NextResponse.json({ item })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '作成に失敗しました' }, { status: 500 })
  }
}
