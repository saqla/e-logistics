import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

async function ensureShiftSchema(): Promise<void> {
  // テーブルが無ければ初回だけ作成（プレビュー向け）
  const existsRows = await prisma.$queryRawUnsafe(
    "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='shift_assignments' LIMIT 1"
  )
  const already = Array.isArray(existsRows) && existsRows.length > 0
  if (already) return

  await prisma.$transaction([
    prisma.$executeRawUnsafe(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShiftRouteKind') THEN
        CREATE TYPE "ShiftRouteKind" AS ENUM ('SANCHOKU','DONKI_FUKUOKA','DONKI_NAGASAKI','UNIC','OFF','PAID_LEAVE');
      END IF;
    END $$;`),
    prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "shift_assignments" (
      "id" TEXT PRIMARY KEY,
      "year" INTEGER NOT NULL,
      "month" INTEGER NOT NULL,
      "day" INTEGER NOT NULL,
      "staffId" TEXT NOT NULL,
      "route" "ShiftRouteKind" NOT NULL,
      "carNumber" TEXT,
      "noteBL" TEXT,
      "noteBR" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`),
    prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "shift_assignments_year_month_day_staffId_key"
      ON "shift_assignments" ("year","month","day","staffId");`),
    prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "shift_assignments_year_month_day_idx"
      ON "shift_assignments" ("year","month","day");`),
    prisma.$executeRawUnsafe(`DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'shift_assignments_staffId_fkey'
      ) THEN
        ALTER TABLE "shift_assignments"
        ADD CONSTRAINT "shift_assignments_staffId_fkey"
        FOREIGN KEY ("staffId") REFERENCES "staffs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;`),
    prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
      BEGIN NEW."updatedAt" = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;`),
    prisma.$executeRawUnsafe(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_shift_assignments_set_updated_at') THEN
        CREATE TRIGGER trg_shift_assignments_set_updated_at
        BEFORE UPDATE ON "shift_assignments"
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      END IF;
    END $$;`),
  ] as any)
}

// GET /api/shift?year=2025&month=11
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const year = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month'))
  if (!year || !month) return NextResponse.json({ error: 'year, month は必須' }, { status: 400 })

  try {
    const assignments = await prisma.shiftAssignment.findMany({
      where: { year, month },
      orderBy: [{ day: 'asc' }],
      select: { id: true, year: true, month: true, day: true, staffId: true, route: true, carNumber: true, noteBL: true, noteBR: true, updatedAt: true }
    })
    return NextResponse.json({ assignments })
  } catch (e: any) {
    // テーブル未作成時は空配列を返す（初回保存時に作成）
    return NextResponse.json({ assignments: [] })
  }
}

// POST /api/shift  { year, month, assignments: ShiftAssignment[] }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any)
  const cookie = req.headers.get('cookie') || ''
  const disabled = /(?:^|;\s*)editor_disabled=1(?:;|$)/.test(cookie)
  if (!(session as any)?.editorVerified || disabled) {
    return NextResponse.json({ error: '編集権限がありません' }, { status: 403 })
  }

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const year: number = Number(body?.year)
  const month: number = Number(body?.month)
  const arr: any[] = Array.isArray(body?.assignments) ? body.assignments : []
  if (!year || !month) return NextResponse.json({ error: 'year, month は必須' }, { status: 400 })

  // 空保存ガード：既存データがある月に対して、空配列での保存要求は無視（明示allowEmpty=1時のみ許可）
  const { searchParams } = new URL(req.url)
  const allowEmpty = searchParams.get('allowEmpty') === '1'
  try {
    const exists = await prisma.shiftAssignment.count({ where: { year, month } })
    if (!allowEmpty && (!arr || arr.length === 0) && exists > 0) {
      return NextResponse.json({ ok: true, noChange: true })
    }
  } catch {}

  // 初回は自動でテーブルを用意
  await ensureShiftSchema()

  // 正規化 + サーバーサイド重複排除（同一日×同一スタッフは最初の1件のみ）
  const normalized = arr
    .filter(a => a && a.staffId && String(a.staffId).trim() !== '' && a.day)
    .map(a => ({
      day: Number(a.day),
      staffId: String(a.staffId),
      route: String(a.route),
      carNumber: a.carNumber == null || String(a.carNumber).trim() === '' ? null : String(a.carNumber),
      noteBL: a.noteBL == null || String(a.noteBL).trim() === '' ? null : String(a.noteBL),
      noteBR: a.noteBR == null || String(a.noteBR).trim() === '' ? null : String(a.noteBR),
    }))
    .sort((x, y) => (x.day - y.day))

  const seen = new Set<string>()
  const deduped: typeof normalized = []
  for (const it of normalized) {
    const key = `${it.day}-${it.staffId}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(it)
  }

  // セーフ保存：提供されたキーのみをupsert（全消しはしない）
  try {
    if (deduped.length > 0) {
      const existing = await prisma.shiftAssignment.findMany({
        where: { year, month },
        select: { day: true, staffId: true }
      })
      const existsSet = new Set(existing.map(e => `${e.day}-${e.staffId}`))
      const ops: any[] = []
      for (const a of deduped) {
        const key = `${a.day}-${a.staffId}`
        if (existsSet.has(key)) {
          ops.push(prisma.shiftAssignment.update({
            where: {
              // 安全なユニーク検索（id未使用）
              // Prismaは複合uniqueキーに名前が無くてもupdateManyで確実に動作させられるため、updateManyに変更
            } as any,
            data: { route: a.route as any, carNumber: a.carNumber, noteBL: a.noteBL, noteBR: a.noteBR },
          }))
        } else {
          ops.push(prisma.shiftAssignment.create({
            data: { year, month, day: a.day, staffId: a.staffId, route: a.route as any, carNumber: a.carNumber, noteBL: a.noteBL, noteBR: a.noteBR },
          }))
        }
      }
      // updateManyへ置換（whereに複合条件を指定）
      for (let i = 0; i < ops.length; i++) {
        const a = deduped[i]
        if (!a) continue
        if (existsSet.has(`${a.day}-${a.staffId}`)) {
          ops[i] = prisma.shiftAssignment.updateMany({
            where: { year, month, day: a.day, staffId: a.staffId },
            data: { route: a.route as any, carNumber: a.carNumber, noteBL: a.noteBL, noteBR: a.noteBR },
          })
        }
      }
      await prisma.$transaction(ops)
    }
    const latest = await prisma.shiftAssignment.findMany({
      where: { year, month },
      orderBy: [{ day: 'asc' }],
      select: { id: true, year: true, month: true, day: true, staffId: true, route: true, carNumber: true, noteBL: true, noteBR: true, updatedAt: true }
    })
    return NextResponse.json({ ok: true, count: deduped.length, assignments: latest })
  } catch (e: any) {
    const message = e?.message || '保存に失敗しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


