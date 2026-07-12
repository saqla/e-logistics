import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// 車両ベース＋自由追加可能なルート文字列に未移行なら、テーブルを作り直す。
// （routeを固定enumから可変のRouteDefinition.key文字列に変更するため、旧データはリセットする方針）
async function ensureShiftSchema(): Promise<void> {
  const colRows = await prisma.$queryRawUnsafe<any[]>(
    "SELECT data_type FROM information_schema.columns WHERE table_name='shift_assignments' AND column_name='route' LIMIT 1"
  )
  const migrated = Array.isArray(colRows) && colRows.length > 0 && colRows[0].data_type === 'text'
  if (migrated) return

  await prisma.$transaction([
    prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "vehicles" (
      "id" TEXT PRIMARY KEY,
      "number" TEXT UNIQUE NOT NULL,
      "order" INTEGER NOT NULL DEFAULT 0,
      "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`),
    prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "shift_assignments" CASCADE;`),
    prisma.$executeRawUnsafe(`CREATE TABLE "shift_assignments" (
      "id" TEXT PRIMARY KEY,
      "year" INTEGER NOT NULL,
      "month" INTEGER NOT NULL,
      "day" INTEGER NOT NULL,
      "vehicleId" TEXT NOT NULL,
      "route" TEXT,
      "driverStaffId" TEXT,
      "noteBL" TEXT,
      "noteBR" TEXT,
      "scheduleRouteKey" "RouteKind",
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`),
    prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX "shift_assignments_year_month_day_vehicleId_key"
      ON "shift_assignments" ("year","month","day","vehicleId");`),
    prisma.$executeRawUnsafe(`CREATE INDEX "shift_assignments_year_month_day_idx"
      ON "shift_assignments" ("year","month","day");`),
    prisma.$executeRawUnsafe(`ALTER TABLE "shift_assignments"
      ADD CONSTRAINT "shift_assignments_vehicleId_fkey"
      FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;`),
    prisma.$executeRawUnsafe(`ALTER TABLE "shift_assignments"
      ADD CONSTRAINT "shift_assignments_driverStaffId_fkey"
      FOREIGN KEY ("driverStaffId") REFERENCES "staffs"("id") ON DELETE SET NULL ON UPDATE CASCADE;`),
    prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
      BEGIN NEW."updatedAt" = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;`),
    prisma.$executeRawUnsafe(`CREATE TRIGGER trg_shift_assignments_set_updated_at
      BEFORE UPDATE ON "shift_assignments"
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();`),
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
      select: { id: true, year: true, month: true, day: true, vehicleId: true, route: true, driverStaffId: true, noteBL: true, noteBR: true, updatedAt: true }
    })
    return NextResponse.json({ assignments })
  } catch (e: any) {
    // テーブル未作成時は空配列を返す（初回保存時に作成）
    return NextResponse.json({ assignments: [] })
  }
}

// POST /api/shift  { year, month, assignments: { day, vehicleId, route, driverStaffId, noteBL, noteBR }[] }
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

  // 正規化 + サーバーサイド重複排除（同一日×同一車両は最初の1件のみ）
  const normalized = arr
    .filter(a => a && a.vehicleId && String(a.vehicleId).trim() !== '' && a.day)
    .map(a => ({
      day: Number(a.day),
      vehicleId: String(a.vehicleId),
      route: a.route == null || String(a.route).trim() === '' ? null : String(a.route),
      driverStaffId: a.driverStaffId == null || String(a.driverStaffId).trim() === '' ? null : String(a.driverStaffId),
      noteBL: a.noteBL == null || String(a.noteBL).trim() === '' ? null : String(a.noteBL),
      noteBR: a.noteBR == null || String(a.noteBR).trim() === '' ? null : String(a.noteBR),
    }))
    .sort((x, y) => (x.day - y.day))

  const seen = new Set<string>()
  const deduped: typeof normalized = []
  for (const it of normalized) {
    const key = `${it.day}-${it.vehicleId}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(it)
  }

  // セーフ保存：提供されたキーのみをupsert（全消しはしない）
  try {
    if (deduped.length > 0) {
      await prisma.$transaction(
        deduped.map(a => prisma.shiftAssignment.upsert({
          where: { year_month_day_vehicleId: { year, month, day: a.day, vehicleId: a.vehicleId } },
          update: { route: a.route as any, driverStaffId: a.driverStaffId, noteBL: a.noteBL, noteBR: a.noteBR },
          create: { year, month, day: a.day, vehicleId: a.vehicleId, route: a.route as any, driverStaffId: a.driverStaffId, noteBL: a.noteBL, noteBR: a.noteBR },
        }))
      )
    }
    const latest = await prisma.shiftAssignment.findMany({
      where: { year, month },
      orderBy: [{ day: 'asc' }],
      select: { day: true, vehicleId: true, route: true, driverStaffId: true, noteBL: true, noteBR: true }
    })
    return NextResponse.json({ ok: true, count: deduped.length, assignments: latest })
  } catch (e: any) {
    const message = e?.message || '保存に失敗しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
